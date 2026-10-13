# Werwolf

Das Werwolf-Spiel fürs Handy: Jeder spielt auf seinem eigenen Gerät, die App
übernimmt die Spielleitung. Ein Kind macht einen Raum auf, die anderen treten
mit dem vierstelligen Code oder per QR-Code bei – ohne Konto.

## Rollen

Werwolf, Dorfbewohner, Seherin, Hexe, Jäger und Amor. Die Rollen werden passend
zur Spielerzahl verteilt (ab 4 Spielern) oder von der Spielleitung selbst gewählt.

## Entwickeln

```bash
pnpm install
pnpm dev
```

Ohne `DATABASE_URL` liegen die Räume nur im Arbeitsspeicher des Dev-Servers.
Nach `vercel env pull` steht die Variable in `.env.local`, dann nutzt auch der
lokale Server die Datenbank der Live-Seite.
Mit `DATABASE_URL` (Neon Postgres) wird die Tabelle `werwolf_rooms` beim ersten
Zugriff angelegt; Räume werden 24 Stunden nach der letzten Änderung gelöscht.

```bash
pnpm test   # Spielregeln, inklusive hunderter Zufallspartien
pnpm lint
```

## Ton

Mit dem Lautsprecher-Knopf schaltet jedes Handy Erzähler und Musik ein oder aus;
die Musik lässt sich im Menü getrennt abstellen.

- **Erzähler:** Aufnahmen liegen in `public/audio/sprache/`. Die Dateinamen und
  die Texte dazu stehen in [SPRECHTEXTE.md](SPRECHTEXTE.md). Leere Dateien sind
  Platzhalter; für sie liest die Stimme des Geräts den Text vor. Welche
  Aufnahmen es gibt, wird beim Start von `pnpm dev` und beim Build festgestellt,
  nach dem Ablegen neuer Dateien also den Dev-Server neu starten.
- **Musik:** wird im Browser erzeugt (`src/lib/client/sound/music.ts`), es gibt
  keine Musikdatei. Melodie, Akkorde und Lautstärken stehen oben in der Datei.

## Aufbau

- `src/lib/game` – die Spielregeln als reine Funktionen (`engine.ts`) und was
  jeder Spieler sehen darf (`view.ts`). Geheimes verlässt den Server nie.
- `src/lib/server` – Speicherung der Räume und Hilfen für die API.
- `src/app/api/rooms` – Raum anlegen, beitreten, Stand abfragen, Aktion senden.
- `src/components` – die Bildschirme der einzelnen Spielphasen.
- `src/lib/client/sound` – Erzähler-Aufnahmen, Ersatzstimme und Musik.

Die Handys fragen den Spielstand alle 1,5 Sekunden ab, solange die Seite
sichtbar ist.
