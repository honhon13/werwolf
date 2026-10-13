"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStored } from "@/lib/client/storage";
import { createRoom, joinRoom } from "@/lib/client/useRoom";
import { Rules } from "./Rules";
import { Button, Card, Sheet } from "./ui";

const inputClass =
  "min-h-14 w-full rounded-2xl border border-line bg-card px-4 text-center text-xl font-extrabold placeholder:font-bold placeholder:text-ink-soft";

export function Home() {
  const router = useRouter();
  const remembered = useStored("name");
  const lastRoom = useStored("last");
  const [typed, setTyped] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const name = typed ?? remembered ?? "";
  const ready = name.trim().length > 0 && !busy;

  const run = async (work: () => Promise<{ code?: string; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await work();
    if (result.code) router.push(`/r/${result.code}`);
    else {
      setError(result.error ?? "Das hat nicht geklappt.");
      setBusy(false);
    }
  };

  const create = () => run(() => createRoom(name.trim()));
  const join = () =>
    run(async () => {
      const { error: problem } = await joinRoom(code, name.trim());
      return problem ? { error: problem } : { code };
    });

  return (
    <div className="sky">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="rise pt-4 text-center">
          <p className="text-7xl" aria-hidden>
            🌕
          </p>
          <h1 className="font-display text-7xl font-extrabold text-accent">Werwolf</h1>
          <p className="mt-1 text-lg text-balance text-ink-soft">
            Das Dorf schläft. Wer von euch ist ein Werwolf?
          </p>
        </header>

        {lastRoom && (
          <Link
            href={`/r/${lastRoom}`}
            className="rise grid min-h-12 place-items-center rounded-2xl border border-accent/60 bg-accent/15 font-extrabold"
          >
            Zurück in Raum {lastRoom} →
          </Link>
        )}

        <Card className="rise space-y-3">
          <label className="block text-center font-extrabold" htmlFor="name">
            Wie heißt du?
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Dein Name"
            maxLength={14}
            autoComplete="off"
            className={inputClass}
          />
        </Card>

        <Card className="rise space-y-3">
          <h2 className="text-center font-extrabold">Neue Runde aufmachen</h2>
          <Button disabled={!ready} onClick={create}>
            Neues Spiel
          </Button>
        </Card>

        <Card className="rise">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && code.length === 4) void join();
            }}
          >
            <label className="block text-center font-extrabold" htmlFor="code">
              Oder mit Raum-Code mitspielen
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              placeholder="CODE"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} pl-[0.3em] text-3xl font-black tracking-[0.3em] uppercase placeholder:font-black`}
            />
            <Button type="submit" variant="quiet" disabled={!ready || code.length !== 4}>
              Mitspielen
            </Button>
          </form>
        </Card>

        {error && (
          <p role="alert" className="text-center font-bold text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => setRules(true)}
          className="mt-auto min-h-11 font-bold text-ink-soft underline underline-offset-4"
        >
          📖 So wird gespielt
        </button>
      </main>

      {rules && (
        <Sheet title="So wird gespielt" onClose={() => setRules(false)}>
          <Rules />
        </Sheet>
      )}
    </div>
  );
}
