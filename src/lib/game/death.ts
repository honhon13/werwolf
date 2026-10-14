import { find, hasPower, inPack, log, nameOf, nextWolfAfter, note, roleName } from "./state";
import type { Death, DeathCause, GameState } from "./types";

const CAUSE: Record<DeathCause, string> = {
  wolf: "wurde von den Wölfen erwischt",
  gift: "wurde vergiftet",
  vote: "wurde vom Dorf verbannt",
  jaeger: "wurde vom Jäger getroffen",
  liebe: "starb aus Liebeskummer",
  tetanus: "starb am Wundstarrkrampf der rostigen Klinge",
  suendenbock: "wurde als Sündenbock verbannt",
};

/** The village killed somebody: the Ältester takes everybody's abilities with him. */
const BY_VILLAGE: DeathCause[] = ["vote", "jaeger", "gift"];

/**
 * Takes a player out of the game and works through everything that follows
 * from it: the partner in love, the Jäger's shot, a new Hauptmann, the
 * Ältester's curse, the Wildes Kind turning, the Ritter's blade, the Engel.
 */
export function kill(s: GameState, id: string, cause: DeathCause, deaths: Death[]) {
  const p = find(s, id);
  if (!p || !p.alive) return;
  p.alive = false;
  deaths.push({ id, cause });
  log(s, `${p.name} ${CAUSE[cause]} (${roleName(p.role)}).`, false);

  if (inPack(p)) s.packLost = true;
  if (p.role === "engel" && s.angelChance) s.winner = "engel";
  if (p.role === "aeltester" && BY_VILLAGE.includes(cause) && !s.powersLost) {
    s.powersLost = true;
    log(s, "Das Dorf hat den Ältesten getötet: Alle Dorfbewohner verlieren ihre Fähigkeiten.", false);
  }
  if (p.role === "jaeger" && !s.powersLost) s.pending.push({ kind: "hunter", who: p.id });
  if (s.captain === p.id) s.pending.push({ kind: "succession", who: p.id });
  if (p.role === "ritter" && cause === "wolf" && !s.powersLost) {
    const wolf = nextWolfAfter(s, p.id);
    if (wolf) {
      s.tetanus = wolf.id;
      log(s, `Die rostige Klinge verletzte ${wolf.name}.`, true);
    }
  }
  if (s.wildModel === p.id) {
    const child = s.players.find((c) => c.role === "wildesKind" && c.alive && !c.turned);
    if (child && hasPower(s, child)) {
      child.turned = true;
      note(s, child.id, { kind: "turned", round: s.round, why: "model" });
      log(s, `${child.name} hat sein Vorbild verloren und wurde zum Werwolf.`, true);
    }
  }
  if (s.lovers?.includes(id)) {
    const other = s.lovers[0] === id ? s.lovers[1] : s.lovers[0];
    kill(s, other, "liebe", deaths);
  }
}

export function causeText(cause: DeathCause) {
  return CAUSE[cause];
}

export { nameOf };
