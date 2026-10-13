"use client";

import { useState } from "react";
import { ROLES, roleText } from "@/lib/game/roles";
import type { NightTask } from "@/lib/game/types";
import { Avatar, Button, Card, PlayerGrid, RoleTag, Title, Waiting } from "../ui";
import { nameOf, type PhaseProps, Spectator } from "./shared";

export function RolesPhase({ view, api }: PhaseProps) {
  const [open, setOpen] = useState(false);
  if (!view.me.role) return null;
  const info = ROLES[view.me.role];
  const pack = view.players.filter((p) => p.role === "werwolf" && p.id !== view.me.id);

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
            <span className="font-display text-5xl font-extrabold text-accent">{info.name}</span>
            <span className="text-lg leading-snug">{roleText(view.me.role, view.short)}</span>
            <span className="font-extrabold text-accent">{info.goal}</span>
            {view.me.role === "werwolf" && (
              <span className="rounded-2xl bg-card px-3 py-2 font-bold">
                {pack.length > 0
                  ? `Dein Rudel: ${pack.map((p) => p.name).join(", ")}`
                  : "Du bist der einzige Werwolf."}
              </span>
            )}
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

const NIGHT_TEXT: Record<NightTask, { title: string; hint: string }> = {
  wolf: { title: "Wen erwischt ihr?", hint: "Wählt heimlich euer Opfer für diese Nacht." },
  seer: { title: "Wen durchschaust du?", hint: "Du siehst die Rolle eines Mitspielers." },
  amor: { title: "Wer verliebt sich?", hint: "Wähle zwei Verliebte. Du darfst auch dich selbst wählen." },
  suspect: {
    title: "Du schläfst tief",
    hint: "Wer könnte ein Werwolf sein? Tippe heimlich auf jemanden.",
  },
  lurk: {
    title: "Du lauerst im Dunkeln",
    hint: "Heute Nacht erwischst du niemanden. Wen willst du morgen beschuldigen? Tippe heimlich.",
  },
};

/**
 * Every living player gets a pick-somebody screen that looks the same, so
 * nobody can tell from across the table who has a special role.
 */
export function NightPhase({ view, api }: PhaseProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const night = view.night;
  if (!night) return <Spectator view={view} />;

  const { task } = night;
  const text = NIGHT_TEXT[night.lurking ? "lurk" : task];
  const need = task === "amor" ? 2 : 1;
  const alive = view.players.filter((p) => p.alive);
  const targets = alive.filter((p) =>
    task === "wolf" ? p.role !== "werwolf" : task === "amor" ? true : p.id !== view.me.id,
  );
  const packSize = alive.filter((p) => p.role === "werwolf").length;
  const votes = night.wolfVotes ?? {};
  const peek = view.seerLog?.find((e) => e.round === view.round);
  const selection = picked.length > 0 ? picked : night.pick ? [night.pick] : [];

  const pick = (id: string) =>
    setPicked((current) => {
      if (need === 1) return [id];
      if (current.includes(id)) return current.filter((x) => x !== id);
      return [...current, id].slice(-2);
    });

  const confirm = async () => {
    const [a, b] = picked;
    const ok = await api.send(
      task === "wolf"
        ? { type: "wolfVote", target: a }
        : task === "seer"
          ? { type: "seerPeek", target: a }
          : task === "amor"
            ? { type: "amorPick", a, b }
            : { type: "suspect", target: a },
    );
    if (ok) setPicked([]);
  };

  if (view.me.done) {
    return (
      <>
        <Title sub="Pssst … das Dorf schläft.">Nacht {view.round}</Title>
        {peek && (
          <Card className="rise text-center">
            <p className="text-ink-soft">Du hast hingesehen:</p>
            <p className="mt-1 text-2xl font-extrabold">
              {nameOf(view, peek.target)} ist <RoleTag role={peek.role} />
            </p>
          </Card>
        )}
        <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
          💤
        </div>
        <Waiting progress={view.progress}>Schlaf weiter, bis alle fertig sind.</Waiting>
      </>
    );
  }

  return (
    <>
      <Title sub={text.hint}>{text.title}</Title>
      {task === "wolf" && packSize > 1 && (
        <p className="text-center font-bold text-accent">
          {night.pick
            ? "Noch nicht einig – tippt alle auf dasselbe Opfer."
            : "Das ganze Rudel muss dasselbe Opfer wählen."}
        </p>
      )}
      <PlayerGrid
        players={targets}
        meId={view.me.id}
        selected={selection}
        onPick={pick}
        badge={(p) => {
          const pointing = Object.entries(votes).filter(([wolf, t]) => t === p.id && wolf !== view.me.id);
          if (pointing.length === 0) return null;
          return (
            <span className="flex -space-x-2">
              {pointing.map(([wolf]) => (
                <Avatar key={wolf} size="sm" player={{ id: wolf, name: nameOf(view, wolf) }} />
              ))}
            </span>
          );
        }}
      />
      <div className="mt-auto">
        <Button disabled={picked.length !== need || api.busy} onClick={confirm}>
          Auswählen
        </Button>
      </div>
    </>
  );
}

export function WitchPhase({ view, api }: PhaseProps) {
  const [heal, setHeal] = useState(false);
  const [poison, setPoison] = useState<string | null>(null);
  const [brewing, setBrewing] = useState(false);
  const witch = view.witch;
  if (!witch) return <Spectator view={view} />;

  if (view.me.done) {
    return (
      <>
        <Title sub="Pssst … das Dorf schläft.">Nacht {view.round}</Title>
        <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
          💤
        </div>
        <Waiting progress={view.progress}>Schlaf weiter, bis alle fertig sind.</Waiting>
      </>
    );
  }

  if (!witch.isWitch) {
    return (
      <>
        <Title sub="Tippe auf den Mond, um weiterzuschlafen.">Die Hexe erwacht</Title>
        <div className="grid flex-1 place-items-center">
          <button
            type="button"
            disabled={api.busy}
            onClick={() => api.send({ type: "ack" })}
            aria-label="Weiterschlafen"
            className="grid size-44 place-items-center rounded-full border-2 border-accent/60 bg-card-strong text-8xl transition active:scale-95"
          >
            🌙
          </button>
        </div>
      </>
    );
  }

  const others = view.players.filter((p) => p.alive && p.id !== view.me.id);
  return (
    <>
      <Title
        sub={
          witch.victim
            ? `Die Werwölfe haben ${nameOf(view, witch.victim)} erwischt.`
            : "Heute Nacht haben die Werwölfe niemanden erwischt."
        }
      >
        Die Hexe erwacht
      </Title>
      <Card className="space-y-2.5">
        <Button
          variant="quiet"
          aria-pressed={heal}
          disabled={!witch.canHeal}
          onClick={() => setHeal((h) => !h)}
          className={heal ? "border-good bg-good/20" : ""}
        >
          {!view.potions?.heal
            ? "Heiltrank ist verbraucht"
            : witch.victim
              ? `🧪 ${nameOf(view, witch.victim)} ${heal ? "wird gerettet ✓" : "retten"}`
              : "🧪 Heiltrank (heute nicht nötig)"}
        </Button>
        <Button
          variant="quiet"
          aria-pressed={brewing}
          disabled={!witch.canPoison}
          onClick={() => {
            setBrewing((b) => !b);
            setPoison(null);
          }}
          className={poison ? "border-danger bg-danger/20" : ""}
        >
          {!view.potions?.poison
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
          onClick={() => api.send({ type: "witch", heal, poison })}
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

export function HunterPhase({ view, api }: PhaseProps) {
  const [target, setTarget] = useState<string | null>(null);
  const hunter = nameOf(view, view.hunterId);

  if (view.hunterId !== view.me.id) {
    return (
      <>
        <Title sub={`${hunter} war der Jäger und darf noch ein letztes Mal schießen.`}>
          Der letzte Schuss
        </Title>
        <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
          🏹
        </div>
        <Waiting>{hunter} zielt …</Waiting>
      </>
    );
  }

  return (
    <>
      <Title sub="Du bist ausgeschieden – aber du hast noch einen Schuss. Wen nimmst du mit?">
        Dein letzter Schuss
      </Title>
      <PlayerGrid
        players={view.players.filter((p) => p.alive)}
        selected={target ? [target] : []}
        onPick={setTarget}
      />
      <div className="mt-auto">
        <Button
          disabled={!target || api.busy}
          onClick={() => target && api.send({ type: "hunterShoot", target })}
        >
          🏹 Schießen
        </Button>
      </div>
    </>
  );
}
