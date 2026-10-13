import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, newGame } from "../../game/engine";
import type { GameState, View } from "../../game/types";
import { viewFor } from "../../game/view";
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
  const ctx = { now: 0, rng: () => 0.5 };
  const see = (s: GameState) => viewFor(s, "p0", { now: 0, online: new Set() })!;

  function started(): GameState {
    let s = newGame("TEST", 0);
    for (let i = 0; i < 4; i++) s = addPlayer(s, { id: `p${i}`, name: `S${i}`, tokenHash: "x" });
    return applyAction(s, "p0", { type: "start" }, ctx);
  }

  it("stays silent in the lobby and follows the game from there", () => {
    const lobby = addPlayer(newGame("TEST", 0), { id: "p0", name: "A", tokenHash: "x" });
    expect(clipFor(see(lobby))).toBeNull();
    let s = started();
    expect(clipFor(see(s))).toBe("rollen");
    for (const p of s.players) s = applyAction(s, p.id, { type: "ack" }, ctx);
    expect(clipFor(see(s))).toBe("nachtErste");
    expect(clipFor({ ...see(s), round: 2 })).toBe("nacht");
  });

  it("tells a quiet morning from one with victims, and each kind of ending", () => {
    const base = see(started());
    const announce = (kind: "morning" | "verdict" | "hunter", deaths: number): View => ({
      ...base,
      phase: "announce",
      announce: {
        kind,
        next: "night",
        deaths: Array.from({ length: deaths }, () => ({ id: "p1", cause: "wolf" as const })),
      },
    });
    expect(clipFor(announce("morning", 0))).toBe("morgenRuhig");
    expect(clipFor(announce("morning", 2))).toBe("morgenOpfer");
    expect(clipFor(announce("verdict", 1))).toBe("urteilVerbannt");
    expect(clipFor(announce("verdict", 0))).toBe("urteilNiemand");
    expect(clipFor(announce("hunter", 1))).toBe("jaegerSchuss");

    const vote = (round: 1 | 2): View => ({
      ...base,
      phase: "vote",
      vote: { round, candidates: null, voted: [], myBallot: undefined, previous: null },
    });
    expect(clipFor(vote(1))).toBe("abstimmung");
    expect(clipFor(vote(2))).toBe("stichwahl");

    const ended = (winner: "dorf" | "wolf" | "paar" | "niemand"): View => ({
      ...base,
      phase: "ended",
      ended: { winner, noses: [] },
    });
    expect((["dorf", "wolf", "paar", "niemand"] as const).map((w) => clipFor(ended(w)))).toEqual([
      "siegDorf",
      "siegWerwoelfe",
      "siegLiebespaar",
      "siegNiemand",
    ]);
  });
});
