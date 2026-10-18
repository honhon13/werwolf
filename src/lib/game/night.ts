import { kill } from "./death";
import { ACTOR_POWERS, ROLES } from "./roles";
import {
  type Ctx,
  find,
  GameError,
  hasPower,
  holder,
  inPack,
  living,
  log,
  nameOf,
  neighbours,
  note,
  pack,
  roleName,
} from "./state";
import type { Action, Announce, Death, GameState, NightState, NightStep, Player, TaskId } from "./types";

/** The order of the night. Steps in which nobody has anything to do are skipped. */
export const STEPS: NightStep[] = ["dieb", "erwachen", "haupt", "rudel", "hexe"];

export function freshNight(): NightState {
  return {
    step: null,
    ran: [],
    done: [],
    wolfVotes: {},
    victim: null,
    infect: false,
    bigWolfVictim: null,
    whiteWolfVictim: null,
    protect: null,
    actorProtect: null,
    enchant: [],
    marks: [],
    girlSpies: false,
    witch: null,
    suspects: {},
  };
}

/** Players the Flötenspieler can still enchant. */
export function enchantable(s: GameState, piper: Player) {
  return living(s).filter((p) => p.id !== piper.id && !p.enchanted);
}

/** Living players the pack may attack. */
export const prey = (s: GameState) => living(s).filter((p) => !inPack(p));

/** What a player really has to do in a step, before decoys. */
export function realTasks(s: GameState, p: Player, step: NightStep): TaskId[] {
  if (!p.alive) return [];
  const has = (role: Parameters<typeof hasPower>[2]) => hasPower(s, p, role);
  const first = s.round === 1;
  const tasks: (TaskId | false)[] = [];
  switch (step) {
    case "dieb":
      tasks.push(first && has("dieb") && s.center.length === 2 && "dieb");
      break;
    case "erwachen":
      tasks.push(
        first && has("amor") && "amor",
        first && has("wildesKind") && "wildesKind",
        first && p.role === "wolfshund" && "wolfshund",
      );
      break;
    case "haupt":
      tasks.push(
        s.mode !== "kurz" && inPack(p) && "wolf",
        has("seherin") && "seherin",
        has("beschuetzer") && "beschuetzer",
        has("fuchs") && s.foxActive && "fuchs",
        has("rabe") && "rabe",
        p.role === "floetenspieler" && enchantable(s, p).length > 0 && "floetenspieler",
        has("schauspieler") && s.actorPowers.length > 0 && "schauspieler",
        has("maedchen") && s.mode !== "kurz" && pack(s).length > 0 && "maedchen",
      );
      break;
    case "rudel": {
      const victim = find(s, s.night.victim);
      tasks.push(
        p.role === "urwolf" && !s.infectionUsed && victim?.alive === true && !inPack(victim) && "urwolf",
        p.role === "grosserWolf" && !s.packLost && prey(s).some((v) => v.id !== s.night.victim) && "grosserWolf",
        p.role === "weisserWolf" && s.round % 2 === 0 && pack(s).some((w) => w.id !== p.id) && "weisserWolf",
      );
      break;
    }
    case "hexe":
      tasks.push(has("hexe") && "hexe");
      break;
  }
  return tasks.filter((t): t is TaskId => t !== false);
}

export function stepHasWork(s: GameState, step: NightStep) {
  return living(s).some((p) => realTasks(s, p, step).length > 0);
}

/** Everything a player has to do in the current step, decoys included. */
export function tasksOf(s: GameState, p: Player): TaskId[] {
  const step = s.night.step;
  if (s.phase !== "night" || !step || !p.alive) return [];
  const real = realTasks(s, p, step);
  if (real.length > 0 || !s.settings.decoy) return real;
  if (step !== "haupt") return ["sleep"];
  return s.mode === "kurz" && inPack(p) ? ["lurk"] : ["suspect"];
}

const key = (p: Player, task: TaskId) => `${p.id}:${task}`;
export const taskDone = (s: GameState, p: Player, task: TaskId) => s.night.done.includes(key(p, task));
export const playerDone = (s: GameState, p: Player) => tasksOf(s, p).every((t) => taskDone(s, p, t));
export const stepComplete = (s: GameState) => living(s).every((p) => playerDone(s, p));

/** The victim all living wolves agree on, or null while they still differ. */
export function wolfConsensus(s: GameState): string | null {
  const wolves = pack(s);
  const first = wolves.length > 0 ? s.night.wolfVotes[wolves[0].id] : undefined;
  if (!first) return null;
  return wolves.every((w) => s.night.wolfVotes[w.id] === first) ? first : null;
}

/** Players attacked tonight, as the Hexe sees them. Somebody who left is not among them. */
export function attacked(s: GameState): string[] {
  const n = s.night;
  const ids = [n.infect ? null : n.victim, n.bigWolfVictim, n.whiteWolfVictim];
  return [...new Set(ids.filter((id): id is string => Boolean(id) && find(s, id)?.alive === true))];
}

/** Once all living wolves agree, their victim stands and their task is done. */
export function settleWolves(s: GameState) {
  const victim = wolfConsensus(s);
  if (!victim || s.night.victim) return;
  s.night.victim = victim;
  for (const w of pack(s)) finish(s, w, "wolf");
  log(s, `Die Wölfe wählten ${nameOf(s, victim)}.`, true);
}

function finish(s: GameState, p: Player, task: TaskId) {
  if (!taskDone(s, p, task)) s.night.done.push(key(p, task));
}

type NightAction = Extract<Action, { type: "night" }>;

/** Checks and records one night action. The caller moves the night on. */
export function nightAction(s: GameState, me: Player, action: NightAction) {
  const task = action.task;
  if (!tasksOf(s, me).includes(task)) throw new GameError("Das ist gerade nicht deine Aufgabe.");
  if (taskDone(s, me, task) && task !== "wolf") throw new GameError("Das hast du heute Nacht schon erledigt.");
  const n = s.night;
  const targets = (action.targets ?? []).filter((t, i, all) => all.indexOf(t) === i);
  const one = () => {
    if (targets.length !== 1) throw new GameError("Wähle genau einen Spieler.");
    const p = find(s, targets[0]);
    if (!p?.alive) throw new GameError("Diesen Spieler kannst du nicht wählen.");
    return p;
  };
  const notMe = (p: Player) => {
    if (p.id === me.id) throw new GameError("Dich selbst kannst du hier nicht wählen.");
    return p;
  };

  switch (task) {
    case "dieb": {
      const both = s.center.every((r) => ROLES[r].hunts);
      if (action.option === "keep") {
        if (both) throw new GameError("Beide Karten sind Wolfskarten – du musst eine nehmen.");
        note(s, me.id, { kind: "thief", round: s.round, took: null, center: [...s.center] });
        log(s, `Der Dieb (${me.name}) behielt seine Karte.`, true);
      } else {
        const i = Number(action.option);
        if (i !== 0 && i !== 1) throw new GameError("Wähle eine der beiden Karten.");
        const seen = [...s.center];
        const took = s.center[i];
        s.center[i] = "dieb";
        me.role = took;
        note(s, me.id, { kind: "thief", round: s.round, took, center: seen });
        log(s, `Der Dieb (${me.name}) nahm die Karte ${roleName(took)}.`, true);
      }
      break;
    }

    case "amor": {
      if (targets.length !== 2) throw new GameError("Wähle zwei Verliebte.");
      const [a, b] = targets.map((id) => find(s, id));
      if (!a?.alive || !b?.alive) throw new GameError("Diese Spieler kannst du nicht wählen.");
      s.lovers = [a.id, b.id];
      log(s, `Amor verliebte ${a.name} und ${b.name}.`, true);
      break;
    }

    case "wildesKind": {
      const model = notMe(one());
      s.wildModel = model.id;
      note(s, me.id, { kind: "model", round: s.round, target: model.id });
      log(s, `Das Wilde Kind (${me.name}) wählte ${model.name} als Vorbild.`, true);
      break;
    }

    case "wolfshund": {
      if (action.option !== "wolf" && action.option !== "dorf") throw new GameError("Entscheide dich für eine Seite.");
      const wolf = action.option === "wolf";
      if (wolf) me.turned = true;
      note(s, me.id, { kind: "dog", round: s.round, wolf });
      log(s, `Der Wolfshund (${me.name}) entschied sich für ${wolf ? "die Wölfe" : "das Dorf"}.`, true);
      break;
    }

    case "wolf": {
      if (wolfConsensus(s)) throw new GameError("Ihr habt euch schon entschieden.");
      const target = one();
      if (inPack(target)) throw new GameError("Wölfe greifen keine Wölfe an.");
      n.wolfVotes[me.id] = target.id;
      settleWolves(s);
      return;
    }

    case "lurk":
    case "suspect": {
      const target = notMe(one());
      n.suspects[me.id] = target.id;
      if (task === "suspect") s.suspicions.push({ round: s.round, by: me.id, target: target.id });
      break;
    }

    case "sleep":
      break;

    case "seherin": {
      const target = notMe(one());
      note(s, me.id, { kind: "seen", round: s.round, target: target.id, role: target.role! });
      log(s, `Die Seherin sah ${target.name}: ${roleName(target.role)}.`, true);
      break;
    }

    case "beschuetzer": {
      const target = one();
      if (target.id === s.lastProtected) throw new GameError("Denselben Spieler darfst du nicht zweimal hintereinander schützen.");
      n.protect = target.id;
      note(s, me.id, { kind: "protected", round: s.round, target: target.id });
      log(s, `Der Beschützer schützte ${target.name}.`, true);
      break;
    }

    case "fuchs":
      sniff(s, me, one(), false);
      break;

    case "rabe": {
      if (targets.length > 0) {
        const target = notMe(one());
        n.marks.push(target.id);
        note(s, me.id, { kind: "marked", round: s.round, target: target.id });
        log(s, `Der Rabe markierte ${target.name}.`, true);
      }
      break;
    }

    case "floetenspieler": {
      const open = enchantable(s, me).map((p) => p.id);
      const need = Math.min(2, open.length);
      if (targets.length !== need || !targets.every((t) => open.includes(t))) {
        throw new GameError(need === 2 ? "Verzaubere zwei Spieler." : "Verzaubere den letzten Spieler.");
      }
      n.enchant = targets;
      note(s, me.id, { kind: "enchanted", round: s.round, targets });
      log(s, `Der Flötenspieler verzauberte ${targets.map((t) => nameOf(s, t)).join(" und ")}.`, true);
      break;
    }

    case "schauspieler": {
      if (action.option === "pass" || !action.option) break;
      const power = action.option as Player["role"];
      if (!power || !s.actorPowers.includes(power) || !ACTOR_POWERS.includes(power)) {
        throw new GameError("Diese Fähigkeit hast du nicht mehr.");
      }
      const target = one();
      if (power === "seherin") {
        notMe(target);
        note(s, me.id, { kind: "seen", round: s.round, target: target.id, role: target.role!, actor: true });
      } else if (power === "beschuetzer") {
        n.actorProtect = target.id;
        note(s, me.id, { kind: "protected", round: s.round, target: target.id, actor: true });
      } else {
        sniff(s, me, target, true);
      }
      s.actorPowers = s.actorPowers.filter((r) => r !== power);
      log(s, `Der Schauspieler spielte ${roleName(power)} und wählte ${target.name}.`, true);
      break;
    }

    case "maedchen": {
      if (action.option !== "spy" && action.option !== "stay") throw new GameError("Lauschen oder schlafen?");
      n.girlSpies = action.option === "spy";
      break;
    }

    case "urwolf": {
      if (action.option !== "infect" && action.option !== "kill") throw new GameError("Infizieren oder nicht?");
      n.infect = action.option === "infect";
      if (n.infect) log(s, `Der Urwolf wollte ${nameOf(s, n.victim)} infizieren.`, true);
      break;
    }

    case "grosserWolf": {
      const target = one();
      if (inPack(target) || target.id === n.victim) throw new GameError("Wähle ein anderes Opfer.");
      n.bigWolfVictim = target.id;
      log(s, `Der Große böse Wolf wählte ${target.name}.`, true);
      break;
    }

    case "weisserWolf": {
      if (targets.length > 0) {
        const target = notMe(one());
        if (!inPack(target)) throw new GameError("Du kannst nur einen Wolf wählen.");
        n.whiteWolfVictim = target.id;
        log(s, `Der Weiße Werwolf griff ${target.name} an.`, true);
      }
      break;
    }

    case "hexe": {
      const heal = action.heal ?? null;
      const poison = action.poison ?? null;
      if (heal && (!s.potions.heal || !attacked(s).includes(heal))) throw new GameError("Der Heiltrank hilft hier nicht.");
      if (poison) {
        if (!s.potions.poison) throw new GameError("Der Gifttrank ist schon verbraucht.");
        const target = find(s, poison);
        if (!target?.alive || target.id === me.id) throw new GameError("Diesen Spieler kannst du nicht vergiften.");
      }
      n.witch = { heal, poison };
      if (heal) log(s, `Die Hexe rettete ${nameOf(s, heal)}.`, true);
      if (poison) log(s, `Die Hexe vergiftete ${nameOf(s, poison)}.`, true);
      break;
    }
  }
  finish(s, me, task);
}

/** The Fuchs smells a player and both living neighbours. */
function sniff(s: GameState, me: Player, target: Player, actor: boolean) {
  const group = [target, ...neighbours(s, target.id)];
  const wolf = group.some(inPack);
  note(s, me.id, { kind: "sniffed", round: s.round, targets: group.map((p) => p.id), wolf, actor });
  log(s, `Der Fuchs schnupperte bei ${group.map((p) => p.name).join(", ")}: ${wolf ? "Wolf dabei" : "kein Wolf"}.`, true);
  if (!wolf && !actor) s.foxActive = false;
}

/** What happens when a step is over, before the next one starts. */
export function endStep(s: GameState, ctx: Ctx) {
  const n = s.night;
  if (n.step !== "haupt") return;
  if (!n.victim) {
    // Forced on by the host: the most chosen victim, if any.
    const counts = new Map<string, number>();
    for (const w of pack(s)) {
      const t = n.wolfVotes[w.id];
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    n.victim = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const girl = holder(s, "maedchen");
  if (girl && n.girlSpies) {
    if (ctx.rng() < 1 / 3) {
      n.victim = girl.id;
      log(s, "Die Wölfe bemerkten das lauschende Kleine Mädchen und griffen es an.", true);
    } else {
      const wolves = pack(s);
      const wolf = wolves[Math.floor(ctx.rng() * wolves.length)] ?? null;
      note(s, girl.id, { kind: "spied", round: s.round, wolf: wolf?.id ?? null });
      log(s, `Das Kleine Mädchen lauschte und erkannte ${wolf?.name ?? "niemanden"}.`, true);
    }
  }
}

/**
 * What the game decides for a player whose time ran out: a random choice
 * where the task requires one, and no use where a power may be left unused,
 * so chance never wastes a potion or marks somebody.
 */
function automatic(s: GameState, me: Player, task: TaskId, rng: () => number): NightAction | null {
  const pick = <T>(items: T[]) => items[Math.floor(rng() * items.length)];
  const all = living(s).map((p) => p.id);
  const others = all.filter((id) => id !== me.id);
  const one = (ids: string[]): NightAction => ({ type: "night", task, targets: ids.length > 0 ? [pick(ids)] : [] });
  switch (task) {
    case "dieb":
      return { type: "night", task, option: pick(s.center.every((r) => ROLES[r].hunts) ? ["0", "1"] : ["0", "1", "keep"]) };
    case "amor": {
      const first = pick(all);
      return { type: "night", task, targets: [first, pick(all.filter((id) => id !== first))] };
    }
    case "wolfshund":
      return { type: "night", task, option: pick(["dorf", "wolf"]) };
    case "wolf":
      return one(prey(s).map((p) => p.id));
    case "beschuetzer":
      return one(all.filter((id) => id !== s.lastProtected));
    case "fuchs":
      return one(all);
    case "floetenspieler": {
      const open = enchantable(s, me).map((p) => p.id);
      const first = pick(open);
      return { type: "night", task, targets: open.length > 1 ? [first, pick(open.filter((id) => id !== first))] : [first] };
    }
    case "grosserWolf":
      return one(prey(s).filter((p) => p.id !== s.night.victim).map((p) => p.id));
    case "wildesKind":
    case "seherin":
      return one(others);
    case "rabe":
    case "weisserWolf":
      return { type: "night", task, targets: [] };
    case "schauspieler":
      return { type: "night", task, option: "pass" };
    case "maedchen":
      return { type: "night", task, option: "stay" };
    case "urwolf":
      return { type: "night", task, option: "kill" };
    case "hexe":
      return { type: "night", task, heal: null, poison: null };
    default:
      // Decoys (sleep, suspect, lurk) decide nothing; a guess is not invented.
      return null;
  }
}

/** The step's time is up: everybody who has not acted gets the automatic choice. */
export function decideForAbsent(s: GameState, rng: () => number) {
  for (const p of living(s)) {
    for (const task of tasksOf(s, p)) {
      if (taskDone(s, p, task) || (task === "wolf" && s.night.wolfVotes[p.id])) continue;
      const action = automatic(s, p, task, rng);
      if (action) {
        try {
          nightAction(s, p, action);
        } catch (e) {
          if (!(e instanceof GameError)) throw e;
        }
      }
    }
  }
  // Wolves who still disagree: the step ends with the victim most of them chose.
  forceStep(s);
}

/** Fills in what nobody entered, so the host can move a stuck night on. */
export function forceStep(s: GameState) {
  for (const p of living(s)) for (const t of tasksOf(s, p)) finish(s, p, t);
}

/** Works out the night in a fixed order and returns the morning announcement. */
export function resolveNight(s: GameState): Announce {
  const n = s.night;
  const deaths: Death[] = [];
  const powersBefore = s.powersLost;
  const sick = s.tetanus;
  s.tetanus = null;
  const shield = new Set([n.protect, n.actorProtect].filter(Boolean));

  if (n.victim && n.infect) {
    s.infectionUsed = true;
    const v = find(s, n.victim);
    if (v?.alive && !shield.has(v.id)) {
      v.turned = true;
      note(s, v.id, { kind: "turned", round: s.round, why: "infected" });
      for (const w of pack(s)) if (w.id !== v.id) note(s, w.id, { kind: "infected", round: s.round, target: v.id });
      log(s, `${v.name} wurde vom Urwolf infiziert und gehört jetzt zum Rudel.`, true);
    } else {
      log(s, "Die Infektion des Urwolfs wurde abgewehrt.", true);
    }
  }

  for (const target of attacked(s)) {
    const p = find(s, target);
    if (!p?.alive) continue;
    if (shield.has(target)) {
      log(s, `Der Schutz bewahrte ${p.name} vor den Wölfen.`, true);
    } else if (n.witch?.heal === target) {
      log(s, `Der Heiltrank rettete ${p.name}.`, true);
    } else if (p.role === "aeltester" && s.elderShield) {
      s.elderShield = false;
      log(s, `Der Älteste ${p.name} überstand den Angriff der Wölfe.`, true);
    } else {
      kill(s, target, "wolf", deaths);
    }
  }
  if (n.witch?.heal) s.potions.heal = false;
  if (n.witch?.poison) {
    s.potions.poison = false;
    kill(s, n.witch.poison, "gift", deaths);
  }
  if (sick) kill(s, sick, "tetanus", deaths);

  for (const id of n.enchant) {
    const p = find(s, id);
    if (p?.alive) p.enchanted = true;
  }
  s.marks = n.marks.filter((id) => find(s, id)?.alive);
  s.lastProtected = n.protect;
  if (s.round >= 1) s.angelChance = false;

  const bear = holder(s, "baerenfuehrer");
  const growl = bear ? inPack(bear) || neighbours(s, bear.id).some(inPack) : null;
  if (growl !== null) log(s, growl ? "Am Morgen brummte der Bär." : "Am Morgen blieb der Bär ruhig.", false);
  for (const id of s.marks) log(s, `Der Rabe markierte ${nameOf(s, id)}: zwei Stimmen gegen ${nameOf(s, id)}.`, false);

  return {
    kind: "morning",
    deaths,
    growl,
    marked: [...s.marks],
    powersLost: s.powersLost && !powersBefore,
  };
}

/** Starts a step of the night. */
export function advanceTo(s: GameState, step: NightStep) {
  s.night.step = step;
  s.night.ran.push(step);
  s.night.done = [];
}
