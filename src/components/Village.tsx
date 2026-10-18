"use client";

import { store, useStored } from "@/lib/client/storage";
import { ROLES } from "@/lib/game/roles";
import type { PublicPlayer, View } from "@/lib/game/types";
import { cx, hue } from "./ui";
import { ASPECT, look, seatPosition, seatSize } from "./village-layout";

const SKIN = ["#f1c7a3", "#e0ac84", "#b97b55", "#7a4d33"];
const HAIR = ["#3b2416", "#7a4a22", "#d8b36a", "#1e1b1a", "#9a3f1c"];

/** A villager in a cloak; hat, skin and hair follow from the player id. */
function Figure({ player, asleep }: { player: PublicPlayer; asleep: boolean }) {
  const h = hue(player.id);
  const cloak = `hsl(${h} 45% 38%)`;
  const shade = `hsl(${h} 45% 25%)`;
  const skin = SKIN[look(`${player.id}:skin`, SKIN.length)];
  const hair = HAIR[look(`${player.id}:hair`, HAIR.length)];
  const kind = look(player.id, 5);
  return (
    <svg viewBox="0 0 40 44" className="block size-full overflow-visible" aria-hidden>
      <ellipse cx="20" cy="42.5" rx="12" ry="2" fill="rgb(0 0 0 / 0.35)" />
      <path d="M7 43 Q7 25 20 23 Q33 25 33 43 Z" fill={cloak} />
      <path d="M20 24 L18 43 M20 24 L22 43" stroke={shade} strokeWidth="1" />
      <circle cx="20" cy="15" r="8" fill={skin} />
      {kind === 0 && <path d="M10.5 20 Q9 3 20 2.5 Q31 3 29.5 20 Q27 10 20 9.5 Q13 10 10.5 20 Z" fill={shade} />}
      {kind === 1 && (
        <>
          <rect x="14" y="0.5" width="12" height="7.5" rx="2" fill="#4a3322" />
          <ellipse cx="20" cy="8" rx="12.5" ry="2.4" fill="#5b3f2a" />
        </>
      )}
      {kind === 2 && <path d="M11.5 14 Q20 0.5 28.5 14 Q20 9 11.5 14 Z" fill="#b8402f" />}
      {kind === 3 && <path d="M11.5 17 Q10.5 5.5 20 5.5 Q29.5 5.5 28.5 17 Q27 10.5 20 10 Q13 10.5 11.5 17 Z" fill={hair} />}
      {kind === 4 && (
        <>
          <path d="M12.5 11 Q20 2 27.5 11 Z" fill={shade} />
          <path d="M26 10.5 L31.5 11.5" stroke={shade} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {asleep ? (
        <path
          d="M15.4 16 q1.5 1.3 3 0 M21.6 16 q1.5 1.3 3 0"
          stroke="#2a1a10"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="17" cy="15.5" r="1.1" fill="#2a1a10" />
          <circle cx="23" cy="15.5" r="1.1" fill="#2a1a10" />
        </>
      )}
    </svg>
  );
}

/** The empty stool left where somebody sat who is out of the game. */
function Stool() {
  return (
    <svg viewBox="0 0 40 44" className="block size-full" aria-hidden>
      <ellipse cx="20" cy="42.5" rx="10" ry="1.8" fill="rgb(0 0 0 / 0.3)" />
      <path d="M12.5 30 L9.5 42 M27.5 30 L30.5 42 M20 31 L20 43" stroke="#6b4a2e" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="20" cy="29" rx="11" ry="3.6" fill="#8a6440" />
      <ellipse cx="20" cy="28.2" rx="10" ry="2.6" fill="#a37a52" />
    </svg>
  );
}

function Fire({ night }: { night: boolean }) {
  const stones = Array.from({ length: 9 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 9;
    return <ellipse key={i} cx={30 + 21 * Math.cos(a)} cy={47 + 5.5 * Math.sin(a)} rx="3.4" ry="2.2" fill="#5d5a63" />;
  });
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 size-[26%] -translate-x-1/2 -translate-y-[58%]">
      <div className={cx("fire-glow absolute -inset-[70%] rounded-full", night ? "opacity-100" : "opacity-55")} />
      <svg viewBox="0 0 60 56" className="relative size-full overflow-visible" aria-hidden>
        <ellipse cx="30" cy="48" rx="23" ry="6" fill="rgb(0 0 0 / 0.35)" />
        {stones}
        <rect x="11" y="42" width="38" height="6" rx="3" fill="#5a3a22" transform="rotate(-16 30 45)" />
        <rect x="11" y="42" width="38" height="6" rx="3" fill="#6f482b" transform="rotate(16 30 45)" />
        <g className="flame">
          <path d="M30 4 C41 18 47 29 41 40 C37 48 23 48 19 40 C13 29 21 19 30 4 Z" fill="#e2522a" />
          <path className="flame-inner" d="M30 15 C37 25 41 32 37 39 C34 45 26 45 23 39 C19 32 24 25 30 15 Z" fill="#f59a2c" />
          <path className="flame-inner" d="M30 25 C34 31 35 35 33 39 C31.5 42 28.5 42 27 39 C25 35 26 31 30 25 Z" fill="#ffe08a" />
        </g>
      </svg>
    </div>
  );
}

/** Dark pines around the clearing, for the Düsterwald. */
function Trees({ night }: { night: boolean }) {
  const near = night ? "#0f2033" : "#3d6a3a";
  const far = night ? "#0a1626" : "#2f5530";
  const tree = (x: number, y: number, s: number, color: string, key: string) => (
    <path
      key={key}
      d={`M${x} ${y - 9 * s} L${x + 4 * s} ${y - 3 * s} L${x + 2.5 * s} ${y - 3 * s} L${x + 5 * s} ${y + 2 * s} L${x + 0.8 * s} ${y + 2 * s} L${x + 0.8 * s} ${y + 4 * s} L${x - 0.8 * s} ${y + 4 * s} L${x - 0.8 * s} ${y + 2 * s} L${x - 5 * s} ${y + 2 * s} L${x - 2.5 * s} ${y - 3 * s} L${x - 4 * s} ${y - 3 * s} Z`}
      fill={color}
    />
  );
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      {tree(6, 12, 1.1, far, "a")}
      {tree(14, 7, 0.8, near, "b")}
      {tree(92, 11, 1.2, far, "c")}
      {tree(85, 5, 0.75, near, "d")}
      {tree(5, 90, 1.2, near, "e")}
      {tree(13, 96, 0.8, far, "f")}
      {tree(94, 92, 1.1, near, "g")}
      {tree(86, 97, 0.7, far, "h")}
    </svg>
  );
}

/**
 * The village round: everybody on their seat around the fire. The seat is the
 * player's place in the room's list, so it is the same on every device, after
 * reloading and for the whole game. Whoever is out leaves an empty stool.
 * Secret marks (pack, lovers) are not shown here, others at the table could see them.
 */
export function Village({ view, night }: { view: View; night: boolean }) {
  const hidden = useStored("village") === "hidden";
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => store("village", null)}
        className="mx-auto mt-3 min-h-9 rounded-full border border-line bg-card px-4 text-sm font-extrabold text-ink-soft"
      >
        🔥 Dorfrunde zeigen
      </button>
    );
  }

  const n = view.players.length;
  // Figure and name are equally wide, so that no two seats ever overlap.
  const size = seatSize(n);
  const small = n > 10;
  const asleep = view.phase === "night";

  return (
    <section className="relative mt-2 pt-[3%] pb-[4%]" aria-label="Dorfrunde am Lagerfeuer">
      <div className="relative mx-auto aspect-square" style={{ width: "min(100%, 44vh)" }}>
        <div className={cx("clearing absolute inset-[3%] rounded-full", night ? "clearing-night" : "clearing-day")} />
        <Trees night={night} />
        <Fire night={night} />
        <ul className="absolute inset-0" aria-label="Sitzordnung">
          {view.players.map((p, i) => {
            const at = seatPosition(i, n);
            const me = p.id === view.me.id;
            const out = !p.alive;
            const what = out ? (p.left ? "hat das Spiel verlassen" : "ausgeschieden") : me ? "du" : "dabei";
            return (
              <li
                key={p.id}
                aria-label={`Platz ${i + 1}: ${p.name}, ${what}`}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-700"
                style={{ left: `${at.x}%`, top: `${at.y}%`, width: `${size}%` }}
              >
                <div className="relative w-full" style={{ aspectRatio: `1 / ${ASPECT}` }}>
                  {out ? (
                    <Stool />
                  ) : (
                    <div className={cx("size-full", me && "drop-shadow-[0_0_5px_var(--accent)]")}>
                      <Figure player={p} asleep={asleep} />
                    </div>
                  )}
                  {out && p.role && (
                    <span className="absolute bottom-[38%] left-1/2 -translate-x-1/2 text-[11px] leading-none opacity-80">
                      {ROLES[p.role].emoji}
                    </span>
                  )}
                  {out && p.left && <span className="absolute bottom-[38%] -right-[10%] text-[10px] leading-none">🚪</span>}
                  {!out && (p.captain || p.exposed) && (
                    <span className="absolute top-[40%] -right-[4%] text-[12px] leading-none">
                      {p.captain ? "🎖️" : "🤪"}
                    </span>
                  )}
                  {!out && p.done && (
                    <span className="absolute top-[44%] -left-[2%] grid size-3.5 place-items-center rounded-full bg-[#1f7a45] text-[9px] leading-none font-black text-white">✓</span>
                  )}
                </div>
                <span
                  className={cx(
                    "mt-px max-w-full truncate rounded-full px-1 leading-tight font-extrabold",
                    small ? "text-[9px]" : "text-[11px]",
                    out ? "text-ink-soft opacity-70" : me ? "bg-accent text-accent-ink" : "bg-black/30 text-white",
                  )}
                >
                  {p.name}
                </span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => store("village", "hidden")}
          aria-label="Dorfrunde ausblenden"
          className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border border-line bg-card text-xs text-ink-soft"
        >
          ▾
        </button>
      </div>
    </section>
  );
}
