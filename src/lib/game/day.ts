import { kill } from "./death";
import { type Ctx, find, hasPower, holder, living, log, nameOf } from "./state";
import type { Announce, Death, GameState, Player } from "./types";

/** Who may vote right now. */
export function voters(s: GameState): Player[] {
  const alive = living(s).filter((p) => !p.exposed);
  if (s.vote.kind === "election" || !s.voters) return alive;
  return alive.filter((p) => s.voters!.includes(p.id));
}

export function mayVoteFor(s: GameState, voter: Player, target: Player): boolean {
  if (!target.alive) return false;
  if (s.vote.candidates && !s.vote.candidates.includes(target.id)) return false;
  // In the election you may vote for yourself, but not at a verdict.
  return s.vote.kind === "election" || target.id !== voter.id;
}

function counted(s: GameState, ballots: Record<string, string | null>, withMarks: boolean) {
  const counts = new Map<string, number>();
  const add = (id: string, n: number) => counts.set(id, (counts.get(id) ?? 0) + n);
  for (const [voter, target] of Object.entries(ballots)) {
    if (target) add(target, s.vote.kind === "lynch" && s.captain === voter ? 2 : 1);
  }
  if (withMarks) for (const id of s.marks) if (find(s, id)?.alive) add(id, 2);
  const max = Math.max(0, ...counts.values());
  return max === 0 ? [] : [...counts].filter(([, n]) => n === max).map(([id]) => id);
}

function ballotText(s: GameState, ballots: Record<string, string | null>) {
  return Object.entries(ballots)
    .map(([voter, target]) => `${nameOf(s, voter)} → ${target ? nameOf(s, target) : "Enthaltung"}`)
    .join(", ");
}

/**
 * Counts the village's vote. The Hauptmann's vote counts twice, the Rabe's
 * marks add two votes. A tie costs the Sündenbock his place; without him
 * there is one runoff, and a second tie spares everybody.
 * Returns null while a runoff is still to be held.
 */
export function tallyVerdict(s: GameState): Announce | null {
  const ballots = s.vote.ballots;
  const round = s.vote.round;
  log(s, `Abstimmung${round === 2 ? " (Stichwahl)" : ""}: ${ballotText(s, ballots) || "keine Stimmen"}.`, false);
  const top = counted(s, ballots, round === 1);
  const deaths: Death[] = [];
  const result: Announce = { kind: "verdict", deaths, ballots, tie: false, exposed: null };
  const powersBefore = s.powersLost;

  if (top.length === 1) {
    const target = find(s, top[0])!;
    if (target.role === "idiot" && !target.exposed && hasPower(s, target)) {
      target.exposed = true;
      result.exposed = target.id;
      log(s, `${target.name} wurde als Dorfdepp erkannt und bleibt – ohne Stimme.`, false);
      if (s.captain === target.id) {
        s.captain = null;
        s.pending.push({ kind: "succession", who: target.id });
      }
    } else {
      kill(s, target.id, "vote", deaths);
    }
  } else if (top.length > 1) {
    const goat = holder(s, "suendenbock");
    if (goat) {
      kill(s, goat.id, "suendenbock", deaths);
      s.pending.unshift({ kind: "scapegoat", who: goat.id });
    } else if (round === 1) {
      s.vote = { kind: "lynch", round: 2, candidates: top, ballots: {}, previous: ballots };
      return null;
    } else {
      result.tie = true;
      log(s, "Wieder Gleichstand – niemand muss gehen.", false);
    }
  } else {
    log(s, "Niemand wurde gewählt.", false);
  }
  s.marks = [];
  s.voters = null;
  result.powersLost = s.powersLost && !powersBefore;
  return result;
}

/** Counts the Hauptmann election. A second tie is settled by lot. */
export function tallyElection(s: GameState, ctx: Ctx): Announce | null {
  const ballots = s.vote.ballots;
  const top = counted(s, ballots, false);
  if (top.length > 1 && s.vote.round === 1) {
    log(s, `Hauptmannwahl: ${ballotText(s, ballots)}. Gleichstand – Stichwahl.`, false);
    s.vote = { kind: "election", round: 2, candidates: top, ballots: {}, previous: ballots };
    return null;
  }
  const pool = top.length > 0 ? top : living(s).map((p) => p.id);
  const captain = pool[Math.floor(ctx.rng() * pool.length)] ?? null;
  s.captain = captain;
  s.captainElected = true;
  log(s, `Hauptmannwahl: ${ballotText(s, ballots) || "keine Stimmen"}. ${nameOf(s, captain)} ist Hauptmann${top.length !== 1 ? " (durch Los)" : ""}.`, false);
  return { kind: "election", deaths: [], ballots, captain };
}
