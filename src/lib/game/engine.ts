import { mayVoteFor, tallyElection, tallyVerdict, voters } from "./day";
import { kill } from "./death";
import {
  advanceTo,
  decideForAbsent,
  endStep,
  forceStep,
  freshNight,
  nightAction,
  resolveNight,
  settleWolves,
  stepComplete,
  STEPS,
  stepHasWork,
} from "./night";
import {
  ACTOR_POWERS,
  autoRoles,
  cards,
  cardsNeeded,
  composition,
  countsOf,
  deal,
  DECISION_MS,
  fits,
  GRACE_MS,
  MAX_PLAYERS,
  modeFor,
  ROLE_ORDER,
  ROLES,
} from "./roles";
import { type Ctx, find, GameError, living, log, nameOf, roleName } from "./state";
import type { Action, Announce, Death, GameState, Player, RoleId, Settings, Winner } from "./types";
import { STATE_REV } from "./types";
import { checkWinner, winnersOf } from "./win";

export { GameError } from "./state";

const NAME_MAX = 14;
/** Rejoin requests older than this are dropped. */
const REJOIN_TTL = 15 * 60 * 1000;
const DECIDING: GameState["phase"][] = ["night", "announce", "vote", "election", "hunter", "succession", "scapegoat"];

/** Starts the clock for a decision. */
function decide(s: GameState, ctx: Ctx) {
  s.deadline = ctx.now + DECISION_MS;
}

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

function defaults(): Omit<GameState, "code" | "createdAt"> {
  return {
    rev: STATE_REV,
    hostId: "",
    players: [],
    settings: { auto: true, counts: {}, captain: false, decoy: true, discussionSeconds: 180 },
    phase: "lobby",
    mode: "normal",
    round: 0,
    acks: [],
    ready: [],
    deadline: null,
    night: freshNight(),
    center: [],
    lovers: null,
    wildModel: null,
    potions: { heal: true, poison: true },
    lastProtected: null,
    actorPowers: [],
    foxActive: true,
    infectionUsed: false,
    packLost: false,
    elderShield: false,
    powersLost: false,
    tetanus: null,
    angelChance: false,
    marks: [],
    captain: null,
    captainElected: false,
    voters: null,
    pending: [],
    after: "night",
    vote: { kind: "lynch", round: 1, candidates: null, ballots: {}, previous: null },
    announce: null,
    winner: null,
    winners: [],
    notes: {},
    history: [],
    suspicions: [],
    rejoins: [],
    handled: {},
  };
}

export function newGame(code: string, now: number): GameState {
  return { ...defaults(), code, createdAt: now };
}

/**
 * Brings a stored room up to the current shape. Rooms from before the
 * full role system go back to the lobby with their players and settings.
 */
export function normalize(raw: GameState): GameState {
  if (raw.rev === STATE_REV) {
    const s = { ...defaults(), ...raw };
    // A Schauspieler dealt before the fix may still hold the Rabe as a fourth ability.
    s.actorPowers = s.actorPowers.filter((r) => ACTOR_POWERS.includes(r));
    return s;
  }
  const old = raw as unknown as {
    code: string;
    createdAt: number;
    hostId: string;
    players: { id: string; name: string; tokenHash: string }[];
    settings?: { auto?: boolean; discussionSeconds?: number; custom?: Record<string, number | boolean> };
  };
  const s = newGame(old.code, old.createdAt);
  s.hostId = old.hostId;
  s.players = old.players.map((p) => ({
    id: p.id,
    name: p.name,
    tokenHash: p.tokenHash,
    role: null,
    alive: true,
    turned: false,
    enchanted: false,
    exposed: false,
  }));
  s.settings.auto = old.settings?.auto ?? true;
  s.settings.discussionSeconds = old.settings?.discussionSeconds ?? 180;
  const custom = old.settings?.custom;
  if (custom) {
    s.settings.counts = { werwolf: Number(custom.wolves) || 1 };
    for (const role of ["seherin", "hexe", "jaeger", "amor"] as RoleId[]) {
      if (custom[role]) s.settings.counts[role] = 1;
    }
  }
  return s;
}

export function addPlayer(
  state: GameState,
  player: { id: string; name: string; tokenHash: string },
): GameState {
  const s = structuredClone(state);
  if (s.phase !== "lobby") {
    throw new GameError("Das Spiel läuft schon. Warte, bis die Runde vorbei ist.");
  }
  if (seatOf(s, player.tokenHash)) throw new GameError("Mit diesem Gerät bist du schon in diesem Raum.");
  if (s.players.length >= MAX_PLAYERS) throw new GameError("Der Raum ist voll.");
  const name = cleanName(player.name);
  if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError("Diesen Namen gibt es schon. Nimm bitte einen anderen.");
  }
  s.players.push({
    id: player.id,
    name,
    tokenHash: player.tokenHash,
    role: null,
    alive: true,
    turned: false,
    enchanted: false,
    exposed: false,
  });
  if (!s.hostId) s.hostId = player.id;
  return s;
}

/** The seat a device already holds in this room, found by its token. */
export function seatOf(s: GameState, tokenHash: string): Player | undefined {
  return tokenHash ? s.players.find((p) => p.tokenHash === tokenHash) : undefined;
}

/** Hands the room to another player, used when the host has gone offline. */
export function transferHost(state: GameState, to: string): GameState {
  const s = structuredClone(state);
  if (s.players.some((p) => p.id === to && !p.left)) s.hostId = to;
  return s;
}

/**
 * Somebody on a new device asks to take over a seat. The new token only
 * works once the host has accepted the request.
 */
export function requestRejoin(
  state: GameState,
  playerId: string,
  request: { id: string; tokenHash: string },
  now: number,
): GameState {
  const s = structuredClone(state);
  const seat = find(s, playerId);
  if (!seat) throw new GameError("Diesen Spieler gibt es in diesem Raum nicht.");
  if (seat.left) throw new GameError(`${seat.name} hat das Spiel verlassen.`);
  // Asking for the seat this device already holds: nothing to do.
  if (seat.tokenHash === request.tokenHash) return s;
  if (seatOf(s, request.tokenHash)) throw new GameError("Mit diesem Gerät spielst du hier schon mit.");
  s.rejoins = s.rejoins.filter((r) => r.playerId !== playerId && now - r.at < REJOIN_TTL).slice(-9);
  s.rejoins.push({ id: request.id, playerId, tokenHash: request.tokenHash, at: now });
  return s;
}

export function openRejoins(s: GameState, now: number) {
  return s.rejoins.filter((r) => now - r.at < REJOIN_TTL);
}

/** Who has to confirm the current phase before the game moves on. */
export function ackers(s: GameState): Player[] {
  switch (s.phase) {
    case "roles":
      return s.players.filter((p) => !p.left);
    case "announce": {
      const alive = living(s);
      return alive.length > 0 ? alive : s.players.filter((p) => !p.left);
    }
    case "discussion":
      return living(s);
    default:
      return [];
  }
}

function toLobby(s: GameState) {
  const keep = { code: s.code, createdAt: s.createdAt, hostId: s.hostId, settings: s.settings };
  // Whoever left the last round is gone now; everybody else starts fresh.
  const players = s.players
    .filter((p) => !p.left)
    .map((p) => ({ ...p, role: null, alive: true, turned: false, enchanted: false, exposed: false }));
  Object.assign(s, defaults(), keep, { players, rejoins: s.rejoins, handled: s.handled });
}

function startGame(s: GameState, ctx: Ctx) {
  const comp = composition(s.players.length, s.settings);
  if (!comp.roles) throw new GameError(comp.error);
  toLobby(s);
  s.mode = modeFor(s.players.length);
  const { hands, center } = deal(comp.roles, s.players.length, ctx.rng);
  s.players.forEach((p, i) => (p.role = hands[i]));
  s.center = center;
  if (hands.includes("schauspieler")) s.actorPowers = [...ACTOR_POWERS];
  s.elderShield = hands.includes("aeltester");
  s.angelChance = hands.includes("engel");
  s.phase = "roles";
  const list = ROLE_ORDER.filter((r) => comp.roles.includes(r))
    .map((r) => {
      const n = comp.roles.filter((x) => x === r).length;
      return n > 1 ? `${ROLES[r].name} ×${n}` : ROLES[r].name;
    })
    .join(", ");
  log(s, `Das Spiel beginnt mit ${s.players.length} Spielern. Karten: ${list}.`, false, true);
  for (const p of s.players) log(s, `${p.name} ist ${ROLES[p.role!].was}.`, true, true);
}

function afterRoles(s: GameState, ctx: Ctx) {
  // With the Engel the game opens with a day, so he can be voted out at once.
  if (s.angelChance) startDay(s, ctx);
  else startNight(s, ctx);
}

function startNight(s: GameState, ctx: Ctx) {
  s.round += 1;
  s.phase = "night";
  s.acks = [];
  s.deadline = null;
  s.announce = null;
  s.night = freshNight();
  advanceNight(s, ctx);
}

/** Moves to the next step with work once everybody is done, and resolves the night after the last. */
function advanceNight(s: GameState, ctx: Ctx) {
  while (s.phase === "night") {
    if (s.night.step && !stepComplete(s)) return;
    if (s.night.step) endStep(s, ctx);
    const from = s.night.step ? STEPS.indexOf(s.night.step) + 1 : 0;
    const next = STEPS.slice(from).find((step) => stepHasWork(s, step));
    if (next) {
      advanceTo(s, next);
      decide(s, ctx);
      continue;
    }
    announce(s, ctx, resolveNight(s), "day");
  }
}

/** Shows what happened; everybody alive confirms with "Weiter", within the decision time. */
function announce(s: GameState, ctx: Ctx, a: Announce, after?: GameState["after"]) {
  s.announce = a;
  s.phase = "announce";
  s.acks = [];
  decide(s, ctx);
  if (after) s.after = after;
}

/** After an announcement: pending choices first, then the next phase. */
function afterAnnounce(s: GameState, ctx: Ctx) {
  if (s.winner === "engel") return end(s, "engel");
  while (s.pending.length > 0) {
    const next = s.pending[0];
    const decided = checkWinner(s);
    // The Jäger may still turn a win of the wolves or of a loner.
    const matters = !decided || (next.kind === "hunter" && decided !== "dorf" && decided !== "niemand");
    if (find(s, next.who) && !find(s, next.who)!.left && living(s).some((p) => p.id !== next.who) && matters) {
      s.phase = next.kind;
      s.acks = [];
      decide(s, ctx);
      return;
    }
    s.pending.shift();
  }
  proceed(s, ctx);
}

function proceed(s: GameState, ctx: Ctx) {
  const winner = checkWinner(s);
  if (winner) return end(s, winner);
  if (s.after === "night") {
    // A short round has one day only: a wolf who gets through it has won.
    if (s.mode === "kurz" && s.round >= 1) return end(s, "wolf");
    return startNight(s, ctx);
  }
  if (s.after === "discussion") return startVote(s, ctx);
  startDay(s, ctx);
}

function startDay(s: GameState, ctx: Ctx) {
  if (s.settings.captain && s.mode === "normal" && !s.captainElected) {
    s.phase = "election";
    s.acks = [];
    decide(s, ctx);
    s.vote = { kind: "election", round: 1, candidates: null, ballots: {}, previous: null };
    return;
  }
  startVote(s, ctx);
}

/**
 * The day: the village talks and votes at once, for as long as the host set
 * ("Zeit zum Diskutieren"). Votes may change until everybody has voted;
 * then they are counted at once, or when the time is up at the latest.
 * Rooms saved during a separate discussion phase also end up here.
 */
function startVote(s: GameState, ctx: Ctx) {
  s.phase = "vote";
  s.acks = [];
  s.deadline = s.settings.discussionSeconds > 0 ? ctx.now + s.settings.discussionSeconds * 1000 : null;
  s.vote = { kind: "lynch", round: 1, candidates: null, ballots: {}, previous: null };
  if (voters(s).length === 0) {
    log(s, "Heute durfte niemand abstimmen.", false);
    s.voters = null;
    s.marks = [];
    announce(s, ctx, { kind: "verdict", deaths: [], ballots: {}, tie: false }, "night");
  }
}

/** Counts as soon as everybody who may vote has voted, even while time is left. */
function countVotes(s: GameState, ctx: Ctx) {
  if (!voters(s).every((p) => p.id in s.vote.ballots)) return;
  const election = s.vote.kind === "election";
  const result = election ? tallyElection(s, ctx) : tallyVerdict(s);
  if (result) announce(s, ctx, result, election ? "discussion" : "night");
  // A tie: the runoff gets its own time.
  else decide(s, ctx);
}

/** Whether the time of the current phase is up, with grace for decisions on their way. */
export function isOverdue(s: GameState, now: number): boolean {
  if (s.deadline === null) return false;
  if (s.phase === "discussion") return now >= s.deadline;
  return DECIDING.includes(s.phase) && now >= s.deadline + GRACE_MS;
}

/**
 * The time is up: whoever has not decided gets the automatic choice, then
 * the game moves on. Only ever runs once per deadline, because every way on
 * either sets a new deadline or none.
 */
function expire(s: GameState, ctx: Ctx) {
  const pick = <T>(items: T[]) => items[Math.floor(ctx.rng() * items.length)];
  switch (s.phase) {
    case "discussion":
      return startVote(s, ctx);
    case "announce":
      // Whoever has not tapped "Weiter" is taken along.
      return afterAnnounce(s, ctx);
    case "night":
      decideForAbsent(s, ctx.rng);
      return advanceNight(s, ctx);
    case "vote":
    case "election":
      for (const p of voters(s)) {
        if (p.id in s.vote.ballots) continue;
        // A verdict needs a name: a random player the voter could have chosen.
        // The Hauptmann election allows abstaining, so nobody is chosen by chance there.
        const valid = s.vote.kind === "lynch" ? living(s).filter((t) => mayVoteFor(s, p, t)) : [];
        s.vote.ballots[p.id] = valid.length > 0 ? pick(valid).id : null;
      }
      return countVotes(s, ctx);
    case "hunter":
    case "succession":
    case "scapegoat": {
      const who = find(s, s.pending[0]!.who)!;
      const others = living(s).filter((p) => p.id !== who.id).map((p) => p.id);
      // The Jäger must shoot and a new Hauptmann must be named; the Sündenbock lets everybody vote.
      return choose(s, ctx, who, s.phase === "scapegoat" ? others : [pick(others)]);
    }
  }
}

/** The state with an expired deadline dealt with, or the same state if nothing is due. */
export function expireIfDue(state: GameState, ctx: Ctx): GameState {
  if (!isOverdue(state, ctx.now)) return state;
  const s = structuredClone(state);
  expire(s, ctx);
  return s;
}

const WINNER_TEXT: Record<Winner, string> = {
  dorf: "Das Dorf gewinnt.",
  wolf: "Das Rudel gewinnt.",
  paar: "Das Liebespaar gewinnt.",
  niemand: "Niemand hat überlebt.",
  floetenspieler: "Der Flötenspieler gewinnt.",
  weisserWolf: "Der Weiße Werwolf gewinnt.",
  engel: "Der Engel gewinnt.",
};

function end(s: GameState, winner: Winner) {
  s.winner = winner;
  s.winners = winnersOf(s, winner);
  s.phase = "ended";
  s.acks = [];
  s.deadline = null;
  s.pending = [];
  log(s, `Spielende: ${WINNER_TEXT[winner]}`, false);
}

function ackComplete(s: GameState) {
  return ackers(s).every((p) => s.acks.includes(p.id));
}

/** A dead Jäger shoots, a Hauptmann names a successor, a Sündenbock picks tomorrow's voters. */
function choose(s: GameState, ctx: Ctx, me: Player, targets: string[]) {
  const pending = s.pending[0];
  if (!pending || pending.who !== me.id || s.phase !== pending.kind) {
    throw new GameError("Du bist gerade nicht dran.");
  }
  const picked = [...new Set(targets)].map((id) => find(s, id));
  if (picked.some((p) => !p?.alive || p.id === me.id)) throw new GameError("Diesen Spieler kannst du nicht wählen.");
  const ids = picked.map((p) => p!.id);

  if (pending.kind === "scapegoat") {
    s.voters = ids;
    const names = ids.map((id) => nameOf(s, id)).join(", ") || "niemand";
    log(s, `Der Sündenbock bestimmte, wer abstimmen darf: ${names}.`, false);
    s.pending.shift();
    return announce(s, ctx, { kind: "scapegoat", deaths: [], voters: ids });
  }
  if (ids.length !== 1) throw new GameError("Wähle genau einen Spieler.");
  s.pending.shift();
  if (pending.kind === "hunter") {
    const deaths: Death[] = [];
    const powersBefore = s.powersLost;
    log(s, `Der Jäger schoss auf ${nameOf(s, ids[0])}.`, false);
    kill(s, ids[0], "jaeger", deaths);
    return announce(s, ctx, { kind: "hunter", deaths, powersLost: s.powersLost && !powersBefore });
  }
  s.captain = ids[0];
  log(s, `${nameOf(s, ids[0])} ist neuer Hauptmann.`, false);
  announce(s, ctx, { kind: "succession", deaths: [], captain: ids[0] });
}

/**
 * A player leaves a running or finished game. They are out for this round
 * and their role is shown, but leaving sets nothing off: no shot of the
 * Jäger, no grief of a lover, no win for the Engel. The device loses its seat.
 * Afterwards the game moves on if it was only waiting for them.
 */
function leaveGame(s: GameState, me: Player, ctx: Ctx) {
  me.left = true;
  me.tokenHash = "";
  s.acks = s.acks.filter((id) => id !== me.id);
  s.rejoins = s.rejoins.filter((r) => r.playerId !== me.id);
  if (s.hostId === me.id) s.hostId = s.players.find((p) => !p.left)?.id ?? "";
  if (s.phase === "ended") return;

  me.alive = false;
  log(s, `${me.name} hat das Spiel verlassen (${roleName(me.role)}).`, false);
  if (s.lovers?.includes(me.id)) s.lovers = null;
  const waitedFor = s.pending[0]?.who === me.id;
  s.pending = s.pending.filter((p) => p.who !== me.id);
  if (s.captain === me.id) {
    const heirs = living(s);
    s.captain = heirs.length > 0 ? heirs[Math.floor(ctx.rng() * heirs.length)].id : null;
    if (s.captain) log(s, `${nameOf(s, s.captain)} ist jetzt Hauptmann (durch Los).`, false);
  }
  // Votes by or for the leaver no longer count; whoever voted for them votes again.
  for (const [voter, target] of Object.entries(s.vote.ballots)) {
    if (voter === me.id || target === me.id) delete s.vote.ballots[voter];
  }
  if (s.vote.candidates) {
    const left = s.vote.candidates.filter((id) => id !== me.id);
    s.vote.candidates = left.length > 0 ? left : null;
  }
  if (s.phase === "night") {
    const n = s.night;
    for (const [wolf, target] of Object.entries(n.wolfVotes)) {
      if (wolf === me.id || target === me.id) delete n.wolfVotes[wolf];
    }
    // The pack had chosen the leaver: while they are still awake, they choose again.
    if (n.victim === me.id && n.step === "haupt") {
      n.victim = null;
      n.done = n.done.filter((key) => !key.endsWith(":wolf"));
    }
  }

  const winner = checkWinner(s);
  if (winner) return end(s, winner);
  switch (s.phase) {
    case "roles":
      if (ackComplete(s)) afterRoles(s, ctx);
      break;
    case "announce":
      if (ackComplete(s)) afterAnnounce(s, ctx);
      break;
    case "discussion":
      if (ackComplete(s)) startVote(s, ctx);
      break;
    case "night":
      settleWolves(s);
      advanceNight(s, ctx);
      break;
    case "vote":
    case "election":
      countVotes(s, ctx);
      break;
    case "hunter":
    case "succession":
    case "scapegoat":
      if (waitedFor) afterAnnounce(s, ctx);
      break;
  }
}

/** Host escape hatch: finish the current phase with whatever has been entered. */
function force(s: GameState, ctx: Ctx) {
  switch (s.phase) {
    case "roles":
      return afterRoles(s, ctx);
    case "night":
      forceStep(s);
      return advanceNight(s, ctx);
    case "announce":
      return afterAnnounce(s, ctx);
    case "hunter":
    case "scapegoat":
    case "succession":
      if (s.phase === "succession") s.captain = null;
      s.pending.shift();
      return afterAnnounce(s, ctx);
    case "discussion":
      return startVote(s, ctx);
    case "election":
    case "vote":
      for (const p of voters(s)) if (!(p.id in s.vote.ballots)) s.vote.ballots[p.id] = null;
      return countVotes(s, ctx);
    default:
      throw new GameError("Hier gibt es nichts zu überspringen.");
  }
}

function changeSettings(s: GameState, input: Partial<Settings>) {
  const { auto, counts, captain, decoy, discussionSeconds } = input ?? {};
  if (typeof auto === "boolean") {
    s.settings.auto = auto;
    if (!auto && !counts && Object.keys(s.settings.counts).length === 0) {
      // Start from the suggestion, with exactly as many cards as players.
      s.settings.counts = countsOf(autoRoles(s.players.length));
    }
  }
  if (typeof captain === "boolean") s.settings.captain = captain;
  if (typeof decoy === "boolean") s.settings.decoy = decoy;
  if (typeof discussionSeconds === "number") {
    const d = Math.round(discussionSeconds);
    if (d !== 0 && (d < 30 || d > 900)) throw new GameError("Ungültige Diskussionszeit.");
    s.settings.discussionSeconds = d;
  }
  // The page always sends the whole choice, so it replaces the old one.
  if (counts && typeof counts === "object") {
    const next: Settings["counts"] = {};
    for (const role of ROLE_ORDER) {
      const n = counts[role];
      if (typeof n === "number" && Number.isFinite(n) && n > 0) next[role] = Math.min(MAX_PLAYERS + 2, Math.round(n));
    }
    const chosen = cards(next);
    // An empty choice starts over; any other needs a Werwolf.
    if (chosen.length > 0 && !chosen.includes("werwolf")) throw new GameError("Mindestens ein Werwolf muss dabei sein.");
    if (!fits(s.players.length, cards(s.settings.counts), chosen)) {
      const places = cardsNeeded(s.players.length, chosen);
      throw new GameError(`Es gibt nur ${places} ${places === 1 ? "Platz" : "Plätze"} für Rollen – nimm erst eine andere Rolle heraus.`);
    }
    s.settings.counts = next;
  }
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: Action,
  ctx: Ctx,
  actionId?: string,
): GameState {
  // The same request twice, e.g. after a lost connection: nothing more to do.
  if (actionId && state.handled[playerId] === actionId) return state;
  const s = structuredClone(state);
  const me = find(s, playerId);
  if (!me) throw new GameError("Du bist nicht in diesem Raum.");
  if (me.left) throw new GameError("Du hast das Spiel verlassen.");
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
  // Server time decides; the automatic choice is made on the next request.
  const inTime = () => {
    if (isOverdue(s, ctx.now)) throw new GameError("Zu spät – die Zeit ist abgelaufen.");
  };

  switch (action.type) {
    case "settings":
      hostOnly();
      inPhase("lobby");
      changeSettings(s, action.settings);
      break;

    case "ready":
      inPhase("lobby");
      s.ready = s.ready.filter((id) => id !== me.id);
      if (action.ready) s.ready.push(me.id);
      break;

    case "kick":
      hostOnly();
      inPhase("lobby");
      if (action.target === me.id) throw new GameError("Du kannst dich nicht selbst entfernen.");
      s.players = s.players.filter((p) => p.id !== action.target);
      s.ready = s.ready.filter((id) => id !== action.target);
      break;

    case "leave":
      if (s.phase === "lobby") {
        s.players = s.players.filter((p) => p.id !== me.id);
        s.ready = s.ready.filter((id) => id !== me.id);
        if (isHost) s.hostId = s.players[0]?.id ?? "";
      } else {
        leaveGame(s, me, ctx);
      }
      break;

    case "start":
      hostOnly();
      inPhase("lobby");
      startGame(s, ctx);
      break;

    case "ack":
      inPhase("roles", "announce", "discussion");
      if (!ackers(s).some((p) => p.id === me.id)) throw new GameError("Du musst gerade nichts bestätigen.");
      if (!s.acks.includes(me.id)) s.acks.push(me.id);
      if (ackComplete(s)) {
        if (s.phase === "roles") afterRoles(s, ctx);
        else if (s.phase === "announce") afterAnnounce(s, ctx);
        else startVote(s, ctx);
      }
      break;

    case "night":
      inPhase("night");
      mustLive();
      inTime();
      nightAction(s, me, action);
      advanceNight(s, ctx);
      break;

    case "vote": {
      inPhase("vote", "election");
      mustLive();
      if (!voters(s).some((p) => p.id === me.id)) throw new GameError("Du darfst diesmal nicht abstimmen.");
      inTime();
      // A verdict vote may change until the time is up and always names somebody;
      // the Hauptmann election is final and allows abstaining.
      const verdict = s.vote.kind === "lynch";
      if (!verdict && me.id in s.vote.ballots) throw new GameError("Du hast schon abgestimmt.");
      if (verdict && action.target === null) throw new GameError("Wähle einen Mitspieler.");
      let target: string | null = null;
      if (action.target !== null) {
        const t = find(s, action.target);
        if (!t || !mayVoteFor(s, me, t)) throw new GameError("Für diesen Spieler kannst du nicht stimmen.");
        target = t.id;
      }
      s.vote.ballots[me.id] = target;
      countVotes(s, ctx);
      break;
    }

    case "choose":
      inTime();
      choose(s, ctx, me, action.targets ?? []);
      break;

    case "tick":
      if (isOverdue(s, ctx.now)) expire(s, ctx);
      break;

    case "force":
      hostOnly();
      force(s, ctx);
      break;

    case "abort":
      hostOnly();
      if (s.phase === "lobby") throw new GameError("Ihr seid schon in der Lobby.");
      toLobby(s);
      break;

    case "again":
      hostOnly();
      inPhase("ended");
      toLobby(s);
      break;

    case "rejoin": {
      hostOnly();
      const request = s.rejoins.find((r) => r.id === action.request);
      if (!request) throw new GameError("Diese Anfrage gibt es nicht mehr.");
      s.rejoins = s.rejoins.filter((r) => r.playerId !== request.playerId);
      const seat = find(s, request.playerId);
      if (action.accept && seat && !seat.left) {
        const holder = seatOf(s, request.tokenHash);
        if (holder && holder.id !== seat.id) throw new GameError("Dieses Gerät hat inzwischen schon einen Platz.");
        seat.tokenHash = request.tokenHash;
      }
      break;
    }

    default:
      throw new GameError("Unbekannte Aktion.");
  }
  if (actionId) s.handled[me.id] = actionId;
  return s;
}

