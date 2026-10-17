# Werwolf

Das Werwolf-Spiel fürs Handy: Jeder spielt auf seinem eigenen Gerät, die App
übernimmt die Spielleitung. Ein Kind macht einen Raum auf, die anderen treten
mit dem vierstelligen Code oder per QR-Code bei – ohne Konto.

## Rollen und Regeln

24 Rollen aus dem Grundspiel und den Erweiterungen Neumond und Charaktere,
dazu der Hauptmann. 3 bis 18 Spieler: Zu dritt gibt es eine Kurzrunde, zu
viert eine Viererrunde. Die App schlägt eine ausgewogene Besetzung vor, oder
die Spielleitung stellt die Rollen selbst zusammen – ohne zu erfahren, wer
welche Karte bekommt. Jeder kann Lobby und Spiel jederzeit verlassen; jedes
Gerät hat pro Raum höchstens einen Platz.

Welche Regeln genau gelten, auch dort, wo die gedruckten Regeln offen sind,
steht verbindlich in [REGELN.md](REGELN.md).

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

- `src/lib/game` – die Spielregeln als reine Funktionen: Rollen und Besetzung
  (`roles.ts`), Nacht (`night.ts`), Tag und Abstimmung (`day.ts`), Tod und
  seine Folgen (`death.ts`), Sieg (`win.ts`), Ablauf (`engine.ts`) und was
  jeder Spieler sehen darf (`view.ts`). Geheimes verlässt den Server nie.
- `src/lib/server` – Speicherung der Räume und Hilfen für die API.
- `src/app/api/rooms` – Raum anlegen, beitreten, Stand abfragen, Aktion senden,
  Platz auf einem neuen Gerät übernehmen.
- `src/components` – die Bildschirme der einzelnen Spielphasen.
- `src/lib/client/sound` – Erzähler-Aufnahmen, Ersatzstimme und Musik.

Die Handys fragen den Spielstand alle 1,5 Sekunden ab, solange die Seite
sichtbar ist.
