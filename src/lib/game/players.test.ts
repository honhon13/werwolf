import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, newGame, requestRejoin, seatOf } from "./engine";
import { ackAll, act, alive, fails, game, night, see, tasks, toVote, votes } from "./test-helpers";
import type { GameState } from "./types";

const D = "dorfbewohner" as const;
const leave = (s: GameState, id: string) => act(s, id, { type: "leave" });
const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

describe("leaving the lobby", () => {
  it("removes the player and hands the room to the next one", () => {
    let s = newGame("TEST", 0);
    for (const id of ["a", "b", "c"]) s = addPlayer(s, { id, name: id.toUpperCase(), tokenHash: `t${id}` });
    s = applyAction(s, "a", { type: "leave" }, { now: 0, rng: () => 0.5 });
    expect(s.players.map((p) => p.id)).toEqual(["b", "c"]);
    expect(s.hostId).toBe("b");
  });
});

describe("leaving a running game", () => {
  it("takes the player out, shows their role to everybody and frees the device", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p3");
    expect(player(s, "p3")).toMatchObject({ alive: false, left: true, tokenHash: "" });
    const other = see(s, "p1").players.find((p) => p.id === "p3")!;
    expect(other).toMatchObject({ left: true, alive: false, role: "dorfbewohner" });
    expect(see(s, "p1").history.at(-1)?.text).toBe("P3 hat das Spiel verlassen (Dorfbewohner).");
    fails(() => leave(s, "p3"), /verlassen/);
    fails(() => night(s, "p3", "suspect", { targets: ["p0"] }), /verlassen/);
  });

  it("keeps everybody else's role secret", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p3");
    const view = see(s, "p2");
    expect(view.players.filter((p) => p.id !== "p2" && p.id !== "p3").every((p) => p.role === null)).toBe(true);
  });

  it("moves the night on when it was only waiting for the leaver", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    expect(s.phase).toBe("night");
    s = leave(s, "p1");
    expect(s.phase).toBe("announce");
    expect(s.announce?.deaths).toEqual([{ id: "p4", cause: "wolf" }]);
  });

  it("lets the pack choose again when their victim leaves during the night", () => {
    let s = game(["werwolf", "werwolf", "seherin", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p6"] });
    s = night(s, "p1", "wolf", { targets: ["p6"] });
    expect(s.night.victim).toBe("p6");
    s = leave(s, "p6");
    expect(s.night.victim).toBeNull();
    expect(see(s, "p0").tasks.find((t) => t.id === "wolf")).toMatchObject({ done: false });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = night(s, "p1", "wolf", { targets: ["p5"] });
    s = night(s, "p2", "seherin", { targets: ["p0"] });
    expect(s.announce?.deaths).toEqual([{ id: "p5", cause: "wolf" }]);
  });

  it("settles the pack when the only wolf who disagreed leaves", () => {
    let s = game(["werwolf", "werwolf", "werwolf", "seherin", D, D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p8"] });
    s = night(s, "p1", "wolf", { targets: ["p8"] });
    s = night(s, "p2", "wolf", { targets: ["p7"] });
    expect(s.night.victim).toBeNull();
    s = leave(s, "p2");
    expect(s.night.victim).toBe("p8");
    expect(tasks(s, "p0")).toEqual(["wolf"]);
    expect(see(s, "p0").tasks[0].done).toBe(true);
  });

  it("drops votes by and for the leaver; their voters vote again", () => {
    let s = game(["werwolf", "seherin", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    s = toVote(s);
    s = votes(s, { p0: "p3", p1: "p3", p3: "p0" });
    s = leave(s, "p3");
    expect(s.vote.ballots).toEqual({});
    expect(s.phase).toBe("vote");
    s = votes(s, { p0: "p2", p1: "p0", p2: "p0", p4: "p0" });
    expect(s.announce?.deaths).toEqual([{ id: "p0", cause: "vote" }]);
    expect(ackAll(s).winner).toBe("dorf");
  });

  it("does not keep the others waiting to confirm", () => {
    let s = game(["werwolf", "seherin", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    for (const id of ["p0", "p1", "p2", "p3"]) s = act(s, id, { type: "ack" });
    expect(s.phase).toBe("announce");
    s = leave(s, "p4");
    expect(s.phase).toBe("vote");
  });

  it("drops the Jäger's last shot when he leaves instead", () => {
    let s = game(["werwolf", "jaeger", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = ackAll(s);
    expect(s.phase).toBe("hunter");
    s = leave(s, "p1");
    expect(s.phase).toBe("vote");
    expect([2, 3, 4].every((i) => alive(s, `p${i}`))).toBe(true);
  });

  it("passes the Hauptmann's title on by lot", () => {
    let s = game(["werwolf", "seherin", D, D, D, D], { captain: true });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    s = ackAll(s);
    s = votes(s, { p0: "p2", p1: "p2", p2: "p2", p3: "p2", p4: "p2" });
    expect(s.captain).toBe("p2");
    s = leave(s, "p2");
    expect(s.captain).not.toBe("p2");
    expect(alive(s, s.captain!)).toBe(true);
    expect(s.history.at(-1)?.text).toMatch(/ist jetzt Hauptmann \(durch Los\)/);
  });

  it("lets a dead Hauptmann who leaves pass the title on by lot", () => {
    let s = game(["werwolf", "seherin", D, D, D, D], { captain: true });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    s = ackAll(s);
    s = votes(s, { p0: "p2", p1: "p2", p2: "p2", p3: "p2", p4: "p2" });
    s = ackAll(ackAll(s));
    s = votes(s, { p0: "p2", p1: "p2", p2: "p0", p3: "p2", p4: "p1" });
    s = ackAll(s);
    expect(s.phase).toBe("succession");
    s = leave(s, "p2");
    expect(s.phase).toBe("night");
    expect(alive(s, s.captain!)).toBe(true);
  });

  it("lets everybody vote when the Sündenbock leaves before choosing", () => {
    let s = game(["werwolf", "suendenbock", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p2", p1: "p3", p2: "p3", p3: "p2" });
    s = ackAll(s);
    expect(s.phase).toBe("scapegoat");
    s = leave(s, "p1");
    expect(s.phase).toBe("night");
    expect(s.voters).toBeNull();
  });

  it("breaks the bond of the lovers instead of taking the partner along", () => {
    let s = game(["werwolf", "amor", "seherin", D, D, D]);
    s = night(s, "p1", "amor", { targets: ["p3", "p4"] });
    s = leave(s, "p3");
    expect(s.lovers).toBeNull();
    expect(alive(s, "p4")).toBe(true);
    expect(see(s, "p4").me.loverId).toBeNull();
  });

  it("ends the game at once when nobody is left to beat", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p0");
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe("dorf");
  });

  it("hands the room on when the host leaves", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p0");
    expect(s.hostId).toBe("p1");
    expect(see(s, "p1").me.host).toBe(true);
  });

  it("keeps a leaver in the final overview and drops them for the next round", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p2");
    s = leave(s, "p0");
    expect(s.phase).toBe("ended");
    s = leave(s, "p4");
    expect(player(s, "p4")).toMatchObject({ left: true, alive: true, tokenHash: "" });
    expect(see(s, "p1").players).toHaveLength(5);
    s = act(s, "p1", { type: "again" });
    expect(s.players.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(s.players.every((p) => !p.left && p.alive && p.role === null)).toBe(true);
  });
});

describe("one seat per device", () => {
  it("refuses a second seat for the same device", () => {
    let s = newGame("TEST", 0);
    s = addPlayer(s, { id: "a", name: "Anna", tokenHash: "device-1" });
    fails(() => addPlayer(s, { id: "b", name: "Ben", tokenHash: "device-1" }), /schon in diesem Raum/);
    expect(seatOf(s, "device-1")?.id).toBe("a");
    expect(seatOf(s, "")).toBeUndefined();
  });

  it("forgets the device of a player who left, so it cannot slip back into the round", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p3");
    expect(seatOf(s, "t3")).toBeUndefined();
    fails(() => addPlayer(s, { id: "x", name: "Neu", tokenHash: "t3" }), /läuft schon/);
  });

  it("does not hand a seat to a device that already has one", () => {
    const s = game(["werwolf", "seherin", D, D, D]);
    fails(() => requestRejoin(s, "p2", { id: "r1", tokenHash: "t3" }, 1000), /schon mit/);
    expect(requestRejoin(s, "p3", { id: "r1", tokenHash: "t3" }, 1000).rejoins).toEqual([]);
    fails(() => requestRejoin(leave(s, "p4"), "p4", { id: "r1", tokenHash: "new" }, 1000), /verlassen/);
  });

  it("checks again when the host lets a device in", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = requestRejoin(s, "p2", { id: "r1", tokenHash: "new" }, 1000);
    s.players.find((p) => p.id === "p4")!.tokenHash = "new";
    fails(() => act(s, "p0", { type: "rejoin", request: "r1", accept: true }), /schon einen Platz/);
  });
});

describe("seats around the fire", () => {
  const order = (s: GameState) => s.players.map((p) => p.id);

  it("stay where they were when somebody takes their seat on a new device", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    const seats = order(s);
    s = requestRejoin(s, "p2", { id: "r1", tokenHash: "new-device" }, 1000);
    s = act(s, "p0", { type: "rejoin", request: "r1", accept: true });
    expect(order(s)).toEqual(seats);
    expect(see(s, "p4").players.map((p) => p.id)).toEqual(seats);
  });

  it("keep the place of whoever is out, so nobody else moves", () => {
    let s = game(["werwolf", "seherin", D, D, D, D]);
    const seats = order(s);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    s = leave(s, "p5");
    expect(order(s)).toEqual(seats);
    const view = see(s, "p2");
    expect(view.players.map((p) => [p.id, p.alive])).toEqual([
      ["p0", true],
      ["p1", true],
      ["p2", true],
      ["p3", false],
      ["p4", true],
      ["p5", false],
    ]);
  });

  it("are dealt again only for a new round, without whoever left", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = leave(s, "p2");
    s = leave(s, "p0");
    expect(s.phase).toBe("ended");
    s = act(s, "p1", { type: "again" });
    expect(order(s)).toEqual(["p1", "p3", "p4"]);
  });
});

