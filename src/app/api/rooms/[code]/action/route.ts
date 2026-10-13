import { applyAction, GameError } from "@/lib/game/engine";
import type { Action } from "@/lib/game/types";
import {
  credentialsFrom,
  handle,
  json,
  member,
  memberResponse,
  normalizeCode,
  NotMember,
  readJson,
  rng,
} from "@/lib/server/api";
import { mutate, RoomNotFound } from "@/lib/server/store";

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/action">) {
  return handle(async () => {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new RoomNotFound();
    const creds = credentialsFrom(request);
    const { action } = await readJson(request);
    if (!creds) throw new NotMember();
    if (!action || typeof action !== "object") throw new GameError("Unbekannte Aktion.");

    const room = await mutate(code, (current) => {
      const me = member(current.state, creds);
      if (!me) throw new NotMember();
      return applyAction(current.state, me.id, action as Action, { now: Date.now(), rng });
    });
    return json(memberResponse(room, creds.id));
  });
}
