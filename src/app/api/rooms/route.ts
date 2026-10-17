import { addPlayer, cleanName, newGame } from "@/lib/game/engine";
import { deviceFrom, fail, handle, json, newCode, newCredentials, nowSeconds, readJson } from "@/lib/server/api";
import { getStore } from "@/lib/server/store";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const name = cleanName(body.name);
    const creds = newCredentials(deviceFrom(body));
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const state = addPlayer(newGame(code, Date.now()), { ...creds, name });
      if (await getStore().create(state, nowSeconds())) {
        return json({ code, id: creds.id, token: creds.token });
      }
    }
    return fail("Gerade ist kein Raum frei. Versuch es noch einmal.", 503);
  });
}
