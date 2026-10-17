import { expireIfDue, isOverdue, transferHost } from "@/lib/game/engine";
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
  rng,
} from "@/lib/server/api";
import { getStore, mutate, RoomNotFound, type Room } from "@/lib/server/store";

/** The first player who is online takes over when the host has left. */
function heir(room: Room, now: number): string | null {
  const { state, seen } = room;
  const hostSeen = seen[state.hostId] ?? Math.floor(state.createdAt / 1000);
  if (state.players.some((p) => p.id === state.hostId && !p.left) && hostSeen >= now - HOST_AWAY_AFTER) {
    return null;
  }
  const online = onlineIds(room, now);
  return state.players.find((p) => online.has(p.id) && !p.left)?.id ?? null;
}

export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  return handle(async () => {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new RoomNotFound();
    const creds = credentialsFrom(request);
    const now = nowSeconds();
    let room = await getStore().read(code, creds ? { ...creds, now } : undefined);
    if (!room) throw new RoomNotFound();
    // Time is kept by the server: the first request after a deadline settles it for everybody.
    if (isOverdue(room.state, Date.now())) {
      room = await mutate(code, (current) => expireIfDue(current.state, { now: Date.now(), rng }));
    }

    const me = member(room.state, creds);
    if (!me) {
      const online = onlineIds(room, now);
      // Whoever left this round cannot take a seat back.
      const present = room.state.players.filter((p) => !p.left);
      const guest: GuestResponse = {
        member: false,
        phase: room.state.phase,
        players: present.map((p) => p.name),
        seats: present.map((p) => ({ id: p.id, name: p.name, online: online.has(p.id) })),
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
