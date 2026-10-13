import { describe, expect, it } from "vitest";
import { ackers, addPlayer, applyAction, GameError, newGame, nightTask } from "./engine";
import type { Action, GameState, RoleId } from "./types";
import { viewFor } from "./view";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctx = (rng = mulberry32(1), now = 1000) => ({ now, rng });

/** A game past the role reveal with exactly the given roles, p0 is host. */
function setup(roles: RoleId[]): GameState {
  let s = newGame("TEST", 0);
  roles.forEach((_, i) => {
    s = addPlayer(s, { id: `p${i}`, name: `Spieler ${i}`, tokenHash: `h${i}` });
  });
  s = applyAction(s, "p0", { type: "settings", settings: { auto: false } }, ctx());
  s = applyAction(
    s,
    "p0",
    {
      type: "settings",
      settings: {
        custom: {
          wolves: roles.filter((r) => r === "werwolf").length,
          seherin: roles.includes("seherin"),
          hexe: roles.includes("hexe"),
          jaeger: roles.includes("jaeger"),
          amor: roles.includes("amor"),
        },
      },
    },
    ctx(),
  );
  s = applyAction(s, "p0", { type: "start" }, ctx());
  expect([...s.players.map((p) => p.role)].sort()).toEqual([...roles].sort());
  s.players.forEach((p, i) => (p.role = roles[i]));
  for (const p of s.players) s = applyAction(s, p.id, { type: "ack" }, ctx());
  expect(s.phase).toBe("night");
  return s;
}

const act = (s: GameState, id: string, action: Action) => applyAction(s, id, action, ctx());

function ackAll(s: GameState): GameState {
  const phase = s.phase;
  for (const p of s.players) {
    if (s.phase !== phase) break;
    try {
      s = act(s, p.id, { type: "ack" });
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
    }
  }
  return s;
}

/** Lets everyone without a night action tap somebody. */
function sleepers(s: GameState): GameState {
  for (const p of s.players) {
    if (s.phase !== "night") break;
    if (p.alive && nightTask(s, p) === "suspect" && !(p.id in s.night.suspects)) {
      const target = s.players.find((t) => t.alive && t.id !== p.id)!;
      s = act(s, p.id, { type: "suspect", target: target.id });
    }
  }
  return s;
}

describe("night", () => {
  it("kills the wolves' victim when nobody intervenes", () => {
    let s = setup(["werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p0", { type: "wolfVote", target: "p1" });
    s = sleepers(s);
    expect(s.phase).toBe("announce");
    expect(s.announce).toMatchObject({ kind: "morning", deaths: [{ id: "p1", cause: "wolf" }] });
    expect(s.players[1].alive).toBe(false);
  });

  it("waits until all wolves agree", () => {
    let s = setup(["werwolf", "werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = sleepers(s);
    s = act(s, "p0", { type: "wolfVote", target: "p2" });
    s = act(s, "p1", { type: "wolfVote", target: "p3" });
    expect(s.phase).toBe("night");
    s = act(s, "p1", { type: "wolfVote", target: "p2" });
    expect(s.phase).toBe("announce");
    expect(s.players[2].alive).toBe(false);
  });

  it("does not let wolves eat each other", () => {
    const s = setup(["werwolf", "werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    expect(() => act(s, "p0", { type: "wolfVote", target: "p1" })).toThrow(GameError);
  });

  it("lets the witch heal the victim and poison someone else", () => {
    let s = setup(["werwolf", "hexe", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p0", { type: "wolfVote", target: "p2" });
    s = sleepers(s);
    expect(s.phase).toBe("witch");
    expect(viewFor(s, "p1", { now: 0, online: new Set() })!.witch).toMatchObject({
      isWitch: true,
      victim: "p2",
      canHeal: true,
    });
    expect(viewFor(s, "p3", { now: 0, online: new Set() })!.witch!.victim).toBeNull();
    s = act(s, "p1", { type: "witch", heal: true, poison: "p3" });
    expect(s.phase).toBe("witch");
    s = ackAll(s);
    expect(s.phase).toBe("announce");
    expect(s.announce!.deaths).toEqual([{ id: "p3", cause: "gift" }]);
    expect(s.players[2].alive).toBe(true);
    expect(s.potions).toEqual({ heal: false, poison: false });
  });

  it("lets the seer look at exactly one role per night", () => {
    let s = setup(["werwolf", "seherin", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p1", { type: "seerPeek", target: "p0" });
    expect(s.seerLog).toEqual([{ round: 1, target: "p0", role: "werwolf" }]);
    expect(() => act(s, "p1", { type: "seerPeek", target: "p2" })).toThrow(GameError);
  });
});

describe("lovers and hunter", () => {
  it("takes the lover along and lets the hunter shoot", () => {
    let s = setup(["werwolf", "amor", "jaeger", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p1", { type: "amorPick", a: "p2", b: "p3" });
    s = act(s, "p0", { type: "wolfVote", target: "p3" });
    s = sleepers(s);
    expect(s.announce!.deaths).toEqual([
      { id: "p3", cause: "wolf" },
      { id: "p2", cause: "liebe" },
    ]);
    s = ackAll(s);
    expect(s.phase).toBe("hunter");
    expect(() => act(s, "p4", { type: "hunterShoot", target: "p0" })).toThrow(GameError);
    s = act(s, "p2", { type: "hunterShoot", target: "p0" });
    expect(s.announce).toMatchObject({ kind: "hunter", deaths: [{ id: "p0", cause: "jaeger" }] });
    s = ackAll(s);
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe("dorf");
  });

  it("hides all roles from a hunter who still has to aim", () => {
    let s = setup(["werwolf", "jaeger", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p0", { type: "wolfVote", target: "p1" });
    s = sleepers(s);
    const hunter = viewFor(s, "p1", { now: 0, online: new Set() })!;
    expect(hunter.players.filter((p) => p.id !== "p1").every((p) => p.role === null)).toBe(true);
  });

  it("lets a mixed couple win when only they are left", () => {
    let s = setup(["werwolf", "amor", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p1", { type: "amorPick", a: "p0", b: "p2" });
    s = act(s, "p0", { type: "wolfVote", target: "p1" });
    s = sleepers(s);
    s = ackAll(s);
    expect(s.phase).toBe("discussion");
    s = ackAll(s);
    expect(s.phase).toBe("vote");
    s = act(s, "p0", { type: "vote", target: "p3" });
    s = act(s, "p2", { type: "vote", target: "p3" });
    s = act(s, "p3", { type: "vote", target: "p0" });
    s = ackAll(s);
    expect(s.winner).toBe("paar");
  });
});

describe("endings", () => {
  it("ends without a winner when the last shot leaves nobody alive", () => {
    let s = setup(["werwolf", "jaeger", "amor", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p2", { type: "amorPick", a: "p0", b: "p3" });
    s = act(s, "p0", { type: "wolfVote", target: "p2" });
    s = sleepers(s);
    s = ackAll(s);
    s = ackAll(s);
    for (const id of ["p0", "p1", "p3"]) s = act(s, id, { type: "vote", target: "p4" });
    s = act(s, "p4", { type: "vote", target: null });
    s = ackAll(s);
    expect(s.phase).toBe("night");
    s = act(s, "p0", { type: "wolfVote", target: "p1" });
    s = sleepers(s);
    s = ackAll(s);
    expect(s.phase).toBe("hunter");
    s = act(s, "p1", { type: "hunterShoot", target: "p0" });
    expect(s.players.every((p) => !p.alive)).toBe(true);
    s = ackAll(s);
    expect(s.winner).toBe("niemand");
  });

  it("lets the wolves win as soon as they are not outnumbered", () => {
    let s = setup(["werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p0", { type: "wolfVote", target: "p1" });
    s = sleepers(s);
    s = ackAll(s);
    s = ackAll(s);
    s = act(s, "p0", { type: "vote", target: "p2" });
    s = act(s, "p2", { type: "vote", target: "p3" });
    s = act(s, "p3", { type: "vote", target: "p2" });
    s = ackAll(s);
    expect(s.winner).toBe("wolf");
  });

  it("returns to the lobby with the same players for another round", () => {
    let s = setup(["werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    expect(() => act(s, "p1", { type: "abort" })).toThrow(GameError);
    s = act(s, "p0", { type: "abort" });
    expect(s.phase).toBe("lobby");
    expect(s.players.map((p) => [p.role, p.alive])).toEqual(Array(4).fill([null, true]));
  });
});

describe("short round with three players", () => {
  const trio: RoleId[] = ["werwolf", "seherin", "dorfbewohner"];

  /** Through the night and the morning, up to the one vote. */
  function toVote(): GameState {
    let s = setup(trio);
    s = act(s, "p1", { type: "seerPeek", target: "p0" });
    s = act(s, "p0", { type: "suspect", target: "p2" });
    s = act(s, "p2", { type: "suspect", target: "p0" });
    expect(s.announce).toMatchObject({ kind: "morning", deaths: [] });
    s = ackAll(s);
    expect(s.phase).toBe("discussion");
    s = ackAll(s);
    expect(s.phase).toBe("vote");
    return s;
  }

  it("deals wolf, seer and villager whatever the settings say", () => {
    let s = newGame("TEST", 0);
    for (let i = 0; i < 3; i++) s = addPlayer(s, { id: `p${i}`, name: `S${i}`, tokenHash: "x" });
    s = act(s, "p0", { type: "settings", settings: { auto: false, custom: { wolves: 1, hexe: true, amor: true } } });
    expect(viewFor(s, "p0", { now: 0, online: new Set() })!.short).toBe(true);
    s = act(s, "p0", { type: "start" });
    expect(s.short).toBe(true);
    expect(s.players.map((p) => p.role).sort()).toEqual([...trio].sort());

    const four = setup(["werwolf", "seherin", "dorfbewohner", "dorfbewohner"]);
    expect(four.short).toBe(false);
  });

  it("lets nobody die at night: the wolf only taps along", () => {
    const s = setup(trio);
    expect(nightTask(s, s.players[0])).toBe("lurk");
    expect(viewFor(s, "p0", { now: 0, online: new Set() })!.night).toMatchObject({
      task: "suspect",
      lurking: true,
    });
    expect(viewFor(s, "p2", { now: 0, online: new Set() })!.night!.lurking).toBe(false);
    expect(() => act(s, "p0", { type: "wolfVote", target: "p1" })).toThrow(GameError);
    const morning = toVote();
    expect(morning.players.every((p) => p.alive)).toBe(true);
    // The wolf's tap is not counted as a guess at who the wolf is.
    expect(morning.suspicions.map((t) => t.by)).toEqual(["p2"]);
  });

  it("is won by the village when the one vote hits the wolf", () => {
    let s = toVote();
    s = act(s, "p0", { type: "vote", target: "p1" });
    s = act(s, "p1", { type: "vote", target: "p0" });
    s = act(s, "p2", { type: "vote", target: "p0" });
    s = ackAll(s);
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe("dorf");
  });

  it("is won by the wolf when the vote hits somebody else", () => {
    let s = toVote();
    s = act(s, "p0", { type: "vote", target: "p1" });
    s = act(s, "p1", { type: "vote", target: "p0" });
    s = act(s, "p2", { type: "vote", target: "p1" });
    s = ackAll(s);
    expect(s.winner).toBe("wolf");
  });

  it("is won by the wolf when the village cannot agree, without a second night", () => {
    let s = toVote();
    for (let round = 0; round < 2; round++) {
      s = act(s, "p0", { type: "vote", target: "p1" });
      s = act(s, "p1", { type: "vote", target: "p0" });
      s = act(s, "p2", { type: "vote", target: null });
    }
    expect(s.announce).toMatchObject({ kind: "verdict", deaths: [], tie: true });
    s = ackAll(s);
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe("wolf");
    expect(s.round).toBe(1);
  });

  it("is an ordinary game again once a fourth player joins", () => {
    let s = toVote();
    s = act(s, "p0", { type: "abort" });
    expect(s.short).toBe(false);
    s = addPlayer(s, { id: "p3", name: "Vier", tokenHash: "x" });
    s = act(s, "p0", { type: "start" });
    expect(s.short).toBe(false);
    s = ackAll(s);
    const wolf = s.players.find((p) => p.role === "werwolf")!;
    expect(nightTask(s, wolf)).toBe("wolf");
  });
});

describe("day", () => {
  function toVote(): GameState {
    let s = setup(["werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p0", { type: "wolfVote", target: "p5" });
    s = sleepers(s);
    s = ackAll(s);
    s = ackAll(s);
    expect(s.phase).toBe("vote");
    return s;
  }

  it("banishes the player with the most votes", () => {
    let s = toVote();
    s = act(s, "p0", { type: "vote", target: "p1" });
    s = act(s, "p1", { type: "vote", target: "p0" });
    s = act(s, "p2", { type: "vote", target: "p0" });
    s = act(s, "p3", { type: "vote", target: null });
    s = act(s, "p4", { type: "vote", target: "p0" });
    expect(s.announce).toMatchObject({ kind: "verdict", deaths: [{ id: "p0", cause: "vote" }] });
    s = ackAll(s);
    expect(s.winner).toBe("dorf");
  });

  it("holds one runoff on a tie and then spares everyone", () => {
    let s = toVote();
    const tie = (st: GameState) => {
      st = act(st, "p0", { type: "vote", target: "p1" });
      st = act(st, "p1", { type: "vote", target: "p2" });
      st = act(st, "p2", { type: "vote", target: "p1" });
      st = act(st, "p3", { type: "vote", target: "p2" });
      return act(st, "p4", { type: "vote", target: null });
    };
    s = tie(s);
    expect(s.phase).toBe("vote");
    expect(s.vote).toMatchObject({ round: 2, candidates: ["p1", "p2"] });
    expect(() => act(s, "p0", { type: "vote", target: "p3" })).toThrow(GameError);
    s = tie(s);
    expect(s.announce).toMatchObject({ kind: "verdict", deaths: [], tie: true, next: "night" });
    s = ackAll(s);
    expect(s.phase).toBe("night");
    expect(s.round).toBe(2);
  });

  it("starts the vote when the discussion time is up", () => {
    let s = setup(["werwolf", "dorfbewohner", "dorfbewohner", "dorfbewohner", "dorfbewohner"]);
    s = act(s, "p0", { type: "wolfVote", target: "p4" });
    s = sleepers(s);
    s = ackAll(s);
    expect(s.phase).toBe("discussion");
    s = applyAction(s, "p1", { type: "tick" }, ctx(undefined, s.deadline! - 1));
    expect(s.phase).toBe("discussion");
    s = applyAction(s, "p1", { type: "tick" }, ctx(undefined, s.deadline!));
    expect(s.phase).toBe("vote");
  });
});

describe("whole games", () => {
  const pick = <T>(items: T[], rng: () => number) => items[Math.floor(rng() * items.length)];

  /** One random legal move of one player, or null when they have nothing to do. */
  function move(s: GameState, id: string, rng: () => number): Action | null {
    const me = s.players.find((p) => p.id === id)!;
    const others = s.players.filter((p) => p.alive && p.id !== id);
    const view = viewFor(s, id, { now: 0, online: new Set() })!;
    if (s.phase === "hunter") {
      return s.hunterPending === id ? { type: "hunterShoot", target: pick(others, rng).id } : null;
    }
    if (view.me.done) return null;
    switch (s.phase) {
      case "roles":
        return { type: "ack" };
      case "announce":
      case "discussion":
        return ackers(s).some((p) => p.id === id) ? { type: "ack" } : null;
      case "night": {
        if (!me.alive) return null;
        const task = nightTask(s, me);
        if (task === "wolf") {
          const prey = others.filter((p) => p.role !== "werwolf");
          const mate = Object.values(s.night.wolfVotes)[0];
          return { type: "wolfVote", target: mate && rng() < 0.7 ? mate : pick(prey, rng).id };
        }
        if (task === "seer") return { type: "seerPeek", target: pick(others, rng).id };
        if (task === "amor") {
          const a = pick(s.players, rng).id;
          const b = pick(s.players.filter((p) => p.id !== a), rng).id;
          return { type: "amorPick", a, b };
        }
        return { type: "suspect", target: pick(others, rng).id };
      }
      case "witch": {
        if (!me.alive) return null;
        if (me.role !== "hexe") return { type: "ack" };
        return {
          type: "witch",
          heal: view.witch!.canHeal && rng() < 0.5,
          poison: view.witch!.canPoison && rng() < 0.3 ? pick(others, rng).id : null,
        };
      }
      case "vote": {
        if (!me.alive) return null;
        const allowed = others.filter((p) => !s.vote.candidates || s.vote.candidates.includes(p.id));
        return { type: "vote", target: rng() < 0.1 || !allowed.length ? null : pick(allowed, rng).id };
      }
      default:
        return null;
    }
  }

  it("always reach an end and never leak a hidden role", { timeout: 60_000 }, () => {
    const winners = new Set<string>();
    const none = { now: 0, online: new Set<string>() };
    for (let n = 3; n <= 12; n++) {
      for (let seed = 0; seed < 60; seed++) {
        const rng = mulberry32(n * 1000 + seed);
        let s = newGame("FUZZ", 0);
        for (let i = 0; i < n; i++) {
          s = addPlayer(s, { id: `p${i}`, name: `S${i}`, tokenHash: "x" });
        }
        s = applyAction(s, "p0", { type: "start" }, { now: 0, rng });
        let steps = 0;
        while (s.phase !== "ended") {
          if (++steps >= 2000) throw new Error(`stuck n=${n} seed=${seed} in ${s.phase}`);
          const moves = s.players
            .map((p) => ({ id: p.id, action: move(s, p.id, rng) }))
            .filter((m) => m.action !== null);
          if (moves.length === 0) throw new Error(`nobody can move n=${n} seed=${seed} in ${s.phase}`);
          const m = pick(moves, rng);
          s = applyAction(s, m.id, m.action!, { now: 0, rng });

          for (const viewer of s.players) {
            if (s.phase === "ended" || !viewer.alive) continue;
            const v = viewFor(s, viewer.id, none)!;
            for (const p of v.players) {
              const target = s.players.find((x) => x.id === p.id)!;
              const mates = viewer.role === "werwolf" && target.role === "werwolf";
              if (p.id !== viewer.id && target.alive && !mates) expect(p.role).toBeNull();
            }
            if (viewer.role !== "amor") expect(v.lovers).toBeNull();
            if (!s.lovers?.includes(viewer.id)) expect(v.me.loverId).toBeNull();
            if (viewer.role !== "seherin") expect(v.seerLog).toBeNull();
            if (viewer.role !== "werwolf") expect(v.night?.wolfVotes ?? null).toBeNull();
            if (viewer.role !== "hexe") expect(v.witch?.victim ?? null).toBeNull();
          }
        }
        winners.add(s.winner!);
      }
    }
    expect([...winners]).toEqual(expect.arrayContaining(["dorf", "wolf", "paar"]));
  });
});
