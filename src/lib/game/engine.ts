import { composition, MAX_PLAYERS, ROLES, SHORT_ROUND_PLAYERS } from "./roles";
import type {
  Action,
  Death,
  DeathCause,
  GameState,
  NightState,
  NightTask,
  Player,
  Winner,
} from "./types";

/** A rule violation. The message is shown to the player as is. */
export class GameError extends Error {}

export interface Ctx {
  now: number;
  /** Returns a float in [0, 1). */
  rng: () => number;
}

const NAME_MAX = 14;

export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw new GameError("Bitte gib einen Namen ein.");
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  if (!name) throw new GameError("Bitte gib einen Namen ein.");
  return name;
}

function freshNight(): NightState {
  return {
    wolfVotes: {},
    victim: null,
    seerDone: false,
    amorDone: false,
    suspects: {},
    witch: null,
  };
}

export function newGame(code: string, now: number): GameState {
  return {
    code,
    hostId: "",
    createdAt: now,
    players: [],
    settings: {
      auto: true,
      custom: { wolves: 1, seherin: true, hexe: true, jaeger: false, amor: false },
      discussionSeconds: 180,
    },
    phase: "lobby",
    short: false,
    round: 0,
    acks: [],
    deadline: null,
    night: freshNight(),
    lovers: null,
    potions: { heal: true, poison: true },
    seerLog: [],
    hunterPending: null,
    vote: { round: 1, candidates: null, ballots: {}, previous: null },
    announce: null,
    winner: null,
    suspicions: [],
  };
}

export function addPlayer(
  state: GameState,
  player: { id: string; name: string; tokenHash: string },
): GameState {
  const s = structuredClone(state);
  if (s.phase !== "lobby") {
    throw new GameError("Das Spiel läuft schon. Warte, bis die Runde vorbei ist.");
  }
  if (s.players.length >= MAX_PLAYERS) throw new GameError("Der Raum ist voll.");
  const name = cleanName(player.name);
  if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError("Diesen Namen gibt es schon. Nimm bitte einen anderen.");
  }
  s.players.push({ id: player.id, name, tokenHash: player.tokenHash, role: null, alive: true });
  if (!s.hostId) s.hostId = player.id;
  return s;
}

/** Hands the room to another player, used when the host has gone offline. */
export function transferHost(state: GameState, to: string): GameState {
  const s = structuredClone(state);
  if (s.players.some((p) => p.id === to)) s.hostId = to;
  return s;
}

const living = (s: GameState) => s.players.filter((p) => p.alive);
const livingWolves = (s: GameState) => living(s).filter((p) => p.role === "werwolf");
const find = (s: GameState, id: string) => s.players.find((p) => p.id === id);

function livingTarget(s: GameState, id: unknown): Player {
  const p = typeof id === "string" ? find(s, id) : undefined;
  if (!p || !p.alive) throw new GameError("Diesen Spieler kannst du nicht wählen.");
  return p;
}

export function nightTask(s: GameState, p: Player): NightTask {
  if (p.role === "werwolf") return s.short ? "lurk" : "wolf";
  if (p.role === "seherin") return "seer";
  if (p.role === "amor" && s.round === 1) return "amor";
  return "suspect";
}

/** The victim all living wolves agree on, or null while they still differ. */
export function wolfConsensus(s: GameState): string | null {
  const wolves = livingWolves(s);
  if (wolves.length === 0) return null;
  const first = s.night.wolfVotes[wolves[0].id];
  if (!first) return null;
  return wolves.every((w) => s.night.wolfVotes[w.id] === first) ? first : null;
}

export function nightDone(s: GameState, p: Player): boolean {
  switch (nightTask(s, p)) {
    case "wolf":
      return wolfConsensus(s) !== null;
    case "seer":
      return s.night.seerDone;
    case "amor":
      return s.night.amorDone;
    case "suspect":
    case "lurk":
      return p.id in s.night.suspects;
  }
}

/** Who has to confirm the current phase before the game moves on. */
export function ackers(s: GameState): Player[] {
  switch (s.phase) {
    case "roles":
      return s.players;
    case "witch":
      return living(s).filter((p) => p.role !== "hexe");
    case "announce": {
      const alive = living(s);
      return alive.length > 0 ? alive : s.players;
    }
    case "discussion":
      return living(s);
    default:
      return [];
  }
}

export function checkWinner(s: GameState): Winner | null {
  const alive = living(s);
  if (alive.length === 0) return "niemand";
  const wolves = alive.filter((p) => p.role === "werwolf").length;
  if (s.lovers && alive.length === 2 && s.lovers.every((id) => find(s, id)?.alive)) {
    const teams = s.lovers.map((id) => ROLES[find(s, id)!.role!].team);
    if (teams[0] !== teams[1]) return "paar";
  }
  if (wolves === 0) return "dorf";
  if (wolves >= alive.length - wolves) return "wolf";
  return null;
}

function kill(s: GameState, id: string, cause: DeathCause, deaths: Death[]) {
  const p = find(s, id);
  if (!p || !p.alive) return;
  p.alive = false;
  deaths.push({ id, cause });
  if (p.role === "jaeger") s.hunterPending = p.id;
  if (s.lovers?.includes(id)) {
    kill(s, s.lovers[0] === id ? s.lovers[1] : s.lovers[0], "liebe", deaths);
  }
}

function startNight(s: GameState) {
  s.round += 1;
  s.phase = "night";
  s.acks = [];
  s.deadline = null;
  s.announce = null;
  s.night = freshNight();
}

function startDiscussion(s: GameState, ctx: Ctx) {
  s.phase = "discussion";
  s.acks = [];
  s.deadline =
    s.settings.discussionSeconds > 0 ? ctx.now + s.settings.discussionSeconds * 1000 : null;
}

function startVote(s: GameState) {
  s.phase = "vote";
  s.acks = [];
  s.deadline = null;
  s.vote = { round: 1, candidates: null, ballots: {}, previous: null };
}

function announce(s: GameState, a: NonNullable<GameState["announce"]>) {
  s.announce = a;
  s.phase = "announce";
  s.acks = [];
  s.deadline = null;
}

function finishNight(s: GameState, victim: string | null) {
  s.night.victim = victim;
  if (living(s).some((p) => p.role === "hexe")) {
    s.phase = "witch";
    s.acks = [];
  } else {
    resolveNight(s);
  }
}

function resolveNight(s: GameState) {
  const deaths: Death[] = [];
  const { victim, witch } = s.night;
  if (witch?.heal) s.potions.heal = false;
  if (witch?.poison) s.potions.poison = false;
  if (victim && !witch?.heal) kill(s, victim, "wolf", deaths);
  if (witch?.poison) kill(s, witch.poison, "gift", deaths);
  announce(s, { kind: "morning", deaths, next: "discussion" });
}

function proceed(s: GameState, next: "discussion" | "night", ctx: Ctx) {
  let winner = checkWinner(s);
  // A short round has one day only: a wolf who gets through it has won.
  if (!winner && s.short && next === "night") winner = "wolf";
  if (winner) {
    s.winner = winner;
    s.phase = "ended";
    s.acks = [];
    s.deadline = null;
    return;
  }
  if (next === "discussion") startDiscussion(s, ctx);
  else startNight(s);
}

function afterAnnounce(s: GameState, ctx: Ctx) {
  const next = s.announce?.next ?? "night";
  if (s.hunterPending) {
    // The last shot only matters while there is still a wolf to hit.
    if (livingWolves(s).length > 0) {
      s.phase = "hunter";
      s.acks = [];
      return;
    }
    s.hunterPending = null;
  }
  proceed(s, next, ctx);
}

function tally(s: GameState) {
  const ballots = s.vote.ballots;
  const counts = new Map<string, number>();
  for (const target of Object.values(ballots)) {
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  const top = [...counts].filter(([, n]) => n === max).map(([id]) => id);
  if (top.length > 1 && s.vote.round === 1) {
    s.vote = { round: 2, candidates: top, ballots: {}, previous: ballots };
    return;
  }
  const deaths: Death[] = [];
  if (top.length === 1) kill(s, top[0], "vote", deaths);
  announce(s, { kind: "verdict", deaths, next: "night", ballots, tie: top.length > 1 });
}

function toLobby(s: GameState) {
  for (const p of s.players) {
    p.role = null;
    p.alive = true;
  }
  s.phase = "lobby";
  s.short = false;
  s.round = 0;
  s.acks = [];
  s.deadline = null;
  s.night = freshNight();
  s.lovers = null;
  s.potions = { heal: true, poison: true };
  s.seerLog = [];
  s.hunterPending = null;
  s.vote = { round: 1, candidates: null, ballots: {}, previous: null };
  s.announce = null;
  s.winner = null;
  s.suspicions = [];
}

function ackComplete(s: GameState) {
  return ackers(s).every((p) => s.acks.includes(p.id));
}

function advanceIfAcked(s: GameState, ctx: Ctx) {
  switch (s.phase) {
    case "roles":
      if (ackComplete(s)) startNight(s);
      break;
    case "witch":
      if (s.night.witch && ackComplete(s)) resolveNight(s);
      break;
    case "announce":
      if (ackComplete(s)) afterAnnounce(s, ctx);
      break;
    case "discussion":
      if (ackComplete(s)) startVote(s);
      break;
  }
}

/** Host escape hatch: finish the current phase with whatever has been entered. */
function force(s: GameState, ctx: Ctx) {
  switch (s.phase) {
    case "roles":
      startNight(s);
      break;
    case "night": {
      let victim = wolfConsensus(s);
      if (!victim) {
        const counts = new Map<string, number>();
        for (const w of livingWolves(s)) {
          const t = s.night.wolfVotes[w.id];
          if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        victim = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
      finishNight(s, victim);
      break;
    }
    case "witch":
      s.night.witch ??= { heal: false, poison: null };
      resolveNight(s);
      break;
    case "announce":
      afterAnnounce(s, ctx);
      break;
    case "hunter":
      s.hunterPending = null;
      proceed(s, s.announce?.next ?? "night", ctx);
      break;
    case "discussion":
      startVote(s);
      break;
    case "vote":
      for (const p of living(s)) if (!(p.id in s.vote.ballots)) s.vote.ballots[p.id] = null;
      tally(s);
      break;
    default:
      throw new GameError("Hier gibt es nichts zu überspringen.");
  }
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: Action,
  ctx: Ctx,
): GameState {
  const s = structuredClone(state);
  const me = find(s, playerId);
  if (!me) throw new GameError("Du bist nicht in diesem Raum.");
  const isHost = s.hostId === me.id;
  const hostOnly = () => {
    if (!isHost) throw new GameError("Das darf nur die Spielleitung.");
  };
  const inPhase = (...phases: GameState["phase"][]) => {
    if (!phases.includes(s.phase)) throw new GameError("Das geht gerade nicht.");
  };
  const mustLive = () => {
    if (!me.alive) throw new GameError("Du bist schon ausgeschieden.");
  };

  switch (action.type) {
    case "settings": {
      hostOnly();
      inPhase("lobby");
      const { custom, auto, discussionSeconds } = action.settings ?? {};
      if (typeof auto === "boolean") s.settings.auto = auto;
      if (typeof discussionSeconds === "number") {
        const d = Math.round(discussionSeconds);
        if (d !== 0 && (d < 30 || d > 900)) throw new GameError("Ungültige Diskussionszeit.");
        s.settings.discussionSeconds = d;
      }
      if (custom && typeof custom === "object") {
        const c = s.settings.custom;
        if (typeof custom.wolves === "number") {
          c.wolves = Math.min(6, Math.max(1, Math.round(custom.wolves)));
        }
        for (const key of ["seherin", "hexe", "jaeger", "amor"] as const) {
          if (typeof custom[key] === "boolean") c[key] = custom[key];
        }
      }
      break;
    }

    case "kick": {
      hostOnly();
      inPhase("lobby");
      if (action.target === me.id) throw new GameError("Du kannst dich nicht selbst entfernen.");
      s.players = s.players.filter((p) => p.id !== action.target);
      break;
    }

    case "leave": {
      inPhase("lobby");
      s.players = s.players.filter((p) => p.id !== me.id);
      if (isHost) s.hostId = s.players[0]?.id ?? "";
      break;
    }

    case "start": {
      hostOnly();
      inPhase("lobby");
      const comp = composition(s.players.length, s.settings);
      if (!comp.roles) throw new GameError(comp.error);
      toLobby(s);
      s.short = s.players.length === SHORT_ROUND_PLAYERS;
      const dealt = shuffle(comp.roles, ctx.rng);
      s.players.forEach((p, i) => (p.role = dealt[i]));
      s.phase = "roles";
      break;
    }

    case "ack": {
      inPhase("roles", "witch", "announce", "discussion");
      if (!ackers(s).some((p) => p.id === me.id)) {
        throw new GameError("Du musst gerade nichts bestätigen.");
      }
      if (!s.acks.includes(me.id)) s.acks.push(me.id);
      advanceIfAcked(s, ctx);
      break;
    }

    case "wolfVote": {
      inPhase("night");
      mustLive();
      if (s.short) throw new GameError("In der Kurzrunde erwischt der Werwolf niemanden.");
      if (nightTask(s, me) !== "wolf") throw new GameError("Du bist kein Werwolf.");
      if (wolfConsensus(s)) throw new GameError("Ihr habt euch schon entschieden.");
      const target = livingTarget(s, action.target);
      if (target.role === "werwolf") throw new GameError("Werwölfe fressen keine Werwölfe.");
      s.night.wolfVotes[me.id] = target.id;
      break;
    }

    case "seerPeek": {
      inPhase("night");
      mustLive();
      if (nightTask(s, me) !== "seer") throw new GameError("Du bist nicht die Seherin.");
      if (s.night.seerDone) throw new GameError("Du hast heute Nacht schon jemanden angesehen.");
      const target = livingTarget(s, action.target);
      if (target.id === me.id) throw new GameError("Deine eigene Rolle kennst du schon.");
      s.seerLog.push({ round: s.round, target: target.id, role: target.role! });
      s.night.seerDone = true;
      break;
    }

    case "amorPick": {
      inPhase("night");
      mustLive();
      if (nightTask(s, me) !== "amor") throw new GameError("Du bist nicht Amor.");
      if (s.night.amorDone) throw new GameError("Du hast die Verliebten schon bestimmt.");
      const a = livingTarget(s, action.a);
      const b = livingTarget(s, action.b);
      if (a.id === b.id) throw new GameError("Wähle zwei verschiedene Spieler.");
      s.lovers = [a.id, b.id];
      s.night.amorDone = true;
      break;
    }

    case "suspect": {
      inPhase("night");
      mustLive();
      const task = nightTask(s, me);
      if (task !== "suspect" && task !== "lurk") throw new GameError("Du hast eine andere Aufgabe.");
      if (me.id in s.night.suspects) throw new GameError("Du hast schon getippt.");
      const target = livingTarget(s, action.target);
      if (target.id === me.id) throw new GameError("Dich selbst kannst du nicht verdächtigen.");
      s.night.suspects[me.id] = target.id;
      // A lurking wolf only taps along; it is not a real guess.
      if (task === "suspect") s.suspicions.push({ round: s.round, by: me.id, target: target.id });
      break;
    }

    case "witch": {
      inPhase("witch");
      mustLive();
      if (me.role !== "hexe") throw new GameError("Du bist nicht die Hexe.");
      if (s.night.witch) throw new GameError("Du hast dich schon entschieden.");
      const heal = action.heal === true;
      if (heal && (!s.potions.heal || !s.night.victim)) {
        throw new GameError("Der Heiltrank hilft gerade nicht.");
      }
      let poison: string | null = null;
      if (action.poison) {
        if (!s.potions.poison) throw new GameError("Der Gifttrank ist schon verbraucht.");
        const target = livingTarget(s, action.poison);
        if (target.id === me.id) throw new GameError("Dich selbst vergiftest du besser nicht.");
        poison = target.id;
      }
      s.night.witch = { heal, poison };
      advanceIfAcked(s, ctx);
      break;
    }

    case "hunterShoot": {
      inPhase("hunter");
      if (s.hunterPending !== me.id) throw new GameError("Du bist nicht der Jäger.");
      const target = livingTarget(s, action.target);
      const deaths: Death[] = [];
      s.hunterPending = null;
      kill(s, target.id, "jaeger", deaths);
      announce(s, { kind: "hunter", deaths, next: s.announce?.next ?? "night" });
      break;
    }

    case "vote": {
      inPhase("vote");
      mustLive();
      let target: string | null = null;
      if (action.target !== null) {
        const t = livingTarget(s, action.target);
        if (t.id === me.id) throw new GameError("Du kannst nicht für dich selbst stimmen.");
        if (s.vote.candidates && !s.vote.candidates.includes(t.id)) {
          throw new GameError("In der Stichwahl stehen nur die Gleichstände zur Wahl.");
        }
        target = t.id;
      }
      s.vote.ballots[me.id] = target;
      if (living(s).every((p) => p.id in s.vote.ballots)) tally(s);
      break;
    }

    case "tick": {
      if (s.phase === "discussion" && s.deadline !== null && ctx.now >= s.deadline) startVote(s);
      break;
    }

    case "force": {
      hostOnly();
      force(s, ctx);
      break;
    }

    case "abort": {
      hostOnly();
      if (s.phase === "lobby") throw new GameError("Ihr seid schon in der Lobby.");
      toLobby(s);
      break;
    }

    case "again": {
      hostOnly();
      inPhase("ended");
      toLobby(s);
      break;
    }

    default:
      throw new GameError("Unbekannte Aktion.");
  }

  // Night actions can complete the night; checked once here for all of them.
  if (s.phase === "night" && living(s).every((p) => nightDone(s, p))) {
    finishNight(s, wolfConsensus(s));
  }
  return s;
}
