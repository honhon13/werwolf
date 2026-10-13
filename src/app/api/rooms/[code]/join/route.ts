import { addPlayer } from "@/lib/game/engine";
import { handle, json, newCredentials, normalizeCode, readJson } from "@/lib/server/api";
import { mutate, RoomNotFound } from "@/lib/server/store";

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new RoomNotFound();
    const body = await readJson(request);
    const creds = newCredentials();
    await mutate(code, (room) => addPlayer(room.state, { ...creds, name: String(body.name ?? "") }));
    return json({ code, id: creds.id, token: creds.token });
  });
}
