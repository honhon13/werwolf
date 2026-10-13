"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { Action, RoleSetup } from "@/lib/game/types";
import { Button, Card, cx, PlayerGrid, RoleChips } from "../ui";
import type { PhaseProps } from "./shared";

const TIMES = [
  { seconds: 120, label: "2 Min" },
  { seconds: 180, label: "3 Min" },
  { seconds: 300, label: "5 Min" },
  { seconds: 0, label: "Ohne" },
];

const SPECIALS: { key: Exclude<keyof RoleSetup, "wolves">; label: string }[] = [
  { key: "seherin", label: "🔮 Seherin" },
  { key: "hexe", label: "🧪 Hexe" },
  { key: "jaeger", label: "🏹 Jäger" },
  { key: "amor", label: "💘 Amor" },
];

function Segmented<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl border border-line bg-card p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-11 flex-1 rounded-xl px-2 text-sm font-extrabold transition",
            o.value === value ? "bg-accent text-accent-ink" : "text-ink-soft",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Invite({ code }: { code: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!showQr) return;
    let stale = false;
    QRCode.toDataURL(`${window.location.origin}/r/${code}`, { margin: 2, width: 512 })
      .then((url) => !stale && setQr(url))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [showQr, code]);

  const share = async () => {
    const url = `${window.location.origin}/r/${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Werwolf", text: `Spiel mit bei Werwolf! Raum ${code}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Sharing was cancelled.
    }
  };

  return (
    <Card className="rise text-center">
      <p className="text-sm font-bold tracking-wide text-ink-soft uppercase">Euer Raum-Code</p>
      <p
        className="pl-[0.2em] text-6xl font-black tracking-[0.2em] text-accent"
        aria-label={`Raum-Code ${code.split("").join(" ")}`}
      >
        {code}
      </p>
      <p className="mt-1 text-ink-soft">Gebt den Code auf der Startseite ein oder scannt den QR-Code.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="quiet" className="min-h-12 text-base" onClick={share}>
          {copied ? "Link kopiert ✓" : "Link teilen"}
        </Button>
        <Button variant="quiet" className="min-h-12 text-base" onClick={() => setShowQr((s) => !s)}>
          {showQr ? "QR ausblenden" : "QR-Code"}
        </Button>
      </div>
      {showQr && qr && (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URL
        <img src={qr} alt={`QR-Code für Raum ${code}`} className="mx-auto mt-3 w-56 rounded-2xl" />
      )}
    </Card>
  );
}

export function Lobby({ view, api }: PhaseProps) {
  const { setup, me, players } = view;
  const host = players.find((p) => p.host);
  const change = (settings: Extract<Action, { type: "settings" }>["settings"]) =>
    api.send({ type: "settings", settings });
  const setCustom = (custom: Partial<RoleSetup>) => change({ custom });

  return (
    <>
      <Invite code={view.code} />

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-extrabold">
          Am Lagerfeuer <span className="text-ink-soft">({players.length})</span>
        </h2>
        <PlayerGrid
          players={players}
          meId={me.id}
          showOffline
          badge={(p) => (
            <span className="flex items-center gap-1.5">
              {p.host && <span title="Spielleitung">👑</span>}
              {me.host && p.id !== me.id && (
                <button
                  type="button"
                  aria-label={`${p.name} entfernen`}
                  onClick={() => api.send({ type: "kick", target: p.id })}
                  className="grid size-9 place-items-center rounded-full border border-line text-ink-soft"
                >
                  ✕
                </button>
              )}
            </span>
          )}
        />
      </section>

      <Card className="space-y-3">
        <h2 className="text-center text-lg font-extrabold">Rollen in dieser Runde</h2>
        {setup.roles ? (
          <RoleChips roles={setup.roles} />
        ) : (
          <p className="text-center font-bold text-ink-soft">{setup.error}</p>
        )}
        {view.short && (
          <p className="text-center text-ink-soft">
            <b className="text-ink">Kurzrunde zu dritt:</b> In der Nacht scheidet niemand aus. Die
            Seherin findet den Werwolf – und am Tag habt ihr genau eine Abstimmung, um ihn zu
            verbannen.
          </p>
        )}

        {me.host && (
          <div className="space-y-3 border-t border-line pt-3">
            {!view.short && (
              <Segmented
                value={setup.auto}
                options={[
                  { value: true, label: "Automatisch" },
                  { value: false, label: "Selbst wählen" },
                ]}
                onChange={(auto) => change({ auto })}
              />
            )}
            {!view.short && !setup.auto && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold">🐺 Werwölfe</span>
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Weniger Werwölfe"
                      disabled={setup.custom.wolves <= 1}
                      onClick={() => setCustom({ wolves: setup.custom.wolves - 1 })}
                      className="size-11 rounded-full border border-line bg-card text-2xl font-extrabold disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-2xl font-extrabold">{setup.custom.wolves}</span>
                    <button
                      type="button"
                      aria-label="Mehr Werwölfe"
                      disabled={setup.custom.wolves >= 6}
                      onClick={() => setCustom({ wolves: setup.custom.wolves + 1 })}
                      className="size-11 rounded-full border border-line bg-card text-2xl font-extrabold disabled:opacity-30"
                    >
                      +
                    </button>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={setup.custom[key]}
                      onClick={() => setCustom({ [key]: !setup.custom[key] })}
                      className={cx(
                        "min-h-12 rounded-2xl border px-3 font-extrabold transition",
                        setup.custom[key]
                          ? "border-accent bg-accent/20"
                          : "border-line bg-card text-ink-soft line-through",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {setup.roles === null && players.length >= setup.min && (
                  <p className="text-center font-bold text-danger">{setup.error}</p>
                )}
              </>
            )}
            <div>
              <p className="mb-1.5 text-sm font-bold text-ink-soft">Zeit zum Diskutieren</p>
              <Segmented
                value={setup.discussionSeconds}
                options={TIMES.map((t) => ({ value: t.seconds, label: t.label }))}
                onChange={(discussionSeconds) => change({ discussionSeconds })}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="mt-auto space-y-2 pt-2">
        {me.host ? (
          <Button disabled={!setup.roles || api.busy} onClick={() => api.send({ type: "start" })}>
            Spiel starten
          </Button>
        ) : (
          <p className="py-3 text-center text-lg font-bold text-ink-soft">
            {host ? `${host.name} startet gleich das Spiel …` : "Gleich geht es los …"}
          </p>
        )}
      </div>
    </>
  );
}
