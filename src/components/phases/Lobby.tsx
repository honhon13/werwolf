"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CAPTAIN_TEXT, CATEGORY_NAMES, type Category, NOT_AVAILABLE, ROLE_ORDER, ROLES, SOURCE_NAMES } from "@/lib/game/roles";
import type { Action, RoleId, View } from "@/lib/game/types";
import { Button, Card, cx, PlayerGrid, RoleChips } from "../ui";
import type { PhaseProps } from "./shared";

const TIMES = [
  { seconds: 120, label: "2 Min" },
  { seconds: 180, label: "3 Min" },
  { seconds: 300, label: "5 Min" },
  { seconds: 0, label: "Ohne" },
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

type Change = Extract<Action, { type: "settings" }>["settings"];

function Switch({
  on,
  label,
  hint,
  onChange,
}: {
  on: boolean;
  label: string;
  hint: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold">{label}</span>
        <span className="block text-sm text-ink-soft">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          on ? "bg-accent" : "bg-card-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-1 size-5 rounded-full bg-white shadow transition-all",
            on ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

const SMALL_TEXT = {
  kurz: "Kurzrunde zu dritt: In der Nacht erwischen die Wölfe niemanden – und am Tag habt ihr genau eine Abstimmung, um den Werwolf zu verbannen.",
  vier: "Runde zu viert: Es gelten die normalen Regeln, nur ohne Hauptmann.",
};

/** Lets the host pick how often each role is in the game. */
function RoleEditor({ view, change }: { view: View; change: (c: Change) => void }) {
  const [info, setInfo] = useState<RoleId | null>(null);
  const [hidden, setHidden] = useState(true);
  const { setup } = view;
  const counts = setup.counts;
  const set = (role: RoleId, n: number) => change({ counts: { ...counts, [role]: Math.max(0, n) } });
  const diff = setup.needed - setup.chosen;
  const groups = (Object.keys(CATEGORY_NAMES) as Category[]).map((category) => ({
    category,
    roles: ROLE_ORDER.filter((r) => ROLES[r].category === category),
  }));

  return (
    <div className="space-y-4">
      <p className={cx("text-center font-extrabold", diff === 0 ? "text-good" : "text-accent")} role="status">
        {setup.chosen} von {setup.needed} Karten gewählt
        {diff > 0 ? ` – noch ${diff} ${diff === 1 ? "fehlt" : "fehlen"}` : diff < 0 ? ` – ${-diff} zu viel` : " ✓"}
      </p>
      {(counts.dieb ?? 0) > 0 && (
        <p className="text-center text-sm text-ink-soft">Mit dem Dieb liegen zwei Karten mehr im Spiel, als es Spieler gibt.</p>
      )}
      {groups.map(({ category, roles }) => (
        <div key={category} className="space-y-1.5">
          <h3 className="px-1 text-sm font-extrabold tracking-wide text-ink-soft uppercase">{CATEGORY_NAMES[category]}</h3>
          {roles.map((role) => {
            const r = ROLES[role];
            const n = counts[role] ?? 0;
            const unique = r.max === 1;
            return (
              <div key={role} className="rounded-2xl border border-line bg-card">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setInfo(info === role ? null : role)}
                    aria-expanded={info === role}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-2xl" aria-hidden>
                      {r.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{r.name}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {SOURCE_NAMES[r.source]}
                        {r.adapted ? " · Digitalregel" : ""} · ⓘ
                      </span>
                    </span>
                  </button>
                  {unique ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={n > 0}
                      aria-label={`${r.name} ${n > 0 ? "entfernen" : "hinzufügen"}`}
                      onClick={() => set(role, n > 0 ? 0 : 1)}
                      className={cx(
                        "min-h-11 min-w-20 rounded-xl border px-3 text-sm font-extrabold",
                        n > 0 ? "border-accent bg-accent text-accent-ink" : "border-line text-ink-soft",
                      )}
                    >
                      {n > 0 ? "Dabei" : "Nicht dabei"}
                    </button>
                  ) : (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Ein ${r.name} weniger`}
                        // One Werwolf is always in the game.
                        disabled={n <= (role === "werwolf" ? 1 : 0)}
                        onClick={() => set(role, n - 1)}
                        className="size-11 rounded-full border border-line text-2xl font-extrabold disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-xl font-extrabold">{n}</span>
                      <button
                        type="button"
                        aria-label={`Ein ${r.name} mehr`}
                        disabled={n >= view.setup.max}
                        onClick={() => set(role, n + 1)}
                        className="size-11 rounded-full border border-line text-2xl font-extrabold disabled:opacity-30"
                      >
                        +
                      </button>
                    </span>
                  )}
                </div>
                {info === role && <p className="px-3 pb-3 text-sm leading-snug">{r.text}</p>}
              </div>
            );
          })}
        </div>
      ))}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-expanded={!hidden}
          className="px-1 text-sm font-extrabold tracking-wide text-ink-soft uppercase"
        >
          Nicht auswählbar ({NOT_AVAILABLE.length}) {hidden ? "▼" : "▲"}
        </button>
        {!hidden &&
          NOT_AVAILABLE.map((r) => (
            <p key={r.name} className="rounded-2xl border border-dashed border-line px-3 py-2 text-sm text-ink-soft">
              <b className="text-ink">{r.name}:</b> {r.reason}
            </p>
          ))}
      </div>
    </div>
  );
}

export function Lobby({ view, api }: PhaseProps) {
  const { setup, me, players } = view;
  const host = players.find((p) => p.host);
  const change = (settings: Change) => api.send({ type: "settings", settings });
  const small = setup.mode !== "normal";
  const meReady = players.find((p) => p.id === me.id)?.ready ?? false;
  const notReady = players.filter((p) => !p.ready).length;
  const seats = setup.roles?.some((r) => r === "fuchs" || r === "baerenfuehrer" || r === "ritter");

  return (
    <>
      <Invite code={view.code} />

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-extrabold">
          Am Lagerfeuer{" "}
          <span className="text-ink-soft">
            ({players.length}, {players.length - notReady} bereit)
          </span>
        </h2>
        <PlayerGrid
          players={players}
          meId={me.id}
          showOffline
          showReady
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
        {seats && (
          <p className="px-1 text-sm text-ink-soft">
            Die Reihenfolge dieser Liste ist die Sitzreihenfolge – wichtig für Fuchs, Bärenführer und Ritter.
          </p>
        )}
        <Button variant={meReady ? "quiet" : "primary"} onClick={() => api.send({ type: "ready", ready: !meReady })}>
          {meReady ? "Doch nicht bereit" : "Ich bin bereit"}
        </Button>
      </section>

      <Card className="space-y-3">
        <h2 className="text-center text-lg font-extrabold">Rollen in dieser Runde</h2>
        {setup.roles ? (
          <RoleChips roles={setup.roles} />
        ) : (
          <p className="text-center font-bold text-danger">{setup.error}</p>
        )}
        {small && <p className="text-center text-ink-soft">{SMALL_TEXT[setup.mode as "kurz" | "vier"]}</p>}
        {!small && setup.roles && (
          <p className="text-center text-sm text-ink-soft">
            {setup.captain ? "🎖️ Mit Hauptmannwahl" : "Ohne Hauptmann"} ·{" "}
            {setup.decoy ? "Tarnmodus an" : "Tarnmodus aus"}
          </p>
        )}

        {me.host && (
          <div className="space-y-3 border-t border-line pt-3">
            <Segmented
              value={setup.auto}
              options={[
                { value: true, label: "Automatisch" },
                { value: false, label: "Selbst wählen" },
              ]}
              onChange={(auto) => change({ auto })}
            />
            {!setup.auto && <RoleEditor view={view} change={change} />}
            {!small && (
              <Switch on={setup.captain} label="🎖️ Hauptmann wählen" hint={CAPTAIN_TEXT} onChange={(captain) => change({ captain })} />
            )}
            <Switch
              on={setup.decoy}
              label="🌙 Tarnmodus"
              hint="Wer nachts keine Aufgabe hat, tippt trotzdem etwas – so verrät am Tisch niemand seine Rolle."
              onChange={(decoy) => change({ decoy })}
            />
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
          <>
            <Button disabled={!setup.roles || api.busy} onClick={() => api.send({ type: "start" })}>
              Spiel starten
            </Button>
            {setup.roles && notReady > 0 && (
              <p className="text-center text-sm text-ink-soft">
                {notReady === 1 ? "Einer ist" : `${notReady} sind`} noch nicht bereit – du kannst trotzdem starten.
              </p>
            )}
          </>
        ) : (
          <p className="py-3 text-center text-lg font-bold text-ink-soft">
            {host ? `${host.name} startet gleich das Spiel …` : "Gleich geht es los …"}
          </p>
        )}
      </div>
    </>
  );
}
