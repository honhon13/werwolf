"use client";

import { narration } from "@/lib/client/narrator";
import type { RoomApi } from "@/lib/client/useRoom";
import type { View } from "@/lib/game/types";
import { Avatar, PlayerGrid, Title } from "../ui";

export interface PhaseProps {
  view: View;
  api: RoomApi;
}

export const nameOf = (view: View, id: string | null | undefined) =>
  view.players.find((p) => p.id === id)?.name ?? "jemand";

/** What a player sees who is out of the game: the story and every role. */
export function Spectator({ view }: { view: View }) {
  return (
    <>
      <Title sub={narration(view)}>Du schaust zu 👻</Title>
      <p className="text-center font-bold text-ink-soft">
        Du bist ausgeschieden. Schau ruhig zu – aber verrate nichts!
      </p>
      <PlayerGrid players={view.players} meId={view.me.id} revealAll />
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
  const rows = targets
    .map((t) => ({ target: view.players.find((p) => p.id === t), voters: votersFor(t) }))
    .sort((a, b) => b.voters.length - a.voters.length);
  const abstained = votersFor(null);

  return (
    <ul className="space-y-2">
      {rows.map(
        ({ target, voters }) =>
          target && (
            <li key={target.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2">
              <span className="w-8 text-center text-2xl font-extrabold">{voters.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{target.name}</span>
                <span className="block truncate text-sm text-ink-soft">
                  von {voters.map((v) => v.name).join(", ")}
                </span>
              </span>
              <Avatar player={target} />
            </li>
          ),
      )}
      {abstained.length > 0 && (
        <li className="px-3 text-sm text-ink-soft">
          Enthalten: {abstained.map((v) => v.name).join(", ")}
        </li>
      )}
    </ul>
  );
}
