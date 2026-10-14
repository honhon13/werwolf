import { ROLES } from "./roles";
import type { GameState, Note, Player, RoleId, Team } from "./types";

/** A rule violation. The message is shown to the player as is. */
export class GameError extends Error {}

export interface Ctx {
  now: number;
  /** Returns a float in [0, 1). */
  rng: () => number;
}

export const living = (s: GameState) => s.players.filter((p) => p.alive);
export const find = (s: GameState, id: string | null | undefined) => s.players.find((p) => p.id === id);
export const nameOf = (s: GameState, id: string | null | undefined) => find(s, id)?.name ?? "?";

/** Hunts with the pack at night: wolf cards and everyone who turned. */
export function inPack(p: Player): boolean {
  return Boolean(p.role && ROLES[p.role].hunts) || p.turned;
}

export const pack = (s: GameState) => living(s).filter(inPack);

/** The team a player plays for right now. */
export function teamOf(s: GameState, p: Player): Team {
  if (p.role === "weisserWolf" || p.role === "floetenspieler") return "solo";
  if (p.role === "engel" && s.angelChance) return "solo";
  if (inPack(p)) return "wolf";
  return "dorf";
}

/** Whether the player's role still works; village roles stop once the Ältester was killed. */
export function hasPower(s: GameState, p: Player, role: RoleId = p.role!): boolean {
  return p.alive && p.role === role && !(ROLES[role].village && s.powersLost);
}

/** The living holder of a role whose ability still works. */
export function holder(s: GameState, role: RoleId): Player | undefined {
  return s.players.find((p) => hasPower(s, p, role));
}

/** The nearest living players before and after `id` in seat order. */
export function neighbours(s: GameState, id: string): Player[] {
  const seats = s.players.filter((p) => p.alive || p.id === id);
  const at = seats.findIndex((p) => p.id === id);
  if (at < 0 || seats.length < 2) return [];
  const before = seats[(at - 1 + seats.length) % seats.length];
  const after = seats[(at + 1) % seats.length];
  return before.id === after.id ? [before] : [before, after];
}

/** The first living member of the pack sitting after `id`. */
export function nextWolfAfter(s: GameState, id: string): Player | undefined {
  const at = s.players.findIndex((p) => p.id === id);
  for (let k = 1; k < s.players.length; k++) {
    const p = s.players[(at + k) % s.players.length];
    if (p.alive && inPack(p)) return p;
  }
  return undefined;
}

export function note(s: GameState, id: string, entry: Note) {
  (s.notes[id] ??= []).push(entry);
}

export function log(s: GameState, text: string, secret: boolean, day = s.phase !== "night") {
  s.history.push({ round: s.round, day, text, secret });
}

export function roleName(role: RoleId | null | undefined) {
  return role ? ROLES[role].name : "?";
}
