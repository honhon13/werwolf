"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGameSound, useSoundSettings } from "@/lib/client/sound/useSound";
import type { RoomApi } from "@/lib/client/useRoom";
import { ROLES, roleText } from "@/lib/game/roles";
import type { Phase, View } from "@/lib/game/types";
import { AnnouncePhase, DiscussionPhase, EndedPhase, PendingPhase, VotePhase } from "./phases/Day";
import { Lobby } from "./phases/Lobby";
import { NightPhase, RolesPhase } from "./phases/Night";
import { nameOf, names, NoteText } from "./phases/shared";
import { Rules } from "./Rules";
import { Button, Card, RoleChips, Sheet } from "./ui";

const day = (v: View) => `Tag ${v.round}`;

const PHASE_LABEL: Record<Phase, (view: View) => string> = {
  lobby: () => "Lobby",
  roles: () => "Rollen",
  night: (v) => `Nacht ${v.round}`,
  announce: (v) => (v.announce?.kind === "morning" ? `Morgen ${v.round}` : day(v)),
  hunter: day,
  succession: day,
  scapegoat: day,
  election: day,
  discussion: day,
  vote: day,
  ended: () => "Spielende",
};

function skyFor(view: View): "night" | "day" {
  switch (view.phase) {
    case "announce":
    case "hunter":
    case "succession":
    case "scapegoat":
    case "election":
    case "discussion":
    case "vote":
      return "day";
    case "ended":
      return view.ended?.winner === "dorf" || view.ended?.winner === "paar" || view.ended?.winner === "engel"
        ? "day"
        : "night";
    default:
      return "night";
  }
}

/** Keeps the phone from going dark while everybody waits for each other. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (released) void lock.release();
      } catch {
        // Not allowed right now, e.g. battery saver.
      }
    };
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** A short buzz when the game moves on and it is this player's turn. */
function useBuzz(view: View) {
  const moment = `${view.phase}:${view.round}:${view.step}:${view.announce?.kind}:${view.vote?.kind}:${view.vote?.round}`;
  const idle = view.me.done || view.phase === "lobby";
  useEffect(() => {
    // Browsers refuse to vibrate before the first tap and log an error.
    if (!idle && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(60);
    // Only when the moment changes, not when the player finishes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment]);
}

function ConfirmButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant="danger"
      onClick={() => {
        if (armed) onConfirm();
        setArmed(!armed);
      }}
    >
      {armed ? "Sicher? Nochmal tippen" : label}
    </Button>
  );
}

function MyRole({ view }: { view: View }) {
  const { me } = view;
  if (!me.role) return null;
  const info = ROLES[me.role];
  const pack = view.players.filter((p) => p.pack && p.id !== me.id);
  const enchanted = view.players.filter((p) => p.enchanted);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-accent bg-card p-5 text-center">
        <p className="text-7xl">{info.emoji}</p>
        <p className="font-display text-4xl font-extrabold text-accent">{info.name}</p>
        <p className="mt-2 text-lg leading-snug">{roleText(me.role, view.short)}</p>
        <p className="mt-2 font-extrabold text-accent">{info.goal}</p>
        {me.team === "wolf" && info.team !== "wolf" && (
          <p className="mt-2 font-extrabold text-danger">Du gehörst jetzt zum Rudel und gewinnst mit den Wölfen.</p>
        )}
        {view.powersLost && info.village && (
          <p className="mt-2 font-bold text-ink-soft">Seit dem Tod des Ältesten hast du keine Fähigkeit mehr.</p>
        )}
      </div>
      <ul className="space-y-2 font-bold">
        {me.pack && (
          <li>🐺 {pack.length > 0 ? `Dein Rudel: ${pack.map((p) => p.name).join(", ")}` : "Du bist der einzige Wolf."}</li>
        )}
        {me.loverId && (
          <li>
            💘 Du bist verliebt in {nameOf(view, me.loverId)}. Scheidet einer von euch aus, geht der andere mit.
          </li>
        )}
        {me.role === "amor" && view.lovers && (
          <li>
            💘 Deine Verliebten: {nameOf(view, view.lovers[0])} und {nameOf(view, view.lovers[1])}
          </li>
        )}
        {enchanted.length > 0 && <li>🎶 Verzaubert: {enchanted.map((p) => p.name).join(", ")}</li>}
        {me.exposed && <li>🤪 Du bist als Dorfdepp erkannt und darfst nicht mehr abstimmen.</li>}
        {view.captain === me.id && <li>🎖️ Du bist Hauptmann – deine Stimme zählt doppelt.</li>}
        {view.neighbours && view.neighbours.length > 0 && (
          <li>🪑 Deine Nachbarn: {names(view, view.neighbours)}</li>
        )}
        {view.actorPowers && (
          <li>
            🤹 Noch übrig:{" "}
            {view.actorPowers.length > 0 ? view.actorPowers.map((r) => ROLES[r].name).join(", ") : "keine Fähigkeit"}
          </li>
        )}
        {view.potions && (
          <li>
            🧪 Heiltrank: {view.potions.heal ? "noch da" : "verbraucht"} · ☠️ Gifttrank:{" "}
            {view.potions.poison ? "noch da" : "verbraucht"}
          </li>
        )}
        {view.notes.map((note, i) => (
          <li key={i}>
            <NoteText view={view} note={note} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The host decides whether somebody on a new device gets their seat back. */
function Rejoins({ view, api }: { view: View; api: RoomApi }) {
  if (view.rejoins.length === 0) return null;
  return (
    <div className="mt-3 space-y-2" role="alert">
      {view.rejoins.map((r) => (
        <Card key={r.id} className="space-y-2 border-accent">
          <p className="text-center font-bold">
            {r.name} möchte auf einem anderen Gerät weiterspielen. Ist das wirklich {r.name}?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-12 text-base" onClick={() => api.send({ type: "rejoin", request: r.id, accept: true })}>
              Ja, einlassen
            </Button>
            <Button
              variant="quiet"
              className="min-h-12 text-base"
              onClick={() => api.send({ type: "rejoin", request: r.id, accept: false })}
            >
              Nein
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

type Panel = "menu" | "rules" | "role" | null;

export function Game({ view, clockOffset, api }: { view: View; clockOffset: number; api: RoomApi }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const audio = useSoundSettings();
  const playing = view.phase !== "lobby";
  const sky = skyFor(view);
  const { error, clearError } = api;

  useGameSound(view, sky);
  useWakeLock(playing);
  useBuzz(view);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  const act = async (action: Parameters<RoomApi["send"]>[0]) => {
    setPanel(null);
    await api.send(action);
  };

  const leave = async () => {
    setPanel(null);
    if (await api.send({ type: "leave" })) {
      api.leave();
      router.push("/");
    }
  };

  const phaseProps = { view, api };
  return (
    <div className="sky" data-sky={sky}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <nav className="flex items-center justify-between gap-2">
          {playing && view.me.role ? (
            <button
              type="button"
              onClick={() => setPanel("role")}
              className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-extrabold"
            >
              🎭 Meine Rolle
            </button>
          ) : (
            <span className="min-h-11 content-center px-1 text-sm font-extrabold text-ink-soft">
              Raum {view.code}
            </span>
          )}
          <span className="text-sm font-extrabold tracking-wide text-ink-soft uppercase">
            {PHASE_LABEL[view.phase](view)}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={audio.toggle}
              aria-pressed={audio.on}
              aria-label={audio.on ? "Ton ausschalten" : "Ton einschalten"}
              className="grid size-11 place-items-center rounded-full border border-line bg-card text-xl"
            >
              {audio.on ? "🔊" : "🔇"}
            </button>
            <button
              type="button"
              onClick={() => setPanel("menu")}
              aria-label="Menü"
              className="grid size-11 place-items-center rounded-full border border-line bg-card text-xl"
            >
              ☰
            </button>
          </span>
        </nav>

        {view.me.host && <Rejoins view={view} api={api} />}

        {/* The key resets picked players whenever the game moves on. */}
        <main
          key={`${view.phase}:${view.round}:${view.step}:${view.vote?.kind}:${view.vote?.round}:${view.pending?.who}`}
          className="flex flex-1 flex-col gap-5 pt-5"
        >
          {view.phase === "lobby" && <Lobby {...phaseProps} />}
          {view.phase === "roles" && <RolesPhase {...phaseProps} />}
          {view.phase === "night" && <NightPhase {...phaseProps} />}
          {view.phase === "announce" && <AnnouncePhase {...phaseProps} />}
          {(view.phase === "hunter" || view.phase === "succession" || view.phase === "scapegoat") && (
            <PendingPhase {...phaseProps} />
          )}
          {view.phase === "discussion" && <DiscussionPhase {...phaseProps} clockOffset={clockOffset} />}
          {(view.phase === "vote" || view.phase === "election") && <VotePhase {...phaseProps} />}
          {view.phase === "ended" && <EndedPhase {...phaseProps} />}
        </main>
      </div>

      {error && (
        <button
          type="button"
          onClick={clearError}
          role="alert"
          className="rise fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl bg-[#3a0f14] px-4 py-3 text-center font-bold text-[#ffd9d6] shadow-xl"
        >
          {error}
        </button>
      )}

      {panel === "role" && (
        <Sheet title="Meine Rolle" onClose={() => setPanel(null)}>
          <MyRole view={view} />
        </Sheet>
      )}

      {panel === "rules" && (
        <Sheet title="So wird gespielt" onClose={() => setPanel(null)}>
          <Rules />
        </Sheet>
      )}

      {panel === "menu" && (
        <Sheet title={`Raum ${view.code}`} onClose={() => setPanel(null)}>
          <div className="space-y-2.5">
            {view.inPlay.length > 0 && (
              <div className="pb-2">
                <p className="mb-2 text-center text-sm font-bold text-ink-soft">Rollen in dieser Runde</p>
                <RoleChips roles={view.inPlay} />
              </div>
            )}
            <Button variant="quiet" onClick={() => setPanel("rules")}>
              📖 Spielregeln
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="quiet" aria-pressed={audio.on} onClick={audio.toggle}>
                {audio.on ? "🔊 Ton: an" : "🔇 Ton: aus"}
              </Button>
              <Button
                variant="quiet"
                aria-pressed={audio.music}
                disabled={!audio.on}
                onClick={audio.toggleMusic}
              >
                {audio.music ? "🎵 Musik: an" : "🎵 Musik: aus"}
              </Button>
            </div>
            <p className="px-1 text-sm text-ink-soft">
              Der Ton bringt Erzähler und Musik. Sitzt ihr zusammen, schaltet ihn am besten nur auf
              einem Handy ein.
            </p>
            {view.me.host && playing && view.phase !== "ended" && (
              <>
                <ConfirmButton label="⏭ Phase überspringen" onConfirm={() => act({ type: "force" })} />
                <ConfirmButton label="🛑 Runde abbrechen" onConfirm={() => act({ type: "abort" })} />
                <p className="px-1 text-sm text-ink-soft">
                  Überspringen hilft, wenn jemand nicht mehr mitmacht und das Spiel hängt.
                </p>
              </>
            )}
            {!playing && <ConfirmButton label="🚪 Raum verlassen" onConfirm={leave} />}
          </div>
        </Sheet>
      )}
    </div>
  );
}
