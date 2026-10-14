import { randomBytes } from "node:crypto";
import { requestRejoin } from "@/lib/game/engine";
import { handle, json, newCredentials, normalizeCode, readJson } from "@/lib/server/api";
import { mutate, RoomNotFound } from "@/lib/server/store";

/**
 * A player on a new device asks for their seat back. The token handed out
 * here only starts to work once the host has accepted the request.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/rejoin">) {
  return handle(async () => {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new RoomNotFound();
    const { playerId } = await readJson(request);
    const seat = String(playerId ?? "");
    const { token, tokenHash } = newCredentials();
    const requestId = randomBytes(8).toString("base64url");
    await mutate(code, (room) => requestRejoin(room.state, seat, { id: requestId, tokenHash }, Date.now()));
    return json({ code, id: seat, token });
  });
}
