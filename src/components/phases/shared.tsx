"use client";

import { narration } from "@/lib/client/narrator";
import type { RoomApi } from "@/lib/client/useRoom";
import { ROLES } from "@/lib/game/roles";
import type { HistoryEntry, Note, View } from "@/lib/game/types";
import { Avatar, PlayerGrid, RoleTag, Title } from "../ui";

export interface PhaseProps {
  view: View;
  api: RoomApi;
}

export const nameOf = (view: View, id: string | null | undefined) =>
  view.players.find((p) => p.id === id)?.name ?? "jemand";

export const names = (view: View, ids: string[]) => {
  const list = ids.map((id) => nameOf(view, id));
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} und ${list.at(-1)}` : (list[0] ?? "niemand");
};

/** One piece of private knowledge, as a sentence. */
export function NoteText({ view, note }: { view: View; note: Note }) {
  const as = "actor" in note && note.actor ? " (als Schauspieler)" : "";
  switch (note.kind) {
    case "seen":
      return (
        <>
          🔮 Nacht {note.round}
          {as}: {nameOf(view, note.target)} ist <RoleTag role={note.role} />
        </>
      );
    case "sniffed":
      return (
        <>
          🦊 Nacht {note.round}
          {as}: Bei {names(view, note.targets)} ist {note.wolf ? "ein Wolf dabei" : "kein Wolf"}.
        </>
      );
    case "spied":
      return (
        <>
          👧 Nacht {note.round}:{" "}
          {note.wolf ? `Du hast ${nameOf(view, note.wolf)} bei den Wölfen erkannt.` : "Du hast niemanden erkannt."}
        </>
      );
    case "thief":
      return note.took ? (
        <>
          🦹 Du hast die Karte <RoleTag role={note.took} /> genommen.
        </>
      ) : (
        <>
          🦹 Du hast deine Karte behalten. Übrig waren {note.center.map((r) => ROLES[r].name).join(" und ")}.
        </>
      );
    case "model":
      return <>🧒 Dein Vorbild ist {nameOf(view, note.target)}.</>;
    case "dog":
      return <>🐕 Du jagst {note.wolf ? "mit den Wölfen" : "nicht, du hältst zum Dorf"}.</>;
    case "turned":
      return note.why === "infected" ? (
        <>🦠 Der Urwolf hat dich infiziert – du gehörst jetzt heimlich zum Rudel.</>
      ) : note.why === "model" ? (
        <>🧒 Dein Vorbild ist gestorben – du bist jetzt ein Werwolf.</>
      ) : (
        <>🐕 Du jagst jetzt mit den Wölfen.</>
      );
    case "infected":
      return <>🦠 {nameOf(view, note.target)} wurde infiziert und gehört jetzt zum Rudel.</>;
    case "protected":
      return (
        <>
          🛡️ Nacht {note.round}
          {as}: Du hast {nameOf(view, note.target)} beschützt.
        </>
      );
    case "marked":
      return (
        <>
          🪶 Nacht {note.round}
          {as}: Du hast {nameOf(view, note.target)} markiert.
        </>
      );
    case "enchanted":
      return (
        <>
          🎶 Nacht {note.round}: Du hast {names(view, note.targets)} verzaubert.
        </>
      );
  }
}

/** What a player sees who is out of the game: the story and every role. */
export function Spectator({ view }: { view: View }) {
  return (
    <>
      <Title sub={narration(view)}>Du schaust zu 👻</Title>
      <p className="text-center font-bold text-ink-soft">
        Du bist ausgeschieden. Schau ruhig zu – aber verrate nichts!
      </p>
      <PlayerGrid players={view.players} meId={view.me.id} revealAll secrets />
    </>
  );
}

/** Ballots grouped by the player they were cast for. */
export function Ballots({ view, ballots }: { view: View; ballots: Record<string, string | null> }) {
  const targets = [...new Set(Object.values(ballots).filter((t): t is string => t !== null))];
  const votersFor = (target: string | null) =>
    Object.entries(ballots)
      .filter(([, t]) => t === target)
      .map(([voter]) => view.players.find((p) => p.id === voter))
      .filter((p) => p !== undefined);
  const weight = (voter: { id: string }) => (voter.id === view.captain && view.phase !== "election" ? 2 : 1);
  const rows = targets
    .map((t) => {
      const voters = votersFor(t);
      return { target: view.players.find((p) => p.id === t), voters, count: voters.reduce((n, v) => n + weight(v), 0) };
    })
    .sort((a, b) => b.count - a.count);
  const abstained = votersFor(null);

  return (
    <ul className="space-y-2">
      {rows.map(
        ({ target, voters, count }) =>
          target && (
            <li key={target.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2">
              <span className="w-8 text-center text-2xl font-extrabold">{count}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{target.name}</span>
                <span className="block truncate text-sm text-ink-soft">
                  von {voters.map((v) => v.name + (weight(v) === 2 ? " (×2)" : "")).join(", ")}
                </span>
              </span>
              <Avatar player={target} />
            </li>
          ),
      )}
      {abstained.length > 0 && (
        <li className="px-3 text-sm text-ink-soft">Enthalten: {abstained.map((v) => v.name).join(", ")}</li>
      )}
    </ul>
  );
}

/** The course of the game, night by night and day by day. */
export function History({ entries }: { entries: HistoryEntry[] }) {
  const groups: { label: string; items: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const label = entry.round === 0 ? (entry.day ? "Beginn" : "Vorbereitung") : `${entry.day ? "Tag" : "Nacht"} ${entry.round}`;
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return (
    <ol className="space-y-3">
      {groups.map((g, i) => (
        <li key={i}>
          <p className="mb-1 text-sm font-extrabold tracking-wide text-ink-soft uppercase">{g.label}</p>
          <ul className="space-y-1">
            {g.items.map((item, j) => (
              <li key={j} className={item.secret ? "text-ink-soft" : ""}>
                {item.secret ? "🤫 " : ""}
                {item.text}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
