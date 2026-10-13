import { neon } from "@neondatabase/serverless";
import type { GameState } from "../game/types";

export interface Room {
  state: GameState;
  version: number;
  /** Player id -> last poll as epoch seconds. */
  seen: Record<string, number>;
}

export interface Touch {
  id: string;
  tokenHash: string;
  now: number;
}

interface Store {
  create(state: GameState, hostSeen: number): Promise<boolean>;
  /** Reads a room; with `touch` it also records that this player is online. */
  read(code: string, touch?: Touch): Promise<Room | null>;
  /** Saves only if nobody else saved since `version` was read. */
  write(code: string, version: number, state: GameState): Promise<boolean>;
}

/** Seconds between two presence writes of the same player. */
const TOUCH_EVERY = 4;
const ROOM_TTL_HOURS = 24;

function neonStore(url: string): Store {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const ensure = () => {
    ready ??= sql
      .query(
        `CREATE TABLE IF NOT EXISTS werwolf_rooms (
           code text PRIMARY KEY,
           version integer NOT NULL DEFAULT 1,
           state jsonb NOT NULL,
           seen jsonb NOT NULL DEFAULT '{}'::jsonb,
           updated_at timestamptz NOT NULL DEFAULT now()
         )`,
      )
      .catch((e) => {
        ready = null;
        throw e;
      });
    return ready;
  };

  return {
    async create(state, hostSeen) {
      await ensure();
      await sql.query(
        `DELETE FROM werwolf_rooms WHERE updated_at < now() - make_interval(hours => $1)`,
        [ROOM_TTL_HOURS],
      );
      const rows = await sql.query(
        `INSERT INTO werwolf_rooms (code, state, seen) VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [state.code, JSON.stringify(state), JSON.stringify({ [state.hostId]: hostSeen })],
      );
      return rows.length === 1;
    },

    async read(code, touch) {
      await ensure();
      const rows = touch
        ? await sql.query(
            `WITH touched AS (
               UPDATE werwolf_rooms
               SET seen = jsonb_set(seen, ARRAY[$2::text], to_jsonb($3::bigint))
               WHERE code = $1
                 AND COALESCE((seen->>($2::text))::bigint, 0) < $3::bigint - $5::int
                 AND state->'players' @> jsonb_build_array(
                       jsonb_build_object('id', $2::text, 'tokenHash', $4::text))
             )
             SELECT version, state, seen FROM werwolf_rooms WHERE code = $1`,
            [code, touch.id, touch.now, touch.tokenHash, TOUCH_EVERY],
          )
        : await sql.query(`SELECT version, state, seen FROM werwolf_rooms WHERE code = $1`, [code]);
      const row = rows[0];
      if (!row) return null;
      return { state: row.state as GameState, version: row.version, seen: row.seen ?? {} };
    },

    async write(code, version, state) {
      await ensure();
      const rows = await sql.query(
        `UPDATE werwolf_rooms SET state = $3::jsonb, version = version + 1, updated_at = now()
         WHERE code = $1 AND version = $2 RETURNING version`,
        [code, version, JSON.stringify(state)],
      );
      return rows.length === 1;
    },
  };
}

/** Keeps rooms in this process. Only for local development without a database. */
function memoryStore(): Store {
  const g = globalThis as { __werwolfRooms?: Map<string, Room> };
  const rooms: Map<string, Room> = (g.__werwolfRooms ??= new Map());
  return {
    async create(state, hostSeen) {
      if (rooms.has(state.code)) return false;
      rooms.set(state.code, {
        state: structuredClone(state),
        version: 1,
        seen: { [state.hostId]: hostSeen },
      });
      return true;
    },
    async read(code, touch) {
      const room = rooms.get(code);
      if (!room) return null;
      const snapshot = structuredClone(room);
      if (
        touch &&
        room.state.players.some((p) => p.id === touch.id && p.tokenHash === touch.tokenHash)
      ) {
        room.seen[touch.id] = touch.now;
      }
      return snapshot;
    },
    async write(code, version, state) {
      const room = rooms.get(code);
      if (!room || room.version !== version) return false;
      room.state = structuredClone(state);
      room.version += 1;
      return true;
    },
  };
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (url) return (store = neonStore(url));
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set");
  }
  return (store = memoryStore());
}

export class RoomNotFound extends Error {}

/**
 * Read-modify-write with optimistic locking: if another player saved in
 * between, the change is recomputed on the fresh state.
 */
export async function mutate(
  code: string,
  change: (room: Room) => GameState,
): Promise<Room> {
  const db = getStore();
  for (let attempt = 0; attempt < 8; attempt++) {
    const room = await db.read(code);
    if (!room) throw new RoomNotFound();
    const next = change(room);
    if (await db.write(code, room.version, next)) {
      return { state: next, version: room.version + 1, seen: room.seen };
    }
  }
  throw new Error("Room is busy, could not save");
}
