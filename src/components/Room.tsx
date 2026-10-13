"use client";

import Link from "next/link";
import { useState } from "react";
import { useStored } from "@/lib/client/storage";
import { useRoom } from "@/lib/client/useRoom";
import { Game } from "./Game";
import { Button, Card, Title } from "./ui";

export function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="sky">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        {children ?? <p className="text-7xl motion-safe:animate-pulse">🌙</p>}
      </div>
    </div>
  );
}

function JoinForm({ code, api }: { code: string; api: ReturnType<typeof useRoom> }) {
  const remembered = useStored("name");
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? remembered ?? "";
  if (api.room.status !== "guest") return null;
  const { phase, players } = api.room;

  return (
    <Splash>
      <Title sub={players.length > 0 ? `Schon da: ${players.join(", ")}` : undefined}>Raum {code}</Title>
      {phase === "lobby" ? (
        <form
          className="w-full space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void api.join(name);
          }}
        >
          <input
            value={name}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Dein Name"
            aria-label="Dein Name"
            maxLength={14}
            autoComplete="off"
            className="min-h-14 w-full rounded-2xl border border-line bg-card px-4 text-center text-xl font-extrabold placeholder:text-ink-soft"
          />
          <Button type="submit" disabled={!name.trim() || api.busy}>
            Mitspielen
          </Button>
          {api.error && <p className="font-bold text-danger">{api.error}</p>}
        </form>
      ) : (
        <Card>
          <p className="text-lg font-bold">Hier läuft gerade eine Runde.</p>
          <p className="mt-1 text-ink-soft">
            Sobald sie vorbei ist, kannst du mitspielen. Diese Seite merkt das von selbst.
          </p>
        </Card>
      )}
      <Link href="/" className="font-bold text-ink-soft underline underline-offset-4">
        Zur Startseite
      </Link>
    </Splash>
  );
}

export function Room({ code }: { code: string }) {
  const api = useRoom(code);
  switch (api.room.status) {
    case "loading":
      return <Splash />;
    case "missing":
      return (
        <Splash>
          <p className="text-7xl">🌫️</p>
          <Title sub="Vielleicht ist der Code falsch – oder der Raum ist schon zu alt.">
            Raum nicht gefunden
          </Title>
          <Link
            href="/"
            className="grid min-h-14 w-full place-items-center rounded-2xl bg-accent text-lg font-extrabold text-accent-ink"
          >
            Zur Startseite
          </Link>
        </Splash>
      );
    case "guest":
      return <JoinForm code={code} api={api} />;
    case "member":
      return <Game view={api.room.view} clockOffset={api.room.clockOffset} api={api} />;
  }
}
