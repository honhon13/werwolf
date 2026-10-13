import { transferHost } from "@/lib/game/engine";
import {
  credentialsFrom,
  type GuestResponse,
  handle,
  HOST_AWAY_AFTER,
  json,
  member,
  memberResponse,
  normalizeCode,
  nowSeconds,
  onlineIds,
} from "@/lib/server/api";
import { getStore, mutate, RoomNotFound, type Room } from "@/lib/server/store";

/** The first player who is online takes over when the host has left. */
function heir(room: Room, now: number): string | null {
  const { state, seen } = room;
  const hostSeen = seen[state.hostId] ?? Math.floor(state.createdAt / 1000);
  if (state.players.some((p) => p.id === state.hostId) && hostSeen >= now - HOST_AWAY_AFTER) {
    return null;
  }
  const online = onlineIds(room, now);
  return state.players.find((p) => online.has(p.id))?.id ?? null;
}

export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  return handle(async () => {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new RoomNotFound();
    const creds = credentialsFrom(request);
    const now = nowSeconds();
    let room = await getStore().read(code, creds ? { ...creds, now } : undefined);
    if (!room) throw new RoomNotFound();

    const me = member(room.state, creds);
    if (!me) {
      const guest: GuestResponse = {
        member: false,
        phase: room.state.phase,
        players: room.state.players.map((p) => p.name),
      };
      return json(guest);
    }

    if (heir(room, now) === me.id) {
      room = await mutate(code, (current) =>
        heir(current, now) === me.id ? transferHost(current.state, me.id) : current.state,
      );
    }
    const known = Number(new URL(request.url).searchParams.get("v"));
    return json(memberResponse(room, me.id, Number.isFinite(known) ? known : undefined));
  });
}
