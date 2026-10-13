import { ackers, nightDone, nightTask } from "./engine";
import { composition, MAX_PLAYERS, MIN_PLAYERS, ROLE_ORDER } from "./roles";
import type { GameState, Player, RoleId, View } from "./types";

/** Dead players watch as ghosts, except a hunter who still has to aim. */
function isGhost(s: GameState, p: Player) {
  return !p.alive && s.hunterPending !== p.id;
}

function canSeeRole(s: GameState, viewer: Player, target: Player): boolean {
  if (target.id === viewer.id || s.phase === "ended") return true;
  if (!target.alive) return true;
  if (isGhost(s, viewer)) return true;
  return viewer.role === "werwolf" && target.role === "werwolf";
}

function isDone(s: GameState, p: Player): boolean {
  switch (s.phase) {
    case "roles":
    case "announce":
    case "discussion":
      return s.acks.includes(p.id);
    case "night":
      return p.alive && nightDone(s, p);
    case "witch":
      return p.role === "hexe" && p.alive ? s.night.witch !== null : s.acks.includes(p.id);
    case "vote":
      return p.id in s.vote.ballots;
    default:
      return false;
  }
}

function progress(s: GameState): View["progress"] {
  const alive = s.players.filter((p) => p.alive);
  switch (s.phase) {
    case "roles":
    case "announce":
    case "discussion": {
      const need = ackers(s);
      return { done: need.filter((p) => s.acks.includes(p.id)).length, total: need.length };
    }
    case "night":
    case "witch":
    case "vote":
      return { done: alive.filter((p) => isDone(s, p)).length, total: alive.length };
    case "hunter":
      return { done: 0, total: 1 };
    default:
      return { done: 0, total: 0 };
  }
}

/** Builds what one player may see. Everything secret is filtered out here. */
export function viewFor(
  s: GameState,
  playerId: string,
  ctx: { now: number; online: Set<string> },
): View | null {
  const me = s.players.find((p) => p.id === playerId);
  if (!me) return null;
  const ghost = isGhost(s, me);
  const over = s.phase === "ended";
  // Revealing who is finished at night would expose wolves and the witch.
  const doneIsPublic = s.phase !== "night" && s.phase !== "witch";
  const comp = composition(s.players.length, s.settings);

  const dealt = s.players.map((p) => p.role).filter((r): r is RoleId => r !== null);
  const inPlay =
    s.phase === "lobby"
      ? (comp.roles ?? [])
      : dealt.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));

  const loverId =
    s.lovers && s.lovers.includes(me.id)
      ? s.lovers[0] === me.id
        ? s.lovers[1]
        : s.lovers[0]
      : null;
  const seesLovers = over || ghost || me.role === "amor";

  let night: View["night"] = null;
  if (s.phase === "night" && me.alive) {
    const task = nightTask(s, me);
    const peek = s.seerLog.find((e) => e.round === s.round);
    night = {
      task,
      pick:
        task === "wolf"
          ? (s.night.wolfVotes[me.id] ?? null)
          : task === "seer"
            ? (peek?.target ?? null)
            : task === "suspect"
              ? (s.night.suspects[me.id] ?? null)
              : null,
      wolfVotes: task === "wolf" ? s.night.wolfVotes : null,
      amorPicked: s.night.amorDone,
    };
  }

  let witch: View["witch"] = null;
  if (s.phase === "witch" && me.alive) {
    const isWitch = me.role === "hexe";
    witch = {
      isWitch,
      victim: isWitch ? s.night.victim : null,
      canHeal: isWitch && s.potions.heal && s.night.victim !== null,
      canPoison: isWitch && s.potions.poison,
    };
  }

  const noses = over
    ? s.players
        .map((p) => {
          const tips = s.suspicions.filter((t) => t.by === p.id);
          const hits = tips.filter(
            (t) => s.players.find((x) => x.id === t.target)?.role === "werwolf",
          ).length;
          return { id: p.id, hits, total: tips.length };
        })
        .filter((n) => n.total > 0)
        .sort((a, b) => b.hits - a.hits)
    : [];

  return {
    code: s.code,
    phase: s.phase,
    round: s.round,
    now: ctx.now,
    deadline: s.deadline,
    me: {
      id: me.id,
      name: me.name,
      role: me.role,
      alive: me.alive,
      host: s.hostId === me.id,
      loverId,
      done: isDone(s, me),
    },
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      host: s.hostId === p.id,
      online: ctx.online.has(p.id),
      role: canSeeRole(s, me, p) ? p.role : null,
      done: doneIsPublic && isDone(s, p),
    })),
    progress: progress(s),
    setup: {
      auto: s.settings.auto,
      custom: s.settings.custom,
      discussionSeconds: s.settings.discussionSeconds,
      roles: comp.roles,
      error: comp.error,
      min: MIN_PLAYERS,
      max: MAX_PLAYERS,
    },
    inPlay,
    lovers: seesLovers ? s.lovers : null,
    night,
    witch,
    potions: me.role === "hexe" ? s.potions : null,
    seerLog: me.role === "seherin" ? s.seerLog : null,
    announce: s.phase === "announce" || s.phase === "hunter" ? s.announce : null,
    hunterId: s.phase === "hunter" ? s.hunterPending : null,
    vote:
      s.phase === "vote"
        ? {
            round: s.vote.round,
            candidates: s.vote.candidates,
            voted: Object.keys(s.vote.ballots),
            myBallot: s.vote.ballots[me.id],
            previous: s.vote.previous,
          }
        : null,
    ended: over && s.winner ? { winner: s.winner, noses } : null,
  };
}
