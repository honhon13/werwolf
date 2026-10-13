"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ROLE_ORDER, ROLES } from "@/lib/game/roles";
import type { PublicPlayer, RoleId } from "@/lib/game/types";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "min-h-14 w-full rounded-2xl px-5 text-lg font-extrabold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
        variant === "primary" && "bg-accent text-accent-ink shadow-lg shadow-black/20",
        variant === "quiet" && "border border-line bg-card text-ink",
        variant === "danger" && "border border-danger/60 bg-danger/15 text-danger",
        className,
      )}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-3xl border border-line bg-card p-4 backdrop-blur-sm", className)}>
      {children}
    </section>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="rise text-center">
      <h1 className="font-display text-4xl leading-tight font-extrabold text-balance">{children}</h1>
      {sub && <p className="mt-2 text-lg text-balance text-ink-soft">{sub}</p>}
    </header>
  );
}

function hue(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

export function Avatar({ player, size = "md" }: { player: { id: string; name: string }; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-extrabold text-white",
        size === "md" ? "size-10 text-lg" : "size-7 text-sm",
      )}
      style={{ background: `hsl(${hue(player.id)} 55% 42%)` }}
    >
      {[...player.name][0]?.toUpperCase()}
    </span>
  );
}

export function RoleTag({ role }: { role: RoleId }) {
  return (
    <span className="whitespace-nowrap">
      {ROLES[role].emoji} {ROLES[role].name}
    </span>
  );
}

/** The roles of a round as counted chips, e.g. "🐺 Werwolf ×2". */
export function RoleChips({ roles }: { roles: RoleId[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {ROLE_ORDER.filter((r) => roles.includes(r)).map((r) => {
        const count = roles.filter((x) => x === r).length;
        return (
          <li key={r} className="rounded-full border border-line bg-card px-3 py-1 text-sm font-bold">
            <RoleTag role={r} />
            {count > 1 && <span className="text-ink-soft"> ×{count}</span>}
          </li>
        );
      })}
    </ul>
  );
}

interface PlayerGridProps {
  players: PublicPlayer[];
  selected?: string[];
  onPick?: (id: string) => void;
  /** Extra marker in the corner of a player, e.g. who the pack points at. */
  badge?: (player: PublicPlayer) => ReactNode;
  disabled?: (player: PublicPlayer) => boolean;
  meId?: string;
  /**
   * Also show the roles of living players that this viewer knows. Off by
   * default so that a glance at the screen never gives away a secret role.
   */
  revealAll?: boolean;
  /** Mark players whose phone has stopped answering. */
  showOffline?: boolean;
}

export function PlayerGrid({
  players,
  selected = [],
  onPick,
  badge,
  disabled,
  meId,
  revealAll = false,
  showOffline = false,
}: PlayerGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {players.map((p) => {
        const isSelected = selected.includes(p.id);
        const off = !onPick || disabled?.(p);
        const role = revealAll || !p.alive ? p.role : null;
        const notes = [p.id === meId && "du", showOffline && !p.online && "offline"].filter(Boolean);
        const body = (
          <>
            <Avatar player={p} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-extrabold">{p.name}</span>
              {(role || notes.length > 0) && (
                <span className="block truncate text-sm text-ink-soft">
                  {role && <RoleTag role={role} />}
                  {role && notes.length > 0 && " · "}
                  {notes.join(" · ")}
                </span>
              )}
            </span>
            {badge?.(p)}
          </>
        );
        const shell = cx(
          "flex min-h-16 w-full items-center gap-2.5 rounded-2xl border px-3 py-2 transition",
          isSelected ? "border-accent bg-accent/20 ring-2 ring-accent" : "border-line bg-card",
          !p.alive && "opacity-45",
        );
        return (
          <li key={p.id}>
            {onPick ? (
              <button
                type="button"
                disabled={off}
                aria-pressed={isSelected}
                onClick={() => onPick(p.id)}
                className={cx(shell, "active:scale-[0.97] disabled:opacity-35")}
              >
                {body}
              </button>
            ) : (
              <div className={shell}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  if (total === 0) return null;
  return (
    <div className="text-center text-sm font-bold text-ink-soft" role="status">
      <div className="mx-auto mb-1.5 h-2 max-w-48 overflow-hidden rounded-full bg-card-strong">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      {label ?? `${done} von ${total} fertig`}
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-sky="night">
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="sheet-up relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-[#141a45] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full border border-line bg-card text-xl"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Shown to everyone who has finished their part of a phase. */
export function Waiting({ children, progress }: { children: ReactNode; progress?: { done: number; total: number } }) {
  return (
    <div className="rise space-y-4 py-4 text-center">
      <p className="text-lg text-balance text-ink-soft">{children}</p>
      {progress && <Progress {...progress} />}
    </div>
  );
}

export { cx };
