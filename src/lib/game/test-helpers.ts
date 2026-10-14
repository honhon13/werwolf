import { expect } from "vitest";
import { addPlayer, applyAction, GameError, newGame } from "./engine";
import { tasksOf } from "./night";
import { ACTOR_POWERS, modeFor } from "./roles";
import type { Action, GameState, RoleId, TaskId } from "./types";
import { viewFor } from "./view";

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** By default chance never goes against the village: the Kleines Mädchen is not caught. */
export const ctx = (rng: () => number = () => 0.99, now = 1000) => ({ now, rng });

/**
 * A game with exactly these roles in seat order (players p0, p1, …),
 * past the role reveal. Decoys are off unless asked for.
 */
export function game(
  roles: RoleId[],
  opts: { captain?: boolean; decoy?: boolean; center?: RoleId[]; rng?: () => number } = {},
): GameState {
  let s = newGame("TEST", 0);
  roles.forEach((_, i) => {
    s = addPlayer(s, { id: `p${i}`, name: `P${i}`, tokenHash: "x" });
  });
  s.settings.captain = opts.captain ?? false;
  s.settings.decoy = opts.decoy ?? false;
  s.mode = modeFor(roles.length);
  s.players.forEach((p, i) => (p.role = roles[i]));
  s.center = opts.center ?? [];
  if (roles.includes("schauspieler")) s.actorPowers = ACTOR_POWERS.slice(0, 3);
  s.elderShield = roles.includes("aeltester");
  s.angelChance = roles.includes("engel");
  s.phase = "roles";
  for (const p of s.players) s = applyAction(s, p.id, { type: "ack" }, ctx(opts.rng));
  return s;
}

export const act = (s: GameState, id: string, action: Action, rng?: () => number) =>
  applyAction(s, id, action, ctx(rng));

export function night(
  s: GameState,
  id: string,
  task: TaskId,
  extra: Omit<Extract<Action, { type: "night" }>, "type" | "task"> = {},
  rng?: () => number,
) {
  return act(s, id, { type: "night", task, ...extra }, rng);
}

export const tasks = (s: GameState, id: string) => tasksOf(s, s.players.find((p) => p.id === id)!);

export function fails(run: () => unknown, message?: RegExp) {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    if (message) expect((e as Error).message).toMatch(message);
    return;
  }
  throw new Error("expected a GameError");
}

/** Everybody who may confirm, confirms. */
export function ackAll(s: GameState, rng?: () => number): GameState {
  const phase = s.phase;
  for (const p of s.players) {
    if (s.phase !== phase) break;
    try {
      s = act(s, p.id, { type: "ack" }, rng);
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
    }
  }
  return s;
}

/** From the morning announcement to the vote. */
export function toVote(s: GameState): GameState {
  expect(s.phase).toBe("announce");
  s = ackAll(s);
  expect(s.phase).toBe("discussion");
  s = ackAll(s);
  expect(s.phase).toBe("vote");
  return s;
}

export function votes(s: GameState, ballots: Record<string, string | null>, rng?: () => number): GameState {
  for (const [voter, target] of Object.entries(ballots)) s = act(s, voter, { type: "vote", target }, rng);
  return s;
}

export const alive = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.alive;
export const see = (s: GameState, id: string) => viewFor(s, id, { now: 0, online: new Set() })!;
