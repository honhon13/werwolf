import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, newGame, requestRejoin } from "./engine";
import { ackAll, act, alive, ctx, fails, game, night, see, tasks, timeUp, toVote, votes } from "./test-helpers";

const D = "dorfbewohner" as const;

describe("night steps", () => {
  it("runs the steps in order and skips the ones nobody needs", () => {
    let s = game(["dieb", "werwolf", "amor", "hexe", D, D, D], { center: [D, D] });
    expect(s.night.step).toBe("dieb");
    s = night(s, "p0", "dieb", { option: "keep" });
    expect(s.night.step).toBe("erwachen");
    s = night(s, "p2", "amor", { targets: ["p4", "p5"] });
    expect(s.night.step).toBe("haupt");
    s = night(s, "p1", "wolf", { targets: ["p6"] });
    expect(s.night.step).toBe("hexe");
    s = night(s, "p3", "hexe", {});
    expect(s.night.ran).toEqual(["dieb", "erwachen", "haupt", "hexe"]);
    expect(s.phase).toBe("announce");
  });

  it("gives players without a task nothing to do, or a decoy in decoy mode", () => {
    const quiet = game(["werwolf", "seherin", D, D, D]);
    expect(tasks(quiet, "p2")).toEqual([]);
    expect(see(quiet, "p2").tasks).toEqual([]);

    let s = game(["werwolf", "seherin", "hexe", D, D], { decoy: true });
    expect(tasks(s, "p3")).toEqual(["suspect"]);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    expect(s.night.step).toBe("haupt");
    s = night(s, "p3", "suspect", { targets: ["p0"] });
    s = night(s, "p4", "suspect", { targets: ["p1"] });
    s = night(s, "p2", "suspect", { targets: ["p1"] });
    expect(s.night.step).toBe("hexe");
    expect(tasks(s, "p0")).toEqual(["sleep"]);
    for (const id of ["p0", "p1", "p3", "p4"]) s = night(s, id, "sleep");
    s = night(s, "p2", "hexe", {});
    expect(s.phase).toBe("announce");
  });

  it("hides at night who is still busy", () => {
    const s = game(["werwolf", "seherin", D, D, D], { decoy: true });
    expect(see(s, "p2").players.every((p) => !p.done)).toBe(true);
  });

  it("lets nobody act twice or after dying", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p1", "seherin", { targets: ["p2"] });
    fails(() => night(s, "p1", "seherin", { targets: ["p3"] }));
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = toVote(s);
    fails(() => act(s, "p1", { type: "vote", target: "p0" }), /ausgeschieden/);
    s = votes(s, { p0: null, p2: null, p3: null, p4: null });
    s = ackAll(s);
    expect(tasks(s, "p1")).toEqual([]);
    fails(() => night(s, "p1", "seherin", { targets: ["p0"] }), /ausgeschieden/);
  });
});

describe("day", () => {
  it("reveals ballots only when the time is up and they are counted", () => {
    let s = game(["werwolf", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p1", p1: "p0" });
    const view = see(s, "p2").vote!;
    expect(view.voted.sort()).toEqual(["p0", "p1"]);
    expect(JSON.stringify(see(s, "p2"))).not.toContain('"p0":"p1"');
    s = act(s, "p2", { type: "vote", target: "p0" });
    s = act(s, "p3", { type: "vote", target: "p0" });
    // Everybody has voted, but the votes may still change until the time is up.
    expect(s.phase).toBe("vote");
    expect(JSON.stringify(see(s, "p2"))).not.toContain('"p0":"p1"');
    s = timeUp(s);
    expect(s.announce!.ballots).toEqual({ p0: "p1", p1: "p0", p2: "p0", p3: "p0" });
  });

  it("holds one runoff on a tie and then spares everybody", () => {
    let s = game(["werwolf", D, D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = toVote(s);
    const tie = { p0: "p1", p1: "p2", p2: "p1", p3: "p2", p4: null };
    s = votes(s, tie);
    expect(s.vote).toMatchObject({ round: 2, candidates: ["p1", "p2"] });
    fails(() => act(s, "p0", { type: "vote", target: "p3" }));
    s = votes(s, tie);
    expect(s.announce).toMatchObject({ kind: "verdict", deaths: [], tie: true });
  });
});

describe("three players", () => {
  it("play the short round: nobody dies at night and the one vote decides", () => {
    let s = game(["werwolf", "seherin", D]);
    expect(s.mode).toBe("kurz");
    expect(tasks(s, "p0")).toEqual([]);
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    expect(s.announce).toMatchObject({ kind: "morning", deaths: [] });
    s = toVote(s);
    s = votes(s, { p0: "p1", p1: "p0", p2: "p0" });
    s = ackAll(s);
    expect(s.winner).toBe("dorf");
  });

  it("are won by the wolf when the vote misses or ties", () => {
    for (const ballots of [
      { p0: "p1", p1: "p0", p2: "p1" },
      { p0: "p1", p1: "p0", p2: null },
    ]) {
      let s = game(["werwolf", "seherin", D]);
      s = night(s, "p1", "seherin", { targets: ["p0"] });
      s = toVote(s);
      s = votes(s, ballots);
      if (s.phase === "vote") s = votes(s, ballots);
      s = ackAll(s);
      expect(s.winner).toBe("wolf");
      expect(s.round).toBe(1);
    }
  });

  it("tap along with a decoy when decoy mode is on", () => {
    const s = game(["werwolf", "seherin", D], { decoy: true });
    expect(tasks(s, "p0")).toEqual(["lurk"]);
    expect(tasks(s, "p2")).toEqual(["suspect"]);
  });
});

describe("four players", () => {
  it("always reach a vote: at most one player dies in the first night", () => {
    for (const victim of ["p1", "p2", "p3"]) {
      for (const shielded of ["p0", "p1", "p2", "p3"]) {
        let s = game(["werwolf", "seherin", "beschuetzer", D]);
        s = night(s, "p1", "seherin", { targets: ["p3"] });
        s = night(s, "p2", "beschuetzer", { targets: [shielded] });
        s = night(s, "p0", "wolf", { targets: [victim] });
        expect(s.announce!.deaths.length).toBeLessThanOrEqual(1);
        s = ackAll(s);
        expect(s.phase).toBe("vote");
      }
    }
  });
});

describe("robustness", () => {
  it("applies a repeated request only once", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = applyAction(s, "p1", { type: "night", task: "seherin", targets: ["p0"] }, ctx(), "a1");
    const again = applyAction(s, "p1", { type: "night", task: "seherin", targets: ["p0"] }, ctx(), "a1");
    expect(again).toBe(s);
    expect(see(again, "p1").notes).toHaveLength(1);
  });

  it("lets a player take their seat on a new device once the host agrees", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = requestRejoin(s, "p2", { id: "r1", tokenHash: "new" }, 1000);
    expect(see(s, "p0").rejoins).toEqual([{ id: "r1", name: "P2" }]);
    expect(see(s, "p1").rejoins).toEqual([]);
    fails(() => act(s, "p1", { type: "rejoin", request: "r1", accept: true }), /Spielleitung/);
    s = act(s, "p0", { type: "rejoin", request: "r1", accept: true });
    expect(s.players[2].tokenHash).toBe("new");
    expect(s.rejoins).toEqual([]);
  });

  it("lets the host skip a stuck step", () => {
    let s = game(["werwolf", "seherin", "hexe", D, D]);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = act(s, "p0", { type: "force" });
    expect(s.night.step).toBe("hexe");
    s = act(s, "p0", { type: "force" });
    expect(s.announce!.deaths).toEqual([{ id: "p3", cause: "wolf" }]);
    expect(alive(s, "p3")).toBe(false);
  });
});

describe("who the game waits for", () => {
  const waiting = (s: Parameters<typeof see>[0], id = "p0") => see(s, id).progress.waiting;

  it("names who has not looked at their role yet, in seat order", () => {
    let s = newGame("TEST", 0);
    for (let i = 0; i < 5; i++) s = addPlayer(s, { id: `p${i}`, name: `P${i}`, tokenHash: `t${i}` });
    s = applyAction(s, "p0", { type: "start" }, ctx());
    expect(waiting(s)).toEqual(["P0", "P1", "P2", "P3", "P4"]);
    s = act(s, "p3", { type: "ack" });
    s = act(s, "p0", { type: "ack" });
    expect(waiting(s)).toEqual(["P1", "P2", "P4"]);
    expect(see(s, "p4").progress).toMatchObject({ done: 2, total: 5, waiting: ["P1", "P2", "P4"] });
  });

  it("keeps it secret at night who is still busy", () => {
    let s = game(["werwolf", "seherin", D, D, D], { decoy: true });
    expect(waiting(s)).toBeNull();
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    expect(see(s, "p2").progress).toMatchObject({ done: 1, total: 5, waiting: null });
  });

  it("names who has not confirmed the morning or not yet voted", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    expect(waiting(s)).toEqual(["P0", "P1", "P2", "P3"]);
    s = ackAll(s);
    s = act(s, "p1", { type: "vote", target: "p0" });
    expect(waiting(s, "p4")).toEqual(["P0", "P2", "P3"]);
  });

  it("names only those who may vote and have not yet", () => {
    let s = game(["werwolf", "idiot", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = toVote(s);
    s = votes(s, { p0: "p1", p2: "p1", p3: "p1", p4: "p1" });
    expect(waiting(s)).toEqual(["P1"]);
    s = timeUp(act(s, "p1", { type: "vote", target: "p0" }));
    s = ackAll(ackAll(s));
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    // The exposed Dorfdepp has no vote, so nobody waits for him.
    expect(waiting(s)).toEqual(["P0", "P2", "P3"]);
    s = act(s, "p2", { type: "leave" });
    expect(waiting(s)).toEqual(["P0", "P3"]);
  });

  it("names the one who has to choose for everybody", () => {
    let s = game(["werwolf", "jaeger", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = ackAll(s);
    expect(s.phase).toBe("hunter");
    expect(waiting(s, "p2")).toEqual(["P1"]);
  });
});

describe("history", () => {
  it("keeps secret actions hidden until the game is over", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    const during = see(s, "p2").history.map((h) => h.text).join(" ");
    expect(during).toContain("P1 wurde von den Wölfen erwischt");
    expect(during).not.toContain("Seherin sah");
    s = toVote(s);
    s = votes(s, { p0: "p2", p2: "p0", p3: "p0", p4: "p0" });
    s = ackAll(s);
    expect(s.phase).toBe("ended");
    const after = see(s, "p2").history.map((h) => h.text).join(" ");
    expect(after).toContain("Die Seherin sah P0: Werwolf.");
  });
});
