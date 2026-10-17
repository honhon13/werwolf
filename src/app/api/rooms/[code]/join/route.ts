import { addPlayer, seatOf } from "@/lib/game/engine";
import { deviceFrom, handle, json, newCredentials, normalizeCode, readJson } from "@/lib/server/api";
import { mutate, RoomNotFound } from "@/lib/server/store";

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new RoomNotFound();
    const body = await readJson(request);
    const creds = newCredentials(deviceFrom(body));
    let id = creds.id;
    // A device that already has a seat gets it back instead of a second one,
    // also when two requests arrive at once: the second sees the first's seat.
    await mutate(code, (room) => {
      const mine = seatOf(room.state, creds.tokenHash);
      id = mine?.id ?? creds.id;
      return mine ? room.state : addPlayer(room.state, { ...creds, name: String(body.name ?? "") });
    });
    return json({ code, id, token: creds.token });
  });
}
