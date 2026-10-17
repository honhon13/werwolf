import { voters } from "./day";
import { ackers, openRejoins } from "./engine";
import { attacked, enchantable, playerDone, prey, taskDone, tasksOf, wolfConsensus } from "./night";
import { cards, cardsNeeded, composition, modeFor, ROLE_ORDER, ROLES } from "./roles";
import { find, inPack, living, neighbours, teamOf } from "./state";
import type { GameState, Player, RoleId, Task, TaskId, View } from "./types";

/** Dead players watch as ghosts, except while they still have a choice to make. */
function isGhost(s: GameState, p: Player) {
  return !p.alive && s.pending[0]?.who !== p.id;
}

function isDone(s: GameState, p: Player): boolean {
  switch (s.phase) {
    case "roles":
    case "announce":
    case "discussion":
      return s.acks.includes(p.id);
    case "night":
      return playerDone(s, p);
    case "vote":
    case "election":
      return p.id in s.vote.ballots;
    default:
      return false;
  }
}

/** How far the players who have to act in this phase are, and who is still missing. */
function progress(s: GameState): View["progress"] {
  const of = (need: Player[], done: (p: Player) => boolean) => ({
    done: need.filter(done).length,
    total: need.length,
    waiting: need.filter((p) => !done(p)).map((p) => p.name),
  });
  switch (s.phase) {
    case "roles":
    case "announce":
    case "discussion":
      return of(ackers(s), (p) => s.acks.includes(p.id));
    case "night":
      return { ...of(living(s).filter((p) => tasksOf(s, p).length > 0), (p) => playerDone(s, p)), waiting: null };
    case "vote":
    case "election":
      return of(voters(s), (p) => p.id in s.vote.ballots);
    case "hunter":
    case "succession":
    case "scapegoat":
      return { done: 0, total: 1, waiting: s.pending[0] ? [find(s, s.pending[0].who)?.name ?? "?"] : [] };
    default:
      return { done: 0, total: 0, waiting: [] };
  }
}

/** One night task as the page needs it: whom to pick, how many, what else. */
function describe(s: GameState, me: Player, id: TaskId): Task {
  const others = living(s)
    .filter((p) => p.id !== me.id)
    .map((p) => p.id);
  const all = living(s).map((p) => p.id);
  const task: Task = { id, targets: [], count: [1, 1], options: [], mayPass: false, done: taskDone(s, me, id) };
  switch (id) {
    case "dieb": {
      const both = s.center.every((r) => ROLES[r].hunts);
      task.count = [0, 0];
      task.options = s.center.map((role, i) => ({ id: String(i), label: ROLES[role].name, role }));
      if (!both) task.options.push({ id: "keep", label: "Meine Karte behalten" });
      break;
    }
    case "amor":
      task.targets = all;
      task.count = [2, 2];
      break;
    case "wolfshund":
      task.count = [0, 0];
      task.options = [
        { id: "dorf", label: "Beim Dorf bleiben" },
        { id: "wolf", label: "Mit den Wölfen jagen" },
      ];
      break;
    case "wolf":
      task.targets = prey(s).map((p) => p.id);
      task.wolfVotes = { ...s.night.wolfVotes };
      task.pick = s.night.wolfVotes[me.id] ? [s.night.wolfVotes[me.id]] : [];
      task.done = wolfConsensus(s) !== null;
      break;
    case "sleep":
      task.count = [0, 0];
      break;
    case "beschuetzer":
      task.targets = all.filter((id) => id !== s.lastProtected);
      task.blocked = s.lastProtected;
      break;
    case "fuchs":
      task.targets = all;
      break;
    case "rabe":
      task.targets = others;
      task.count = [0, 1];
      task.mayPass = true;
      break;
    case "weisserWolf":
      task.targets = living(s)
        .filter((p) => inPack(p) && p.id !== me.id)
        .map((p) => p.id);
      task.count = [0, 1];
      task.mayPass = true;
      break;
    case "floetenspieler": {
      const open = enchantable(s, me).map((p) => p.id);
      const need = Math.min(2, open.length);
      task.targets = open;
      task.count = [need, need];
      break;
    }
    case "schauspieler":
      task.targets = all;
      task.options = s.actorPowers.map((role) => ({ id: role, label: ROLES[role].name, role }));
      task.mayPass = true;
      break;
    case "maedchen":
      task.count = [0, 0];
      task.options = [
        { id: "spy", label: "Lauschen" },
        { id: "stay", label: "Weiterschlafen" },
      ];
      break;
    case "urwolf":
      task.count = [0, 0];
      task.victim = s.night.victim;
      task.options = [
        { id: "infect", label: "Infizieren" },
        { id: "kill", label: "Nicht infizieren" },
      ];
      break;
    case "grosserWolf":
      task.targets = prey(s)
        .filter((p) => p.id !== s.night.victim)
        .map((p) => p.id);
      break;
    case "hexe":
      task.targets = others;
      task.count = [0, 1];
      task.attacked = attacked(s);
      task.potions = { ...s.potions };
      break;
    default:
      // wildesKind, seherin, lurk, suspect
      task.targets = others;
  }
  return task;
}

/** Builds what one player may see. Everything secret is filtered out here. */
export function viewFor(
  s: GameState,
  playerId: string,
  ctx: { now: number; online: Set<string> },
): View | null {
  const me = find(s, playerId);
  if (!me) return null;
  const ghost = isGhost(s, me);
  const over = s.phase === "ended";
  const lobby = s.phase === "lobby";
  const all = over || ghost;
  const n = s.players.length;
  const comp = composition(n, s.settings);
  const chosen = cards(s.settings.counts);
  const myPack = inPack(me) && !lobby;
  const lover = (p: Player) => Boolean(s.lovers?.includes(p.id));
  const seesLovers = all || lover(me) || me.role === "amor";
  const seesEnchanted = all || me.enchanted || me.role === "floetenspieler";
  const canSeeRole = (p: Player) => p.id === me.id || all || !p.alive;

  const dealt = [...s.players.map((p) => p.role), ...s.center].filter((r): r is RoleId => r !== null);
  const inPlay = (lobby ? (comp.roles ?? []) : dealt).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  const showsNeighbours = me.role === "fuchs" || me.role === "baerenfuehrer" || me.role === "ritter";

  const noses = over
    ? s.players
        .map((p) => {
          const tips = s.suspicions.filter((t) => t.by === p.id);
          const hits = tips.filter((t) => {
            const target = find(s, t.target);
            return target ? inPack(target) : false;
          }).length;
          return { id: p.id, hits, total: tips.length };
        })
        .filter((x) => x.total > 0)
        .sort((a, b) => b.hits - a.hits)
    : [];

  const voting = s.phase === "vote" || s.phase === "election";
  const deciding = s.phase === "hunter" || s.phase === "succession" || s.phase === "scapegoat";

  return {
    code: s.code,
    phase: s.phase,
    short: lobby ? modeFor(n) === "kurz" : s.mode === "kurz",
    round: s.round,
    step: s.phase === "night" ? s.night.step : null,
    firstStep: s.phase === "night" && s.night.ran.length === 1,
    now: ctx.now,
    deadline: s.deadline,
    me: {
      id: me.id,
      role: me.role,
      team: me.role ? teamOf(s, me) : null,
      alive: me.alive,
      host: s.hostId === me.id,
      loverId: lover(me) ? (s.lovers!.find((id) => id !== me.id) ?? me.id) : null,
      pack: myPack,
      enchanted: me.enchanted,
      exposed: me.exposed,
      canVote: voting && voters(s).some((p) => p.id === me.id),
      done: isDone(s, me),
    },
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      host: s.hostId === p.id,
      online: ctx.online.has(p.id),
      ready: s.ready.includes(p.id),
      role: canSeeRole(p) ? p.role : null,
      pack: inPack(p) && !lobby && (all || myPack),
      enchanted: p.enchanted && seesEnchanted,
      lover: lover(p) && seesLovers,
      captain: s.captain === p.id,
      exposed: p.exposed,
      left: p.left === true,
      // Who is finished at night would expose who has a role.
      done: s.phase !== "night" && isDone(s, p),
    })),
    progress: progress(s),
    setup: {
      auto: s.settings.auto,
      counts: s.settings.counts,
      captain: s.settings.captain,
      decoy: s.settings.decoy,
      discussionSeconds: s.settings.discussionSeconds,
      mode: modeFor(n),
      roles: comp.roles,
      error: comp.error,
      needed: cardsNeeded(n, s.settings.auto ? [] : chosen),
      chosen: chosen.length,
    },
    inPlay,
    lovers: seesLovers ? s.lovers : null,
    tasks: tasksOf(s, me).map((id) => describe(s, me, id)),
    notes: s.notes[me.id] ?? [],
    potions: me.role === "hexe" ? s.potions : null,
    actorPowers: me.role === "schauspieler" ? s.actorPowers : null,
    neighbours: showsNeighbours && !lobby ? neighbours(s, me.id).map((p) => p.id) : null,
    announce: s.phase === "announce" ? s.announce : null,
    pending: deciding ? (s.pending[0] ?? null) : null,
    captain: s.captain,
    powersLost: s.powersLost,
    vote: voting
      ? {
          kind: s.vote.kind,
          round: s.vote.round,
          candidates: s.vote.candidates,
          voted: Object.keys(s.vote.ballots),
          myBallot: s.vote.ballots[me.id],
          previous: s.vote.previous,
          marked: s.vote.kind === "lynch" && s.vote.round === 1 ? s.marks : [],
        }
      : null,
    rejoins:
      s.hostId === me.id
        ? openRejoins(s, ctx.now).map((r) => ({ id: r.id, name: find(s, r.playerId)?.name ?? "?" }))
        : [],
    history: s.history.filter((h) => over || !h.secret),
    ended: over && s.winner ? { winner: s.winner, winners: s.winners, noses, center: s.center } : null,
  };
}
