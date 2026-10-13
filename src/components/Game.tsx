"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGameSound, useSoundSettings } from "@/lib/client/sound/useSound";
import type { RoomApi } from "@/lib/client/useRoom";
import { ROLES, roleText } from "@/lib/game/roles";
import type { Phase, View } from "@/lib/game/types";
import { AnnouncePhase, DiscussionPhase, EndedPhase, VotePhase } from "./phases/Day";
import { Lobby } from "./phases/Lobby";
import { HunterPhase, NightPhase, RolesPhase, WitchPhase } from "./phases/Night";
import { nameOf } from "./phases/shared";
import { Rules } from "./Rules";
import { Button, RoleChips, RoleTag, Sheet } from "./ui";

const PHASE_LABEL: Record<Phase, (view: View) => string> = {
  lobby: () => "Lobby",
  roles: () => "Rollen",
  night: (v) => `Nacht ${v.round}`,
  witch: (v) => `Nacht ${v.round}`,
  announce: (v) => (v.announce?.kind === "morning" ? `Morgen ${v.round}` : `Tag ${v.round}`),
  hunter: (v) => `Tag ${v.round}`,
  discussion: (v) => `Tag ${v.round}`,
  vote: (v) => `Tag ${v.round}`,
  ended: () => "Spielende",
};

function skyFor(view: View): "night" | "day" {
  switch (view.phase) {
    case "announce":
    case "hunter":
    case "discussion":
    case "vote":
      return "day";
    case "ended":
      return view.ended?.winner === "dorf" || view.ended?.winner === "paar" ? "day" : "night";
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
  const moment = `${view.phase}:${view.round}:${view.announce?.kind}:${view.vote?.round}`;
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
  const pack = view.players.filter((p) => p.role === "werwolf" && p.id !== me.id);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-accent bg-card p-5 text-center">
        <p className="text-7xl">{info.emoji}</p>
        <p className="font-display text-4xl font-extrabold text-accent">{info.name}</p>
        <p className="mt-2 text-lg leading-snug">{roleText(me.role, view.short)}</p>
        <p className="mt-2 font-extrabold text-accent">{info.goal}</p>
      </div>
      {me.role === "werwolf" && (
        <p className="font-bold">
          🐺 {pack.length > 0 ? `Dein Rudel: ${pack.map((p) => p.name).join(", ")}` : "Du bist der einzige Werwolf."}
        </p>
      )}
      {me.loverId && (
        <p className="font-bold">
          💘 Du bist verliebt in {nameOf(view, me.loverId)}. Scheidet einer von euch aus, geht der
          andere mit.
        </p>
      )}
      {me.role === "amor" && view.lovers && (
        <p className="font-bold">
          💘 Deine Verliebten: {nameOf(view, view.lovers[0])} und {nameOf(view, view.lovers[1])}
        </p>
      )}
      {view.potions && (
        <p className="font-bold">
          🧪 Heiltrank: {view.potions.heal ? "noch da" : "verbraucht"} · ☠️ Gifttrank:{" "}
          {view.potions.poison ? "noch da" : "verbraucht"}
        </p>
      )}
      {view.seerLog && view.seerLog.length > 0 && (
        <ul className="space-y-1 font-bold">
          {view.seerLog.map((e) => (
            <li key={e.round}>
              🔮 Nacht {e.round}: {nameOf(view, e.target)} ist <RoleTag role={e.role} />
            </li>
          ))}
        </ul>
      )}
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

        {/* The key resets picked players whenever the game moves on. */}
        <main key={`${view.phase}:${view.round}:${view.vote?.round}`} className="flex flex-1 flex-col gap-5 pt-5">
          {view.phase === "lobby" && <Lobby {...phaseProps} />}
          {view.phase === "roles" && <RolesPhase {...phaseProps} />}
          {view.phase === "night" && <NightPhase {...phaseProps} />}
          {view.phase === "witch" && <WitchPhase {...phaseProps} />}
          {view.phase === "announce" && <AnnouncePhase {...phaseProps} />}
          {view.phase === "hunter" && <HunterPhase {...phaseProps} />}
          {view.phase === "discussion" && <DiscussionPhase {...phaseProps} clockOffset={clockOffset} />}
          {view.phase === "vote" && <VotePhase {...phaseProps} />}
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
