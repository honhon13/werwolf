"use client";

import { useCallback, useEffect, useState } from "react";
import { CAUSE_TEXT } from "@/lib/client/narrator";
import { ROLES } from "@/lib/game/roles";
import type { View, Winner } from "@/lib/game/types";
import { Avatar, Button, Card, PlayerGrid, Title, Waiting } from "../ui";
import { Ballots, nameOf, type PhaseProps } from "./shared";

const ANNOUNCE_TITLE = {
  morning: "Der Morgen graut",
  verdict: "Das Dorf hat entschieden",
  hunter: "Der Jäger hat geschossen",
};

export function AnnouncePhase({ view, api }: PhaseProps) {
  const a = view.announce;
  if (!a) return null;
  const nobodyLeft = view.players.every((p) => !p.alive);
  const mayConfirm = (view.me.alive || nobodyLeft) && !view.me.done;
  const fresh = a.kind === "morning" && view.round === 1;
  const mayShootSoon = view.me.role === "jaeger" && a.deaths.some((d) => d.id === view.me.id);

  return (
    <>
      <Title
        sub={
          a.deaths.length > 0
            ? undefined
            : a.kind === "morning"
              ? "Alle haben die Nacht überlebt!"
              : a.tie
                ? "Wieder Gleichstand – heute muss niemand gehen."
                : "Niemand wurde gewählt – heute muss niemand gehen."
        }
      >
        {ANNOUNCE_TITLE[a.kind]}
      </Title>

      {a.deaths.length === 0 && (
        <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
          {a.kind === "morning" ? "🌤️" : "🤷"}
        </div>
      )}

      <ul className="space-y-2.5">
        {a.deaths.map((d) => {
          const p = view.players.find((x) => x.id === d.id);
          if (!p) return null;
          return (
            <li key={d.id}>
              <Card className="rise flex items-center gap-3">
                <Avatar player={p} />
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-extrabold">
                    {p.name}
                    {p.id === view.me.id && <span className="text-ink-soft"> (du)</span>}
                  </p>
                  <p className="text-ink-soft">{CAUSE_TEXT[d.cause]}</p>
                </div>
                {p.role && (
                  <p className="text-right font-extrabold">
                    <span className="block text-3xl">{ROLES[p.role].emoji}</span>
                    {ROLES[p.role].name}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {fresh && view.me.loverId && view.me.alive && (
        <Card className="rise border-accent text-center">
          <p className="text-4xl">💘</p>
          <p className="text-xl font-extrabold">Amors Pfeil hat dich getroffen!</p>
          <p className="text-ink-soft">
            Du bist verliebt in <b className="text-ink">{nameOf(view, view.me.loverId)}</b>. Scheidet
            einer von euch aus, geht der andere mit. Pssst – das bleibt euer Geheimnis.
          </p>
        </Card>
      )}

      {a.ballots && Object.keys(a.ballots).length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 font-extrabold text-ink-soft">So wurde abgestimmt</h2>
          <Ballots view={view} ballots={a.ballots} />
        </section>
      )}

      <div className="mt-auto space-y-3">
        {mayConfirm ? (
          <Button disabled={api.busy} onClick={() => api.send({ type: "ack" })}>
            Weiter
          </Button>
        ) : (
          <Waiting progress={view.progress}>
            {view.me.alive
              ? "Warte auf die anderen …"
              : mayShootSoon
                ? "Du bist ausgeschieden – aber als Jäger darfst du gleich noch einmal schießen."
                : "Du bist ausgeschieden und schaust jetzt zu."}
          </Waiting>
        )}
      </div>
    </>
  );
}

function Countdown({ view, clockOffset, onDone }: { view: View; clockOffset: number; onDone: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const { deadline } = view;

  useEffect(() => {
    if (deadline === null) return;
    let fired = 0;
    const tick = () => {
      const ms = deadline - (Date.now() + clockOffset);
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      // Retried every few seconds in case the request got lost.
      if (ms <= 0 && Date.now() - fired > 3000) {
        fired = Date.now();
        onDone();
      }
    };
    const timer = setInterval(tick, 250);
    tick();
    return () => clearInterval(timer);
  }, [deadline, clockOffset, onDone]);

  if (deadline === null || left === null) return null;
  const low = left <= 20;
  return (
    <p
      className={`text-center font-display text-7xl font-extrabold tabular-nums ${low ? "text-danger" : ""}`}
      role="timer"
    >
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </p>
  );
}

export function DiscussionPhase({ view, api, clockOffset }: PhaseProps & { clockOffset: number }) {
  const { send } = api;
  const tick = useCallback(() => {
    void send({ type: "tick" });
  }, [send]);
  const alive = view.players.filter((p) => p.alive);
  const dead = view.players.filter((p) => !p.alive);

  return (
    <>
      <Title sub="Wer von euch ist ein Werwolf? Besprecht euch!">Tag {view.round}</Title>
      <Countdown view={view} clockOffset={clockOffset} onDone={tick} />
      <section className="space-y-2">
        <h2 className="px-1 font-extrabold text-ink-soft">Noch im Dorf ({alive.length})</h2>
        <PlayerGrid
          players={alive}
          meId={view.me.id}
          showOffline
          badge={(p) => p.done && <span className="text-xl text-good" title="bereit">✓</span>}
        />
      </section>
      {dead.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 font-extrabold text-ink-soft">Ausgeschieden</h2>
          <PlayerGrid players={dead} meId={view.me.id} />
        </section>
      )}
      <div className="mt-auto">
        {view.me.alive && !view.me.done ? (
          <Button disabled={api.busy} onClick={() => api.send({ type: "ack" })}>
            Bereit zur Abstimmung
          </Button>
        ) : (
          <Waiting progress={view.progress}>
            {view.me.alive
              ? "Die Abstimmung startet, sobald alle bereit sind."
              : "Du schaust zu – verrate nichts!"}
          </Waiting>
        )}
      </div>
    </>
  );
}

export function VotePhase({ view, api }: PhaseProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const vote = view.vote;
  if (!vote) return null;

  const runoff = vote.round === 2;
  const alive = view.players.filter((p) => p.alive);
  const voted = vote.myBallot !== undefined && !changing;
  const cast = async (target: string | null) => {
    if (await api.send({ type: "vote", target })) {
      setPicked(null);
      setChanging(false);
    }
  };

  return (
    <>
      <Title
        sub={
          runoff
            ? `Gleichstand! Entscheidet euch zwischen ${(vote.candidates ?? [])
                .map((id) => nameOf(view, id))
                .join(" und ")}.`
            : "Wer soll das Dorf verlassen? Alle stimmen gleichzeitig ab."
        }
      >
        {runoff ? "Stichwahl" : "Abstimmung"}
      </Title>

      {runoff && vote.previous && <Ballots view={view} ballots={vote.previous} />}

      {!view.me.alive ? (
        <>
          <PlayerGrid
            players={alive}
            badge={(p) => p.done && <span className="text-xl text-good">✓</span>}
          />
          <Waiting progress={view.progress}>Das Dorf stimmt ab. Du schaust zu.</Waiting>
        </>
      ) : voted ? (
        <>
          <Card className="rise text-center">
            <p className="text-ink-soft">Deine Stimme</p>
            <p className="text-2xl font-extrabold">
              {vote.myBallot ? nameOf(view, vote.myBallot) : "Enthaltung"}
            </p>
          </Card>
          <PlayerGrid
            players={alive}
            meId={view.me.id}
            badge={(p) => p.done && <span className="text-xl text-good">✓</span>}
          />
          <div className="mt-auto space-y-3">
            <Waiting progress={view.progress}>Das Ergebnis kommt, wenn alle abgestimmt haben.</Waiting>
            <Button variant="quiet" onClick={() => setChanging(true)}>
              Stimme ändern
            </Button>
          </div>
        </>
      ) : (
        <>
          <PlayerGrid
            players={alive.filter(
              (p) => p.id !== view.me.id && (!vote.candidates || vote.candidates.includes(p.id)),
            )}
            selected={picked ? [picked] : []}
            onPick={setPicked}
          />
          <div className="mt-auto space-y-2.5">
            <Button disabled={!picked || api.busy} onClick={() => cast(picked)}>
              Stimme abgeben
            </Button>
            <Button variant="quiet" disabled={api.busy} onClick={() => cast(null)}>
              Enthalten
            </Button>
          </div>
        </>
      )}
    </>
  );
}

const ENDING: Record<Winner, { emoji: string; title: string; text: string }> = {
  dorf: { emoji: "🎉", title: "Das Dorf gewinnt!", text: "Alle Werwölfe sind entlarvt." },
  wolf: { emoji: "🐺", title: "Die Werwölfe gewinnen!", text: "Das Dorf konnte sie nicht aufhalten." },
  paar: { emoji: "💘", title: "Das Liebespaar gewinnt!", text: "Nur die Verliebten sind noch übrig." },
  niemand: { emoji: "🌫️", title: "Niemand gewinnt", text: "Es hat keiner überlebt." },
};

function iWon(view: View, winner: Winner): boolean {
  const { me, lovers } = view;
  if (winner === "niemand" || !me.role) return false;
  if (winner === "paar") return lovers?.includes(me.id) ?? false;
  return ROLES[me.role].team === winner;
}

export function EndedPhase({ view, api }: PhaseProps) {
  if (!view.ended) return null;
  const { winner, noses } = view.ended;
  const ending = ENDING[winner];
  const host = view.players.find((p) => p.host);
  const best = noses.filter((n) => n.hits > 0 && n.hits === noses[0].hits);

  return (
    <>
      <div className="rise text-center text-8xl" aria-hidden>
        {ending.emoji}
      </div>
      <Title sub={ending.text}>{ending.title}</Title>
      <p className="text-center text-xl font-extrabold text-accent">
        {iWon(view, winner) ? "Du hast gewonnen! 🏆" : winner === "niemand" ? "" : "Diesmal hat es nicht gereicht."}
      </p>

      <section className="space-y-2">
        <h2 className="px-1 font-extrabold text-ink-soft">Wer war was?</h2>
        <PlayerGrid
          players={view.players}
          meId={view.me.id}
          revealAll
          badge={(p) => view.lovers?.includes(p.id) && <span title="verliebt">💘</span>}
        />
      </section>

      {best.length > 0 && (
        <Card className="text-center">
          <p className="text-3xl">🕵️</p>
          <p className="font-extrabold">Beste Spürnase</p>
          <p className="text-ink-soft">
            {best.map((n) => nameOf(view, n.id)).join(" und ")} {best.length > 1 ? "haben" : "hat"} nachts{" "}
            {best[0].hits}× richtig auf einen Werwolf getippt.
          </p>
        </Card>
      )}

      <div className="mt-auto">
        {view.me.host ? (
          <Button disabled={api.busy} onClick={() => api.send({ type: "again" })}>
            Neue Runde
          </Button>
        ) : (
          <Waiting>{host ? `${host.name} kann eine neue Runde starten.` : "Gleich geht es weiter."}</Waiting>
        )}
      </div>
    </>
  );
}
