import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, expireIfDue, GameError, newGame } from "./engine";
import { autoRoles, countsOf, GRACE_MS, MAX_PLAYERS, problem, ROLE_ORDER, ROLES } from "./roles";
import { find, inPack, teamOf } from "./state";
import { seeded } from "./test-helpers";
import type { Action, GameState, RoleId, Task, View } from "./types";
import { viewFor } from "./view";

const pick = <T>(items: T[], rng: () => number) => items[Math.floor(rng() * items.length)];
const sample = <T>(items: T[], k: number, rng: () => number) => {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
};

const SPECIALS = ROLE_ORDER.filter((r) => ROLES[r].max === 1 && !ROLES[r].hunts);

/** A random set of cards the manual mode accepts. */
function randomRoles(n: number, rng: () => number): RoleId[] {
  for (;;) {
    const wolves = 1 + Math.floor(rng() * Math.max(1, Math.floor((n - 1) / 2)));
    const roles: RoleId[] = [];
    const special = sample<RoleId>(["urwolf", "grosserWolf", "weisserWolf"], Math.floor(rng() * 3), rng);
    roles.push("werwolf", ...special.slice(0, wolves - 1));
    while (roles.length < wolves) roles.push("werwolf");
    const thief = rng() < 0.25;
    const cardsNeeded = n + (thief ? 2 : 0);
    const room = cardsNeeded - roles.length - (thief ? 1 : 0);
    roles.push(...sample(SPECIALS.filter((r) => r !== "dieb"), Math.floor(rng() * (room + 1)), rng));
    if (thief) roles.push("dieb");
    while (roles.length < cardsNeeded) roles.push("dorfbewohner");
    if (!problem(n, roles)) return roles;
  }
}

/** One random but legal move for this player, or null when there is nothing to do. */
function move(v: View, rng: () => number): Action | null {
  switch (v.phase) {
    case "roles":
    case "announce":
    case "discussion":
      return v.me.done || (!v.me.alive && v.phase !== "roles" && v.players.some((p) => p.alive)) ? null : { type: "ack" };
    case "night": {
      const task = v.tasks.find((t) => !t.done);
      return task ? nightMove(v, task, rng) : null;
    }
    case "vote":
    case "election": {
      const verdict = v.vote!.kind === "lynch";
      // A verdict vote may change until the time is up; now and then somebody does.
      if (!v.me.canVote || (v.vote!.myBallot !== undefined && !(verdict && rng() < 0.1))) return null;
      const allowed = v.players.filter(
        (p) =>
          p.alive &&
          (v.vote!.kind === "election" || p.id !== v.me.id) &&
          (!v.vote!.candidates || v.vote!.candidates.includes(p.id)),
      );
      const abstain = !verdict && rng() < 0.1;
      return { type: "vote", target: abstain || allowed.length === 0 ? null : pick(allowed, rng).id };
    }
    case "hunter":
    case "succession":
    case "scapegoat": {
      if (v.pending?.who !== v.me.id) return null;
      const others = v.players.filter((p) => p.alive && p.id !== v.me.id).map((p) => p.id);
      const targets = v.phase === "scapegoat" ? sample(others, Math.floor(rng() * (others.length + 1)), rng) : [pick(others, rng)];
      return { type: "choose", targets };
    }
    default:
      return null;
  }
}

function nightMove(v: View, task: Task, rng: () => number): Action {
  const base = { type: "night" as const, task: task.id };
  if (task.id === "hexe") {
    const heal = task.potions!.heal && task.attacked!.length > 0 && rng() < 0.5 ? pick(task.attacked!, rng) : null;
    const poison = task.potions!.poison && task.targets.length > 0 && rng() < 0.3 ? pick(task.targets, rng) : null;
    return { ...base, heal, poison };
  }
  if (task.id === "wolf") {
    const mates = Object.values(task.wolfVotes ?? {}).filter((t) => task.targets.includes(t));
    return { ...base, targets: [mates.length && rng() < 0.8 ? pick(mates, rng) : pick(task.targets, rng)] };
  }
  if (task.id === "schauspieler") {
    if (rng() < 0.3 || task.options.length === 0) return { ...base, option: "pass" };
    const power = pick(task.options, rng).id;
    const targets = task.targets.filter((t) => (power === "seherin" ? t !== v.me.id : true));
    return { ...base, option: power, targets: [pick(targets, rng)] };
  }
  if (task.options.length > 0) return { ...base, option: pick(task.options, rng).id };
  const [min, max] = task.count;
  const k = min + Math.floor(rng() * (max - min + 1));
  return { ...base, targets: sample(task.targets, k, rng) };
}

/** Nothing a living player sees may give away somebody else's secret. */
function checkPrivacy(s: GameState, viewer: string) {
  const me = find(s, viewer)!;
  const v = viewFor(s, viewer, { now: 0, online: new Set() })!;
  // Who the game waits for: never at night, otherwise exactly the missing players, each once.
  const { done, total, waiting } = v.progress;
  if (s.phase === "night") expect(waiting).toBeNull();
  else if (waiting && total > 1) {
    expect(waiting).toHaveLength(total - done);
    expect(new Set(waiting).size).toBe(waiting.length);
  }
  if (!me.alive || s.phase === "ended" || s.phase === "lobby") return;
  for (const p of v.players) {
    const real = find(s, p.id)!;
    if (p.id !== me.id && real.alive) expect(p.role, `role of ${p.id} leaked to ${viewer}`).toBeNull();
    if (p.pack) expect(inPack(me) || p.id === me.id).toBe(true);
    if (p.enchanted && p.id !== me.id) expect(me.enchanted || me.role === "floetenspieler").toBe(true);
    if (p.lover && p.id !== me.id) expect(Boolean(s.lovers?.includes(me.id)) || me.role === "amor").toBe(true);
  }
  expect(v.history.every((h) => !h.secret)).toBe(true);
  if (me.role !== "hexe") expect(v.potions).toBeNull();
  for (const t of v.tasks) {
    if (t.wolfVotes) expect(inPack(me)).toBe(true);
    if (t.attacked) expect(me.role).toBe("hexe");
  }
}

const TIMED: GameState["phase"][] = ["night", "announce", "vote", "election", "hunter", "succession", "scapegoat"];

/** How often the host had to skip a step, across the games played so far. */
let forced = 0;

function play(n: number, seed: number, manual: boolean, leaveChance = 0, expireChance = 0) {
  const rng = seeded(seed);
  let s = newGame("FUZZ", 0);
  for (let i = 0; i < n; i++) s = addPlayer(s, { id: `p${i}`, name: `S${i}`, tokenHash: `t${i}` });
  const ctx = { now: 0, rng };
  s = applyAction(
    s,
    "p0",
    {
      type: "settings",
      settings: {
        auto: !manual,
        captain: rng() < 0.5,
        decoy: rng() < 0.5,
        ...(manual ? { counts: countsOf(randomRoles(n, rng)) } : {}),
      },
    },
    ctx,
  );
  s = applyAction(s, "p0", { type: "start" }, ctx);
  const seats = s.players.map((p) => p.id);

  let steps = 0;
  let stuck = 0;
  while (s.phase !== "ended") {
    if (++steps > 4000) throw new Error(`stuck n=${n} seed=${seed} in ${s.phase}/${s.night.step}`);
    let moved = false;
    for (const p of [...s.players].sort(() => rng() - 0.5)) {
      const v = viewFor(s, p.id, { now: 0, online: new Set() })!;
      const action = move(v, rng);
      if (!action) continue;
      try {
        s = applyAction(s, p.id, action, ctx);
        moved = true;
        break;
      } catch (e) {
        if (!(e instanceof GameError)) throw e;
      }
    }
    if (expireChance > 0 && s.deadline !== null && rng() < expireChance) {
      // The time runs out, whatever has been decided so far.
      s = expireIfDue(s, { now: s.deadline + GRACE_MS, rng });
      moved = true;
    }
    if (leaveChance > 0 && s.phase !== "ended" && rng() < leaveChance) {
      // Somebody walks off, at any moment, the host included.
      s = applyAction(s, pick(s.players.filter((p) => !p.left), rng).id, { type: "leave" }, ctx);
      moved = true;
    }
    if (!moved && s.deadline !== null) {
      // Nobody does anything more: the time runs out.
      s = expireIfDue(s, { now: s.deadline + GRACE_MS, rng });
      moved = true;
    }
    if (!moved) {
      // Only a step the random players cannot finish is left: the host moves it on.
      if (++stuck > 50) throw new Error(`no move n=${n} seed=${seed} in ${s.phase}/${s.night.step}`);
      forced++;
      s = applyAction(s, s.hostId, { type: "force" }, ctx);
    }
    // Every phase in which somebody has to act counts down, by day and by night.
    if (TIMED.includes(s.phase) && !(s.phase === "vote" && s.vote.round === 1 && s.settings.discussionSeconds === 0)) {
      expect(s.deadline, `${s.phase} without a countdown`).not.toBeNull();
    }
    // The seats around the fire stay as they were dealt, on every device.
    expect(s.players.map((p) => p.id)).toEqual(seats);
    for (const p of s.players) {
      expect(viewFor(s, p.id, { now: 0, online: new Set() })!.players.map((q) => q.id)).toEqual(seats);
    }
    for (const p of s.players) checkPrivacy(s, p.id);
  }
  expect(s.winner).not.toBeNull();
  for (const id of s.winners) {
    const p = find(s, id)!;
    if (s.winner === "dorf" || s.winner === "wolf") expect(teamOf(s, p)).toBe(s.winner);
  }
  return s;
}

describe("random games", () => {
  it("always end, with every player count from 3 to 18 and random roles", { timeout: 240_000 }, () => {
    const winners = new Map<string, number>();
    const used = new Set<RoleId>();
    for (let n = 3; n <= MAX_PLAYERS; n++) {
      for (let seed = 0; seed < 14; seed++) {
        const s = play(n, n * 100 + seed, seed % 2 === 1);
        winners.set(s.winner!, (winners.get(s.winner!) ?? 0) + 1);
        for (const p of s.players) used.add(p.role!);
      }
    }
    expect([...winners.keys()]).toEqual(expect.arrayContaining(["dorf", "wolf"]));
    // Every role took part in at least one game.
    expect(ROLE_ORDER.filter((r) => !used.has(r))).toEqual([]);
  });

  it("go on without a hitch when players leave at any moment", { timeout: 240_000 }, () => {
    forced = 0;
    let leavers = 0;
    for (let n = 3; n <= MAX_PLAYERS; n++) {
      for (let seed = 0; seed < 8; seed++) {
        const s = play(n, n * 1000 + seed, seed % 2 === 1, 0.03);
        const gone = s.players.filter((p) => p.left);
        leavers += gone.length;
        expect(s.winners.some((id) => gone.some((p) => p.id === id))).toBe(false);
        expect(gone.every((p) => p.tokenHash === "")).toBe(true);
        expect(s.players.some((p) => p.id === s.hostId && !p.left) || gone.length === n).toBe(true);
      }
    }
    expect(leavers).toBeGreaterThan(100);
    // Nobody ever has to wait for somebody who left.
    expect(forced).toBe(0);
  });

  it("go on when time runs out at any moment, whatever was decided", { timeout: 240_000 }, () => {
    forced = 0;
    for (let n = 3; n <= MAX_PLAYERS; n++) {
      for (let seed = 0; seed < 8; seed++) {
        const s = play(n, n * 7000 + seed, seed % 2 === 1, seed % 4 === 0 ? 0.02 : 0, 0.15);
        expect(s.winner).not.toBeNull();
      }
    }
    expect(forced).toBe(0);
  });

  it("uses only the automatic sets the balance table defines", () => {
    for (let n = 5; n <= MAX_PLAYERS; n++) expect(problem(n, autoRoles(n))).toBeNull();
  });
});
