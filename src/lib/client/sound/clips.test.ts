import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ackAll, act, game, night, see, toVote, votes } from "../../game/test-helpers";
import type { View } from "../../game/types";
import { CLIP_FORMATS, CLIPS, clipFor } from "./clips";

const folder = path.join(process.cwd(), "public/audio/sprache");

describe("narrator recordings", () => {
  it("has a file for every clip and no file with a misspelt name", () => {
    const expected = Object.values(CLIPS).sort();
    const files = readdirSync(folder).filter((f) => !f.startsWith("."));
    for (const file of files) {
      const { name, ext } = path.parse(file);
      expect(expected, `unknown file ${file}`).toContain(name);
      expect(CLIP_FORMATS as readonly string[], `format of ${file}`).toContain(ext.slice(1));
    }
    expect([...new Set(files.map((f) => path.parse(f).name))].sort()).toEqual(expected);
  });
});

describe("clipFor", () => {
  const D = "dorfbewohner" as const;

  it("follows the night: nightfall, the Hexe, and silence in between", () => {
    let s = game(["werwolf", "amor", "hexe", D, D, D]);
    expect(clipFor(see(s, "p3"))).toBe("nachtErste");
    s = night(s, "p1", "amor", { targets: ["p3", "p4"] });
    expect(clipFor(see(s, "p3"))).toBeNull();
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    expect(clipFor(see(s, "p3"))).toBe("hexe");
    s = night(s, "p2", "hexe", {});
    expect(clipFor(see(s, "p3"))).toBe("morgenOpfer");
    s = toVote(s);
    expect(clipFor(see(s, "p3"))).toBe("diskussion");
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null });
    expect(clipFor(see(s, "p3"))).toBe("urteilNiemand");
    s = ackAll(s);
    expect(clipFor(see(s, "p3"))).toBe("nacht");
  });

  it("has a recording for every ending", () => {
    const base = see(game(["werwolf", D, D, D, D]), "p1");
    const ended = (winner: NonNullable<View["ended"]>["winner"]): View => ({
      ...base,
      phase: "ended",
      ended: { winner, winners: [], noses: [], center: [] },
    });
    const winners = ["dorf", "wolf", "paar", "niemand", "floetenspieler", "weisserWolf", "engel"] as const;
    expect(winners.map((w) => clipFor(ended(w)))).toEqual([
      "siegDorf",
      "siegWerwoelfe",
      "siegLiebespaar",
      "siegNiemand",
      "siegFloetenspieler",
      "siegWeisserWerwolf",
      "siegEngel",
    ]);
  });

  it("follows the Hauptmann from the election to his successor", () => {
    let s = game(["werwolf", D, D, D, D, D], { captain: true });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = ackAll(s);
    expect(clipFor(see(s, "p1"))).toBe("hauptmannwahl");
    s = votes(s, { p0: "p1", p1: "p1", p2: "p2", p3: "p2", p4: null });
    expect(clipFor(see(s, "p1"))).toBe("stichwahl");
    s = votes(s, { p0: "p1", p1: "p1", p2: "p1", p3: "p2", p4: "p2" });
    expect(clipFor(see(s, "p1"))).toBe("hauptmannGewaehlt");
    s = ackAll(ackAll(s));
    s = votes(s, { p0: "p1", p1: "p0", p2: "p1", p3: "p1", p4: "p1" });
    expect(clipFor(see(s, "p2"))).toBe("urteilVerbannt");
    s = ackAll(s);
    expect(clipFor(see(s, "p2"))).toBe("hauptmannNachfolge");
    s = act(s, "p1", { type: "choose", targets: ["p2"] });
    expect(clipFor(see(s, "p2"))).toBe("hauptmannNeu");
  });

  it("lets the Sündenbock speak after a tie", () => {
    let s = game(["werwolf", "suendenbock", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p2", p1: "p3", p2: "p3", p3: "p2" });
    expect(clipFor(see(s, "p2"))).toBe("urteilVerbannt");
    s = ackAll(s);
    expect(clipFor(see(s, "p2"))).toBe("suendenbock");
    s = act(s, "p1", { type: "choose", targets: ["p2", "p3"] });
    expect(clipFor(see(s, "p2"))).toBe("suendenbockEntschieden");
  });

  it("has its own recording for the Dorfdepp who stays", () => {
    let s = game(["werwolf", "idiot", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p1", p1: "p0", p2: "p1", p3: "p1" });
    expect(clipFor(see(s, "p2"))).toBe("urteilDorfdepp");
  });

  it("plays the Jäger before and after his shot", () => {
    let s = game(["werwolf", "jaeger", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = ackAll(s);
    expect(clipFor(see(s, "p2"))).toBe("jaeger");
    s = act(s, "p1", { type: "choose", targets: ["p2"] });
    expect(clipFor(see(s, "p3"))).toBe("jaegerSchuss");
  });
});
