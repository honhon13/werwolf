"use client";

import { useCallback, useEffect, useState } from "react";
import { CAUSE_TEXT } from "@/lib/client/narrator";
import { ROLES } from "@/lib/game/roles";
import type { Announce, View, Winner } from "@/lib/game/types";
import { Avatar, Button, Card, PlayerGrid, Title, Waiting } from "../ui";
import { Ballots, History, nameOf, NoteText, type PhaseProps } from "./shared";

const ANNOUNCE_TITLE: Record<Announce["kind"], string> = {
  morning: "Der Morgen graut",
  verdict: "Das Dorf hat entschieden",
  hunter: "Der Jäger hat geschossen",
  election: "Der Hauptmann ist gewählt",
  succession: "Ein neuer Hauptmann",
  scapegoat: "Der Sündenbock hat entschieden",
};

function quietLine(view: View, a: Announce): string | undefined {
  if (a.deaths.length > 0 || a.exposed) return undefined;
  switch (a.kind) {
    case "morning":
      return view.short ? "Alle haben die Nacht überlebt – doch einer von euch ist ein Werwolf!" : "Alle haben die Nacht überlebt!";
    case "verdict":
      return `${a.tie ? "Wieder Gleichstand" : "Niemand wurde gewählt"} – ${
        view.short ? "der Werwolf bleibt unentdeckt." : "heute muss niemand gehen."
      }`;
    case "election":
    case "succession":
      return `${nameOf(view, a.captain)} ist jetzt Hauptmann. Seine Stimme zählt doppelt.`;
    case "scapegoat":
      return a.voters && a.voters.length > 0
        ? `Morgen dürfen nur ${a.voters.map((id) => nameOf(view, id)).join(", ")} abstimmen.`
        : "Morgen darf niemand abstimmen.";
    default:
      return undefined;
  }
}

export function AnnouncePhase({ view, api }: PhaseProps) {
  const a = view.announce;
  if (!a) return null;
  const nobodyLeft = view.players.every((p) => !p.alive);
  const mayConfirm = (view.me.alive || nobodyLeft) && !view.me.done;
  const morning = a.kind === "morning";
  const fresh = morning && view.round === 1;
  const mayShootSoon = view.me.role === "jaeger" && a.deaths.some((d) => d.id === view.me.id) && !view.powersLost;
  // Private news of tonight, only for this player.
  const mine = morning
    ? view.notes.filter((n) => n.round === view.round && (n.kind === "turned" || n.kind === "infected"))
    : [];
  const enchantedTonight = morning && view.me.enchanted;

  return (
    <>
      <Title sub={quietLine(view, a)}>{ANNOUNCE_TITLE[a.kind]}</Title>

      {a.deaths.length === 0 && !a.exposed && (morning || a.kind === "verdict") && (
        <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
          {morning ? "🌤️" : "🤷"}
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

      {a.exposed && (
        <Card className="rise text-center">
          <p className="text-4xl">🤪</p>
          <p className="text-xl font-extrabold">{nameOf(view, a.exposed)} ist der Dorfdepp!</p>
          <p className="text-ink-soft">Er darf im Dorf bleiben, aber nie mehr abstimmen.</p>
        </Card>
      )}
      {a.powersLost && (
        <Card className="rise border-danger text-center">
          <p className="text-4xl">👴</p>
          <p className="font-extrabold">Das Dorf hat den Ältesten getötet.</p>
          <p className="text-ink-soft">Alle Dorfbewohner verlieren ihre Fähigkeiten.</p>
        </Card>
      )}
      {a.growl !== undefined && a.growl !== null && (
        <Card className="rise text-center">
          <p className="text-4xl">🐻</p>
          <p className="font-extrabold">{a.growl ? "Der Bär brummt!" : "Der Bär bleibt ruhig."}</p>
          <p className="text-ink-soft">
            {a.growl ? "Neben dem Bärenführer sitzt ein Wolf." : "Neben dem Bärenführer sitzt kein Wolf."}
          </p>
        </Card>
      )}
      {a.marked && a.marked.length > 0 && (
        <Card className="rise text-center">
          <p className="text-4xl">🪶</p>
          <p className="font-extrabold">Der Rabe hat {a.marked.map((id) => nameOf(view, id)).join(" und ")} markiert.</p>
          <p className="text-ink-soft">Bei der Abstimmung heute zählt das wie zwei Stimmen mehr.</p>
        </Card>
      )}

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
      {mine.map((note, i) => (
        <Card key={i} className="rise border-accent text-center font-bold">
          <NoteText view={view} note={note} />
        </Card>
      ))}
      {enchantedTonight && (
        <Card className="rise border-accent text-center">
          <p className="font-extrabold">🎶 Du bist verzaubert.</p>
          <p className="text-ink-soft">
            Verzaubert sind: {view.players.filter((p) => p.enchanted).map((p) => p.name).join(", ")}
          </p>
        </Card>
      )}

      {view.short && morning && (
        <Card className="rise text-center">
          <p className="text-xl font-extrabold">Ihr habt genau eine Abstimmung</p>
          <p className="text-ink-soft">
            Verbannt ihr den Werwolf, gewinnt das Dorf. Trefft ihr jemand anderen oder könnt ihr
            euch nicht einigen, gewinnt der Werwolf.
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

const PENDING = {
  hunter: {
    emoji: "🏹",
    mine: { title: "Dein letzter Schuss", hint: "Du bist ausgeschieden – aber du hast noch einen Schuss. Wen nimmst du mit?", button: "🏹 Schießen" },
    theirs: (name: string) => ({ title: "Der letzte Schuss", hint: `${name} war der Jäger und darf noch ein letztes Mal schießen.`, wait: `${name} zielt …` }),
  },
  succession: {
    emoji: "🎖️",
    mine: { title: "Dein Nachfolger", hint: "Wer wird der neue Hauptmann? Seine Stimme zählt doppelt.", button: "Zum Hauptmann machen" },
    theirs: (name: string) => ({ title: "Ein neuer Hauptmann", hint: `${name} bestimmt, wer neuer Hauptmann wird.`, wait: `${name} überlegt …` }),
  },
  scapegoat: {
    emoji: "🐐",
    mine: { title: "Wer darf abstimmen?", hint: "Du bist der Sündenbock. Wähle, wer bei der nächsten Abstimmung mitstimmen darf.", button: "Diese dürfen abstimmen" },
    theirs: (name: string) => ({ title: "Der Sündenbock", hint: `${name} war der Sündenbock und bestimmt, wer morgen abstimmen darf.`, wait: `${name} überlegt …` }),
  },
};

/** A choice one player has to make for everybody: Jäger, Hauptmann, Sündenbock. */
export function PendingPhase({ view, api }: PhaseProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const pending = view.pending;
  if (!pending) return null;
  const text = PENDING[pending.kind];
  const who = nameOf(view, pending.who);
  const candidates = view.players.filter((p) => p.alive && p.id !== view.me.id);
  const many = pending.kind === "scapegoat";

  if (pending.who !== view.me.id) {
    const theirs = text.theirs(who);
    return (
      <>
        <Title sub={theirs.hint}>{theirs.title}</Title>
        <div className="grid flex-1 place-items-center text-8xl" aria-hidden>
          {text.emoji}
        </div>
        <Waiting>{theirs.wait}</Waiting>
      </>
    );
  }

  return (
    <>
      <Title sub={text.mine.hint}>{text.mine.title}</Title>
      <PlayerGrid
        players={candidates}
        selected={picked}
        onPick={(id) =>
          setPicked((current) =>
            many ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id],
          )
        }
      />
      <div className="mt-auto">
        <Button
          disabled={(!many && picked.length !== 1) || api.busy}
          onClick={() => api.send({ type: "choose", targets: picked })}
        >
          {many && picked.length === 0 ? "Niemand darf abstimmen" : text.mine.button}
        </Button>
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
      <Title
        sub={
          view.short
            ? "Wer von euch ist der Werwolf? Ihr habt nur eine Abstimmung!"
            : "Wer von euch ist ein Werwolf? Besprecht euch!"
        }
      >
        {view.round === 0 ? "Der erste Tag" : `Tag ${view.round}`}
      </Title>
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
            {view.me.alive ? "Die Abstimmung startet, sobald alle bereit sind." : "Du schaust zu – verrate nichts!"}
          </Waiting>
        )}
      </div>
    </>
  );
}

export function VotePhase({ view, api }: PhaseProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const vote = view.vote;
  if (!vote) return null;

  const election = vote.kind === "election";
  const runoff = vote.round === 2;
  const timed = view.deadline !== null;
  const alive = view.players.filter((p) => p.alive);
  const mine = vote.myBallot;
  const voted = mine !== undefined;
  const choices = alive.filter(
    (p) => (election || p.id !== view.me.id) && (!vote.candidates || vote.candidates.includes(p.id)),
  );
  const cast = async (target: string | null) => {
    if (await api.send({ type: "vote", target })) setPicked(null);
  };
  const tick = (p: { id: string; done: boolean }) => p.done && <span className="text-xl text-good">✓</span>;

  const sub = runoff
    ? `Gleichstand! Entscheidet euch zwischen ${(vote.candidates ?? []).map((id) => nameOf(view, id)).join(" und ")}.`
    : election
      ? "Wer soll euer Hauptmann sein? Seine Stimme zählt bei jeder Abstimmung doppelt."
      : view.short
        ? "Besprecht euch und stimmt ab. Das ist eure einzige Abstimmung."
        : "Besprecht euch und stimmt ab: Wer soll das Dorf verlassen?";
  const counted = timed
    ? "Bis die Zeit um ist, kannst du deine Stimme noch ändern. Dann wird ausgezählt."
    : "Ausgezählt wird, sobald alle abgestimmt haben. Bis dahin kannst du deine Stimme noch ändern.";

  return (
    <>
      <Title sub={sub}>{election ? "Hauptmannwahl" : runoff ? "Stichwahl" : "Wer ist ein Werwolf?"}</Title>

      {runoff && vote.previous && <Ballots view={view} ballots={vote.previous} />}
      {vote.marked.length > 0 && (
        <p className="text-center font-bold text-ink-soft">
          🪶 {vote.marked.map((id) => nameOf(view, id)).join(" und ")} hat schon zwei Stimmen gegen sich.
        </p>
      )}
      {!election && view.captain && (
        <p className="text-center text-sm font-bold text-ink-soft">
          🎖️ Die Stimme von {nameOf(view, view.captain)} zählt doppelt.
        </p>
      )}

      {!view.me.canVote ? (
        <>
          <PlayerGrid players={alive} badge={tick} />
          <Waiting progress={view.progress}>
            {!view.me.alive
              ? "Das Dorf stimmt ab. Du schaust zu."
              : view.me.exposed
                ? "Als Dorfdepp darfst du nicht mehr abstimmen."
                : "Der Sündenbock hat bestimmt, dass du heute nicht abstimmen darfst."}
          </Waiting>
        </>
      ) : election && voted ? (
        <>
          <Card className="rise text-center">
            <p className="text-ink-soft">Deine Stimme</p>
            <p className="text-2xl font-extrabold">{mine ? nameOf(view, mine) : "Enthaltung"}</p>
          </Card>
          <PlayerGrid players={alive} meId={view.me.id} badge={tick} />
          <div className="mt-auto">
            <Waiting progress={view.progress}>Das Ergebnis kommt, wenn alle abgestimmt haben.</Waiting>
          </div>
        </>
      ) : election ? (
        <>
          <PlayerGrid players={choices} meId={view.me.id} selected={picked ? [picked] : []} onPick={setPicked} />
          <div className="mt-auto space-y-2.5">
            <Button disabled={!picked || api.busy} onClick={() => cast(picked)}>
              Stimme abgeben
            </Button>
            <Button variant="quiet" disabled={api.busy} onClick={() => cast(null)}>
              Enthalten
            </Button>
          </div>
        </>
      ) : (
        <>
          <PlayerGrid
            players={choices}
            meId={view.me.id}
            selected={[picked ?? mine ?? ""].filter(Boolean)}
            onPick={setPicked}
            badge={tick}
          />
          <div className="mt-auto space-y-2.5">
            {voted && (picked === null || picked === mine) ? (
              <p className="rise text-center text-lg font-extrabold">✓ Deine Stimme: {nameOf(view, mine)}</p>
            ) : (
              <Button disabled={!picked || api.busy} onClick={() => cast(picked)}>
                {voted ? "Stimme ändern" : "Stimme abgeben"}
              </Button>
            )}
            <Waiting progress={view.progress}>{counted}</Waiting>
          </div>
        </>
      )}
    </>
  );
}

const ENDING: Record<Winner, { emoji: string; title: string; text: string }> = {
  dorf: { emoji: "🎉", title: "Das Dorf gewinnt!", text: "Alle Wölfe sind entlarvt." },
  wolf: { emoji: "🐺", title: "Das Rudel gewinnt!", text: "Das Dorf konnte die Wölfe nicht aufhalten." },
  paar: { emoji: "💘", title: "Das Liebespaar gewinnt!", text: "Nur die Verliebten sind noch übrig." },
  niemand: { emoji: "🌫️", title: "Niemand gewinnt", text: "Es hat keiner überlebt." },
  floetenspieler: { emoji: "🎶", title: "Der Flötenspieler gewinnt!", text: "Alle anderen sind verzaubert." },
  weisserWolf: { emoji: "🤍", title: "Der Weiße Werwolf gewinnt!", text: "Am Ende ist er allein übrig." },
  engel: { emoji: "👼", title: "Der Engel gewinnt!", text: "Er ist gleich zu Beginn gegangen – genau das wollte er." },
};

/** The same endings for a round that had a single wolf. */
const LONE_WOLF_ENDING: Partial<typeof ENDING> = {
  dorf: { emoji: "🎉", title: "Das Dorf gewinnt!", text: "Der Werwolf ist entlarvt." },
  wolf: { emoji: "🐺", title: "Der Werwolf gewinnt!", text: "Das Dorf konnte ihn nicht aufhalten." },
};

export function EndedPhase({ view, api }: PhaseProps) {
  const [history, setHistory] = useState(false);
  if (!view.ended) return null;
  const { winner, winners, noses, center } = view.ended;
  const loneWolf = view.players.filter((p) => p.pack).length === 1;
  const ending = (loneWolf && LONE_WOLF_ENDING[winner]) || ENDING[winner];
  const host = view.players.find((p) => p.host);
  const best = noses.filter((n) => n.hits > 0 && n.hits === noses[0].hits);
  const won = winners.includes(view.me.id);

  return (
    <>
      <div className="rise text-center text-8xl" aria-hidden>
        {ending.emoji}
      </div>
      <Title sub={ending.text}>{ending.title}</Title>
      {winner !== "niemand" && (
        <p className="text-center text-xl font-extrabold text-accent">
          {won ? "Du hast gewonnen! 🏆" : "Diesmal hat es nicht gereicht."}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="px-1 font-extrabold text-ink-soft">Wer war was?</h2>
        <PlayerGrid
          players={view.players}
          meId={view.me.id}
          revealAll
          secrets
          badge={(p) => winners.includes(p.id) && <span title="gewonnen">🏆</span>}
        />
        {center.length > 0 && (
          <p className="px-1 text-sm text-ink-soft">
            Übrig beim Dieb: {center.map((r) => `${ROLES[r].emoji} ${ROLES[r].name}`).join(", ")}
          </p>
        )}
      </section>

      {best.length > 0 && (
        <Card className="text-center">
          <p className="text-3xl">🕵️</p>
          <p className="font-extrabold">Beste Spürnase</p>
          <p className="text-ink-soft">
            {best.map((n) => nameOf(view, n.id)).join(" und ")} {best.length > 1 ? "haben" : "hat"} nachts{" "}
            {best[0].hits}× richtig auf einen Wolf getippt.
          </p>
        </Card>
      )}

      <Card>
        <button
          type="button"
          onClick={() => setHistory((h) => !h)}
          aria-expanded={history}
          className="flex min-h-11 w-full items-center justify-between font-extrabold"
        >
          📜 Spielverlauf
          <span aria-hidden>{history ? "▲" : "▼"}</span>
        </button>
        {history && (
          <div className="mt-3">
            <History entries={view.history} />
          </div>
        )}
      </Card>

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
