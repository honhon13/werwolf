"use client";

import { useState } from "react";
import { ROLES, roleText } from "@/lib/game/roles";
import type { Task, TaskId, View } from "@/lib/game/types";
import { Avatar, Button, Card, cx, PlayerGrid, RoleTag, Title, Waiting } from "../ui";
import { nameOf, names, NoteText, type PhaseProps, Spectator } from "./shared";

/** Extra facts a role needs right from the start. */
function RoleFacts({ view }: { view: View }) {
  const { me } = view;
  const pack = view.players.filter((p) => p.pack && p.id !== me.id);
  return (
    <>
      {me.pack && (
        <span className="rounded-2xl bg-card px-3 py-2 font-bold">
          {pack.length > 0 ? `Dein Rudel: ${pack.map((p) => p.name).join(", ")}` : "Du bist der einzige Wolf."}
        </span>
      )}
      {view.actorPowers && view.actorPowers.length > 0 && (
        <span className="rounded-2xl bg-card px-3 py-2 font-bold">
          Deine Fähigkeiten: {view.actorPowers.map((r) => ROLES[r].name).join(", ")}
        </span>
      )}
      {view.neighbours && view.neighbours.length > 0 && (
        <span className="rounded-2xl bg-card px-3 py-2 font-bold">Deine Nachbarn: {names(view, view.neighbours)}</span>
      )}
    </>
  );
}

export function RolesPhase({ view, api }: PhaseProps) {
  const [open, setOpen] = useState(false);
  if (!view.me.role) return null;
  const info = ROLES[view.me.role];

  return (
    <>
      <Title sub="Halte dein Handy so, dass niemand mitlesen kann.">Deine Rolle</Title>
      <div className="flip rise" data-open={open}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Rolle verdecken" : "Rolle aufdecken"}
          className="flip-inner block w-full text-ink"
        >
          <span className="flip-face flip-back flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-accent/60 bg-[#252b66] p-6">
            <span className="text-8xl">🌙</span>
            <span className="text-xl font-extrabold">Tippe, um aufzudecken</span>
          </span>
          <span className="flip-face flip-front flex min-h-96 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-accent bg-[#1b215a] p-6 text-center">
            <span className="text-8xl">{info.emoji}</span>
            <span className="font-display text-5xl leading-none font-extrabold text-accent">{info.name}</span>
            <span className="text-lg leading-snug">{roleText(view.me.role, view.short)}</span>
            <span className="font-extrabold text-accent">{info.goal}</span>
            <RoleFacts view={view} />
          </span>
        </button>
      </div>
      <div className="mt-auto">
        {view.me.done ? (
          <Waiting progress={view.progress}>Warte, bis alle ihre Rolle kennen …</Waiting>
        ) : (
          <Button disabled={!open || api.busy} onClick={() => api.send({ type: "ack" })}>
            {open ? "Verstanden" : "Erst aufdecken"}
          </Button>
        )}
      </div>
    </>
  );
}

type Text = { title: string; hint: string };

const TASK_TEXT: Record<Exclude<TaskId, "hexe" | "sleep">, (view: View, task: Task) => Text> = {
  dieb: () => ({ title: "Du bist der Dieb", hint: "Tausche deine Karte gegen eine der beiden – oder behalte sie." }),
  amor: () => ({ title: "Wer verliebt sich?", hint: "Wähle zwei Verliebte. Du darfst auch dich selbst wählen." }),
  wildesKind: () => ({ title: "Wähle dein Vorbild", hint: "Stirbt es, wirst du zum Werwolf." }),
  wolfshund: () => ({ title: "Auf welcher Seite stehst du?", hint: "Die Entscheidung gilt für das ganze Spiel." }),
  wolf: () => ({ title: "Wen greift ihr an?", hint: "Das ganze Rudel muss sich auf ein Opfer einigen." }),
  lurk: () => ({
    title: "Du lauerst im Dunkeln",
    hint: "Heute Nacht erwischst du niemanden. Wen willst du morgen beschuldigen? Tippe heimlich.",
  }),
  suspect: () => ({ title: "Du schläfst tief", hint: "Wer könnte ein Werwolf sein? Tippe heimlich auf jemanden." }),
  seherin: () => ({ title: "Wen durchschaust du?", hint: "Du siehst die Rolle dieses Mitspielers." }),
  beschuetzer: (view, task) => ({
    title: "Wen beschützt du?",
    hint: task.blocked
      ? `Heute nicht noch einmal ${nameOf(view, task.blocked)}.`
      : "Du darfst auch dich selbst schützen.",
  }),
  fuchs: () => ({ title: "Wo schnupperst du?", hint: "Du erfährst, ob bei ihm oder seinen beiden Nachbarn ein Wolf ist." }),
  rabe: () => ({ title: "Wen markierst du?", hint: "Er hat morgen zwei Stimmen gegen sich. Du darfst auch niemanden wählen." }),
  floetenspieler: (_, task) => ({
    title: "Wen verzauberst du?",
    hint: task.count[0] === 1 ? "Nur einer ist noch nicht verzaubert." : "Wähle zwei Mitspieler.",
  }),
  schauspieler: () => ({ title: "Welche Rolle spielst du?", hint: "Jede Fähigkeit nur einmal – oder heute keine." }),
  maedchen: () => ({
    title: "Lauschst du heute?",
    hint: "Du erfährst den Namen eines Wolfs – aber mit 1 zu 3 bemerken sie dich.",
  }),
  urwolf: (view, task) => ({
    title: "Infizieren?",
    hint: `Euer Opfer ist ${nameOf(view, task.victim)}. Infiziert überlebt es und gehört zum Rudel. Das geht nur einmal.`,
  }),
  grosserWolf: () => ({ title: "Dein zweites Opfer", hint: "Solange kein Wolf gestorben ist, darfst du allein ein zweites Opfer wählen." }),
  weisserWolf: () => ({ title: "Ein Wolf weniger?", hint: "Du darfst heimlich einen Wolf töten – oder niemanden." }),
};

/** Tasks whose screen should look alike, so a glance across the table gives nothing away. */
function NightWait({ view }: { view: View }) {
  const results = view.notes.filter((n) => "round" in n && n.round === view.round);
  const hadTasks = view.tasks.length > 0;
  return (
    <>
      <Title sub="Pssst … das Dorf schläft.">Nacht {view.round}</Title>
      {results.length > 0 && (
        <Card className="rise space-y-1.5 text-center text-lg font-bold">
          {results.map((note, i) => (
            <p key={i}>
              <NoteText view={view} note={note} />
            </p>
          ))}
        </Card>
      )}
      <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
        💤
      </div>
      <Waiting progress={view.progress}>
        {hadTasks ? "Schlaf weiter, bis alle fertig sind." : "Die Nacht läuft. Du hast gerade nichts zu tun."}
      </Waiting>
    </>
  );
}

function MoonTap({ view, api }: PhaseProps) {
  const title =
    view.step === "hexe" ? "Die Hexe erwacht" : view.firstStep ? `Nacht ${view.round}` : "Die Nacht geht weiter";
  return (
    <>
      <Title sub="Tippe auf den Mond, um weiterzuschlafen.">{title}</Title>
      <div className="grid flex-1 place-items-center">
        <button
          type="button"
          disabled={api.busy}
          onClick={() => api.send({ type: "night", task: "sleep" })}
          aria-label="Weiterschlafen"
          className="grid size-44 place-items-center rounded-full border-2 border-accent/60 bg-card-strong text-8xl transition active:scale-95"
        >
          🌙
        </button>
      </div>
    </>
  );
}

function WitchTask({ view, api, task }: PhaseProps & { task: Task }) {
  const [heal, setHeal] = useState<string | null>(null);
  const [poison, setPoison] = useState<string | null>(null);
  const [brewing, setBrewing] = useState(false);
  const potions = task.potions!;
  const attacked = task.attacked ?? [];
  const others = view.players.filter((p) => task.targets.includes(p.id));
  const who = (id: string) => (id === view.me.id ? "dich" : nameOf(view, id));

  return (
    <>
      <Title
        sub={
          attacked.length > 0
            ? `Die Wölfe haben ${attacked.map(who).join(" und ")} angegriffen.`
            : "Heute Nacht haben die Wölfe niemanden angegriffen."
        }
      >
        Die Hexe erwacht
      </Title>
      <Card className="space-y-2.5">
        {!potions.heal ? (
          <p className="text-center font-bold text-ink-soft">Der Heiltrank ist verbraucht.</p>
        ) : (
          attacked.map((id) => (
            <Button
              key={id}
              variant="quiet"
              aria-pressed={heal === id}
              onClick={() => setHeal(heal === id ? null : id)}
              className={heal === id ? "border-good bg-good/20" : ""}
            >
              🧪{" "}
              {id === view.me.id
                ? heal === id
                  ? "Du rettest dich selbst ✓"
                  : "Dich selbst retten"
                : `${nameOf(view, id)} ${heal === id ? "wird gerettet ✓" : "retten"}`}
            </Button>
          ))
        )}
        <Button
          variant="quiet"
          aria-pressed={brewing}
          disabled={!potions.poison}
          onClick={() => {
            setBrewing((b) => !b);
            setPoison(null);
          }}
          className={poison ? "border-danger bg-danger/20" : ""}
        >
          {!potions.poison
            ? "Gifttrank ist verbraucht"
            : poison
              ? `☠️ Gift für ${nameOf(view, poison)} ✓`
              : "☠️ Gifttrank benutzen"}
        </Button>
        {brewing && <PlayerGrid players={others} selected={poison ? [poison] : []} onPick={setPoison} />}
      </Card>
      <div className="mt-auto">
        <Button
          disabled={api.busy || (brewing && !poison)}
          onClick={() => api.send({ type: "night", task: "hexe", heal, poison })}
        >
          {brewing && !poison
            ? "Wähle, wen das Gift trifft"
            : heal && poison
              ? "Beide Tränke einsetzen"
              : heal || poison
                ? "Trank einsetzen"
                : "Nichts tun"}
        </Button>
      </div>
    </>
  );
}

function TaskScreen({ view, api, task }: PhaseProps & { task: Task }) {
  const [picked, setPicked] = useState<string[]>(task.pick ?? []);
  const [option, setOption] = useState<string | null>(null);
  if (task.id === "sleep") return <MoonTap view={view} api={api} />;
  if (task.id === "hexe") return <WitchTask view={view} api={api} task={task} />;

  const text = TASK_TEXT[task.id](view, task);
  const actor = task.id === "schauspieler";
  const [min, max] = actor ? [1, 1] : task.count;
  const choosesOption = task.options.length > 0 || actor;
  const needsTarget = actor ? Boolean(option && option !== "pass") : max > 0;
  const noSelf = actor && option === "seherin";
  const targets = view.players.filter((p) => task.targets.includes(p.id) && !(noSelf && p.id === view.me.id));
  const votes = task.wolfVotes ?? {};
  const changed = task.id !== "wolf" || picked[0] !== task.pick?.[0];

  const ready = actor
    ? option === "pass" || (option !== null && picked.length === 1)
    : task.options.length > 0
      ? option !== null
      : picked.length >= min && picked.length <= max && changed;

  const pick = (id: string) =>
    setPicked((current) => {
      if (max === 1) return current[0] === id && task.mayPass ? [] : [id];
      if (current.includes(id)) return current.filter((x) => x !== id);
      return [...current, id].slice(-max);
    });

  const confirm = async () => {
    const targetsToSend = needsTarget ? picked : [];
    const ok = await api.send({ type: "night", task: task.id, targets: targetsToSend, option });
    if (ok && task.id !== "wolf") setPicked([]);
  };

  return (
    <>
      <Title sub={text.hint}>{text.title}</Title>
      {task.id === "wolf" && task.pick && task.pick.length > 0 && (
        <p className="text-center font-bold text-accent">Noch nicht einig – tippt alle auf dasselbe Opfer.</p>
      )}
      {choosesOption && (
        <div className="grid grid-cols-1 gap-2.5">
          {task.options.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={option === o.id}
              onClick={() => {
                setOption(o.id);
                setPicked([]);
              }}
              className={cx(
                "min-h-14 rounded-2xl border px-4 text-lg font-extrabold transition",
                option === o.id ? "border-accent bg-accent/20 ring-2 ring-accent" : "border-line bg-card",
              )}
            >
              {o.role ? <RoleTag role={o.role} /> : o.label}
            </button>
          ))}
          {actor && (
            <button
              type="button"
              aria-pressed={option === "pass"}
              onClick={() => setOption("pass")}
              className={cx(
                "min-h-12 rounded-2xl border px-4 font-extrabold text-ink-soft",
                option === "pass" ? "border-accent bg-accent/20" : "border-line bg-card",
              )}
            >
              Heute keine Rolle spielen
            </button>
          )}
        </div>
      )}
      {needsTarget && (
        <PlayerGrid
          players={targets}
          meId={view.me.id}
          selected={picked}
          onPick={pick}
          badge={(p) => {
            const mates = Object.entries(votes).filter(([wolf, t]) => t === p.id && wolf !== view.me.id);
            if (mates.length === 0) return null;
            return (
              <span className="flex -space-x-2">
                {mates.map(([wolf]) => (
                  <Avatar key={wolf} size="sm" player={{ id: wolf, name: nameOf(view, wolf) }} />
                ))}
              </span>
            );
          }}
        />
      )}
      <div className="mt-auto">
        <Button disabled={!ready || api.busy} onClick={confirm}>
          {task.mayPass && picked.length === 0 && !actor ? "Niemanden wählen" : "Auswählen"}
        </Button>
      </div>
    </>
  );
}

/**
 * The night: players with a task get it, everybody else a quiet waiting
 * screen. With decoys on, everybody gets a task that looks alike.
 */
export function NightPhase({ view, api }: PhaseProps) {
  if (!view.me.alive) return <Spectator view={view} />;
  const task = view.tasks.find((t) => !t.done);
  if (!task) return <NightWait view={view} />;
  return <TaskScreen key={`${view.step}:${task.id}`} view={view} api={api} task={task} />;
}
