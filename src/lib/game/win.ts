import { find, inPack, living, teamOf } from "./state";
import type { GameState, Winner } from "./types";

/**
 * Who has won, checked after every night and every vote. The order matters:
 * the Engel and the Flötenspieler end the game at once, a mixed couple wins
 * as the last two, and only then are the teams compared.
 */
export function checkWinner(s: GameState): Winner | null {
  if (s.winner === "engel") return "engel";
  const alive = living(s);
  if (alive.length === 0) return "niemand";

  const piper = alive.find((p) => p.role === "floetenspieler");
  if (piper && alive.every((p) => p.id === piper.id || p.enchanted)) return "floetenspieler";

  if (s.lovers && alive.length === 2 && s.lovers.every((id) => find(s, id)?.alive)) {
    const [a, b] = s.lovers.map((id) => teamOf(s, find(s, id)!));
    if (a !== b) return "paar";
  }

  const white = alive.find((p) => p.role === "weisserWolf");
  const wolves = alive.filter((p) => inPack(p) && p.role !== "weisserWolf");
  const others = alive.length - wolves.length;
  if (white && (alive.length === 1 || (wolves.length === 0 && alive.length === 2))) return "weisserWolf";
  if (wolves.length > 0 && wolves.length >= others) return "wolf";
  if (wolves.length === 0 && !white && !piper) return "dorf";
  return null;
}

/** Everybody who shares the win, alive or not. */
export function winnersOf(s: GameState, winner: Winner): string[] {
  const mixedLovers: string[] =
    s.lovers && teamOf(s, find(s, s.lovers[0])!) !== teamOf(s, find(s, s.lovers[1])!) ? s.lovers : [];
  switch (winner) {
    case "niemand":
      return [];
    case "paar":
      return [...(s.lovers ?? [])];
    case "engel":
      return s.players.filter((p) => p.role === "engel").map((p) => p.id);
    case "floetenspieler":
      return s.players.filter((p) => p.role === "floetenspieler").map((p) => p.id);
    case "weisserWolf":
      return s.players.filter((p) => p.role === "weisserWolf").map((p) => p.id);
    case "wolf":
    case "dorf":
      return s.players
        .filter((p) => teamOf(s, p) === winner && !mixedLovers.includes(p.id))
        .map((p) => p.id);
  }
}
