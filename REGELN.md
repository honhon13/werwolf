# Verbindliche Spielregeln

Diese Datei legt fest, nach welchen Regeln die App spielt. Grundlage sind
**Die Werwölfe von Düsterwald** (Grundspiel) und die Erweiterungen **Neumond**
und **Charaktere**. Wo die gedruckten Regeln nichts sagen, nicht eindeutig
sind oder sich am Handy nicht umsetzen lassen, steht hier, wie die App
entscheidet.

Die Regeln laufen ausschließlich auf dem Server (`src/lib/game`). Die Handys
schicken nur Wünsche („ich wähle Anna“), der Server prüft sie und rechnet das
Ergebnis aus. Jede Regel unten ist durch Tests abgedeckt (`pnpm test`).

**Herkunft der Regeln**

| Kennzeichen | Bedeutung |
| --- | --- |
| Grundspiel | wie in Die Werwölfe von Düsterwald |
| Neumond | wie in der Erweiterung Neumond |
| Charaktere | wie in der Erweiterung Charaktere |
| Digitalregel | Anpassung, weil am Handy gespielt wird |
| Hausregel | eigene Festlegung, wo die Originalregeln offen sind |

---

## 1. Spielerzahl und Spielvarianten

| Spieler | Variante | Rollen |
| --- | --- | --- |
| unter 3 | kein Start möglich | – |
| 3 | **Kurzrunde** (Hausregel) | Werwolf, Seherin, Dorfbewohner – fest |
| 4 | **Viererrunde** (Hausregel) | Werwolf, Seherin, Beschützer, Dorfbewohner – fest |
| 5–18 | volles Spiel | automatisch oder frei gewählt |
| über 18 | kein Beitritt möglich | – |

**Kurzrunde (3 Spieler):** In der einzigen Nacht greift der Werwolf
niemanden an; die Seherin sieht eine Rolle und weiß danach, wer der Werwolf
ist. Am Tag gibt es genau eine Abstimmung (bei Gleichstand eine Stichwahl).
Wird der Werwolf verbannt, gewinnt das Dorf, sonst der Werwolf. Im
Tarnmodus bekommt der Werwolf nachts nur eine Tarnaufgabe.

**Viererrunde (4 Spieler):** normale Regeln mit den vier festen Rollen.
Ohne Hauptmann.

Bei 3 und 4 Spielern lässt sich keine andere Rollenwahl einstellen; die
Lobby zeigt die feste Besetzung an.

## 2. Rollen verteilen

### Automatisch (Standard)

Die App wählt eine ausgewogene Besetzung:

| Spieler | Wölfe | Dorfbewohner | Sonderrollen |
| --- | --- | --- | --- |
| 5 | 1 | 1 | Seherin, Hexe, Jäger |
| 6 | 2 | 1 | Seherin, Hexe, Jäger |
| 7 | 2 | 1 | + Amor |
| 8 | 2 | 1 | + Beschützer |
| 9 | 2 | 1 | + Ältester |
| 10 | 2 | 2 | wie bei 9 |
| 11 | 2 | 2 | + Fuchs |
| 12 | 3 | 2 | wie bei 11 |
| 13 | 3 | 2 | + Rabe |
| 14 | 3 | 2 | + Bärenführer |
| 15 | 3 | 2 | + Dorfdepp |
| 16 | 3 | 2 | + Ritter mit der rostigen Klinge |
| 17 | 4 | 2 | wie bei 16 |
| 18 | 4 | 2 | + Wildes Kind |

### Manuell

Die Spielleitung stellt für jede Rolle eine Anzahl ein. Das Spiel startet
nur, wenn

- die Summe der Karten der Spielerzahl entspricht (mit Dieb **zwei mehr**),
- jede Sonderrolle höchstens einmal vorkommt (nur Werwolf und Dorfbewohner
  dürfen mehrfach gewählt werden),
- mindestens ein Werwolf, Urwolf oder Großer böser Wolf dabei ist,
- die jagenden Wölfe (Werwolf, Urwolf, Großer böser Wolf, Weißer Werwolf)
  zu Beginn **weniger als die Hälfte** der Spieler sind,
- mindestens eine Rolle zum Dorf gehört.

Sonst nennt die Lobby den Grund, und der Start-Knopf bleibt gesperrt.

### Austeilen

Die Karten werden auf dem Server gemischt und zufällig verteilt. Die
Spielleitung sieht nur die Besetzung, nicht wer welche Karte hat. Mit Dieb
bleiben zwei Karten in der Mitte; es wird so lange gemischt, bis mindestens
ein jagender Wolf (nicht der Weiße Werwolf) bei einem Spieler liegt
(Hausregel).

Die **Sitzreihenfolge** ist die Reihenfolge in der Lobby. Sie zählt für
Fuchs, Bärenführer und Ritter (Digitalregel).

## 3. Ablauf

1. **Rollen ansehen** – jeder bestätigt, dass er seine Rolle kennt.
2. Ist der **Engel** im Spiel, beginnt das Spiel mit einem Tag (Charaktere),
   sonst mit der ersten Nacht.
3. **Nacht** (siehe 4).
4. **Morgen** – wer ausgeschieden ist, wird mit Rolle genannt.
5. Ggf. Schuss des Jägers, Nachfolge des Hauptmanns.
6. Nur am ersten Tag und nur wenn eingeschaltet: **Hauptmannwahl**.
7. **Diskussion** mit Zeitlimit (Standard 3 Minuten, einstellbar 30 s bis
   15 min oder ohne Limit). Sie endet, wenn die Zeit um ist oder alle
   Lebenden „Fertig“ tippen (Digitalregel).
8. **Abstimmung** (siehe 5), dann das Urteil.
9. Sieg prüfen, sonst wieder Nacht.

Der Sieg wird nach jeder Nacht, jeder Abstimmung und jedem Schuss geprüft.

## 4. Die Nacht

### Reihenfolge

Schritte, in denen niemand etwas tun kann, werden übersprungen. Wer in
einem Schritt nichts zu tun hat, bekommt im **Tarnmodus** (Standard: an) eine
Tarnaufgabe, damit am Tisch niemand an den Handys erkennt, wer welche Rolle
hat (Digitalregel).

| Schritt | Wer handelt |
| --- | --- |
| 1. Dieb | Dieb (nur Nacht 1) |
| 2. Erwachen | Amor, Wildes Kind, Wolfshund (nur Nacht 1) |
| 3. Hauptnacht | Wölfe, Seherin, Beschützer, Fuchs, Rabe, Flötenspieler, Schauspieler, Kleines Mädchen – gleichzeitig |
| 4. Rudel | Urwolf, Großer böser Wolf, Weißer Werwolf |
| 5. Hexe | Hexe |

Die Schritte der Hauptnacht laufen gleichzeitig, weil sich ihre Ergebnisse
erst am Morgen auswirken (Digitalregel).

### Wölfe

Alle lebenden Wölfe (auch infizierte, das Wilde Kind nach seiner Wandlung
und der Wolfshund, wenn er sich für die Wölfe entschieden hat) wählen
gemeinsam ein Opfer. Jeder sieht die Wahl der anderen. Das Opfer steht fest,
sobald **alle dasselbe** gewählt haben (Grundspiel). Wölfe können keine
Wölfe angreifen.

### Auflösung am Morgen – feste Reihenfolge

1. **Infektion** des Urwolfs: Ist das Opfer geschützt, scheitert sie (der
   Urwolf hat sie trotzdem verbraucht). Sonst gehört das Opfer heimlich zum
   Rudel und behält seine Fähigkeit.
2. **Angriffe** (Rudelopfer, Opfer des Großen bösen Wolfs, Opfer des Weißen
   Werwolfs), jeweils in dieser Rangfolge:
   Schutz des Beschützers → Heiltrank → erster Angriff auf den Ältesten →
   Tod.
3. **Gifttrank** der Hexe.
4. **Wundstarrkrampf**: Der Wolf, den die rostige Klinge in der Nacht davor
   verletzt hat, stirbt.
5. **Verzauberung** des Flötenspielers wird wirksam.
6. **Rabe**: Die Markierung gilt für die nächste Abstimmung und wird
   verkündet.
7. **Bär**: Er brummt, wenn ein lebender Nachbar des Bärenführers oder er
   selbst zum Rudel gehört.

Jeder Tod löst sofort seine Folgen aus (siehe 6).

## 5. Der Tag

### Abstimmung (Verbannung)

- Abstimmen dürfen alle Lebenden, außer dem erkannten Dorfdepp und – am Tag
  nach dem Sündenbock – allen, die der Sündenbock nicht bestimmt hat.
- Man darf sich **enthalten** (Hausregel), aber nicht für sich selbst
  stimmen.
- Die Stimmen sind geheim, bis **alle** abgestimmt haben; dann werden alle
  Stimmen gleichzeitig gezeigt.
- Die Stimme des **Hauptmanns zählt doppelt** (Grundspiel).
- Ein vom **Raben** Markierter hat zwei Stimmen mehr gegen sich, nur in der
  ersten Runde dieser Abstimmung (Charaktere).
- Wer die meisten Stimmen hat, scheidet aus.
- **Gleichstand:**
  1. Lebt der **Sündenbock**, scheidet er aus (Neumond) und bestimmt, wer am
     nächsten Tag abstimmen darf.
  2. Sonst gibt es **eine Stichwahl** nur zwischen den Gleichplatzierten
     (Hausregel).
  3. Steht es wieder gleich, scheidet **niemand** aus (Hausregel).
- Hat niemand eine Stimme bekommen, scheidet niemand aus.
- Trifft das Urteil den **Dorfdepp**, bleibt er im Spiel, verliert aber
  sein Stimmrecht (Neumond). War er Hauptmann, gibt er das Amt ab.

### Hauptmannwahl

- Nur wenn die Spielleitung den Hauptmann eingeschaltet hat, ab 5 Spielern,
  einmal am ersten Tag (Grundspiel).
- Hier darf man auch für sich selbst stimmen, jede Stimme zählt einfach.
- Gleichstand: eine Stichwahl, danach entscheidet das **Los** (Hausregel).
  Gibt niemand eine Stimme ab, wird unter allen Lebenden gelost.
- Stirbt der Hauptmann, bestimmt er sofort einen lebenden Nachfolger
  (Grundspiel).

## 6. Wenn jemand ausscheidet

Seine Rolle wird allen gezeigt. Er schaut ab dann zu, sieht alle Rollen und
verrät nichts mehr. Folgen, in dieser Reihenfolge:

- Ein ausgeschiedener **Wolf** beendet die Zusatzjagd des Großen bösen
  Wolfs.
- **Engel**, der bei der ersten Abstimmung oder in der ersten Nacht
  ausscheidet: Er gewinnt sofort allein.
- **Ältester**, getötet durch Abstimmung, Jäger oder Gifttrank: Alle
  Dorfbewohner verlieren ihre Fähigkeiten (Neumond).
- **Jäger**: schießt sofort auf einen Lebenden – auch nachts getötet und
  auch, wenn damit schon ein Sieg der Wölfe oder eines Einzelgängers feststeht
  (Grundspiel). Ohne Fähigkeiten (Ältester) schießt er nicht.
- **Hauptmann**: bestimmt seinen Nachfolger.
- **Ritter**, von Wölfen getötet: Der nächste lebende Wolf nach ihm in der
  Sitzreihenfolge stirbt am Ende der folgenden Nacht.
- **Vorbild des Wilden Kindes**: Das Wilde Kind wird zum Werwolf.
- **Verliebte**: Der Partner stirbt sofort mit (Grundspiel).

## 7. Wer gewinnt

Geprüft in dieser Reihenfolge:

1. **Engel** – wie in 6 beschrieben.
2. **Niemand** – wenn kein Spieler mehr lebt.
3. **Flötenspieler** – er lebt und alle anderen Lebenden sind verzaubert.
4. **Liebespaar** – die beiden Verliebten sind aus verschiedenen Teams und
   die letzten beiden Lebenden. (Verliebte aus demselben Team gewinnen mit
   ihrem Team; Verliebte aus verschiedenen Teams gewinnen nur so.)
5. **Weißer Werwolf** – er ist allein übrig, oder es leben nur noch er und
   ein Nicht-Wolf.
6. **Rudel** – es leben mindestens so viele Wölfe wie alle anderen
   zusammen (der Weiße Werwolf zählt dabei zu den anderen).
7. **Dorf** – kein Wolf, kein Weißer Werwolf und kein Flötenspieler lebt
   mehr.

In der **Kurzrunde** gewinnt der Werwolf zusätzlich, wenn er die eine
Abstimmung übersteht.

## 8. Die Rollen im Einzelnen

| Rolle | Herkunft | Regel in der App |
| --- | --- | --- |
| Dorfbewohner | Grundspiel | keine Fähigkeit |
| Werwolf | Grundspiel | jagt jede Nacht mit dem Rudel |
| Seherin | Grundspiel | sieht jede Nacht die Rolle eines anderen Spielers |
| Amor | Grundspiel | Nacht 1: zwei Verliebte, auch sich selbst; die Verliebten erfahren voneinander |
| Dieb | Grundspiel | Nacht 1: tauscht gegen eine von zwei Karten oder behält (dann Dorfbewohner); zwei Wolfskarten → muss tauschen |
| Kleines Mädchen | Grundspiel, **Digitalregel** | darf jede Nacht lauschen: erfährt einen Wolf, wird aber mit Chance 1 zu 3 entdeckt und dann statt des Opfers angegriffen (Schutz und Heiltrank helfen) |
| Hexe | Grundspiel | ein Heiltrank (nur für Angegriffene, auch sich selbst) und ein Gifttrank, beide in derselben Nacht möglich; sich selbst vergiften geht nicht (Hausregel) |
| Jäger | Grundspiel | siehe 6 |
| Hauptmann | Grundspiel | wählbar, siehe 5 |
| Beschützer | Neumond | schützt jede Nacht einen Spieler (auch sich), nie zweimal hintereinander denselben; hilft gegen Wolfsangriffe und Infektion, nicht gegen Gift, Abstimmung oder Wundstarrkrampf |
| Ältester | Neumond | überlebt den ersten Wolfsangriff; siehe 6 |
| Sündenbock | Neumond | siehe 5 |
| Dorfdepp | Neumond | siehe 5; nur einmal, schützt nicht vor Wölfen |
| Flötenspieler | Neumond | verzaubert jede Nacht zwei noch nicht Verzauberte (am Ende ggf. nur einen); Verzauberte erfahren, wer alles verzaubert ist |
| Wolfshund | Charaktere | Nacht 1: Dorf oder Rudel; die Seherin sieht immer „Wolfshund“ |
| Weißer Werwolf | Charaktere | jagt mit dem Rudel; in jeder geraden Nacht (2, 4, …) darf er zusätzlich einen Wolf töten; gewinnt allein |
| Großer böser Wolf | Charaktere | solange kein Wolf ausgeschieden ist, wählt er jede Nacht allein ein zweites Opfer |
| Urwolf | Charaktere | einmal im Spiel: Rudelopfer infizieren statt töten |
| Wildes Kind | Charaktere | Nacht 1: Vorbild wählen; stirbt es, wird das Kind zum Werwolf |
| Fuchs | Charaktere | wählt jede Nacht einen Spieler und erfährt, ob er oder einer seiner lebenden Nachbarn zum Rudel gehört; kein Wolf → Fähigkeit weg |
| Bärenführer | Charaktere | siehe 4, Schritt 7 |
| Rabe | Charaktere | markiert jede Nacht einen Spieler (darf auslassen), siehe 5 |
| Ritter mit der rostigen Klinge | Charaktere | siehe 6 |
| Engel | Charaktere | siehe 3 und 6; danach normaler Dorfbewohner |
| Schauspieler | Charaktere, **Digitalregel** | bekommt drei Fähigkeiten aus Seherin, Beschützer, Fuchs und Rabe und benutzt jede Nacht höchstens eine, jede nur einmal; seine Schutz-Nacht zählt nicht für „nie zweimal denselben“, ein Fuchs-Fehlschlag kostet nichts |

Alle Dorfrollen mit Fähigkeit verlieren sie, wenn das Dorf den Ältesten
getötet hat. Wer infiziert wird, behält seine Fähigkeit, gewinnt aber mit dem
Rudel.

### Nicht auswählbar

| Rolle | Grund |
| --- | --- |
| Hundewolf | andere Bezeichnung für den Wolfshund – als Wolfshund enthalten |
| Kräuterhexe | in keiner Ausgabe mit festen Regeln enthalten |
| Brandstifter | braucht den Spielplan der Erweiterung „Die Gemeinde“ |

## 9. Damit das Spiel nicht hängen bleibt

- **Überspringen** (nur Spielleitung, Digitalregel): beendet die aktuelle
  Phase mit dem, was eingegeben wurde. Fehlende Stimmen zählen als
  Enthaltung, fehlende Nachtaktionen als „nichts getan“. Haben sich die
  Wölfe nicht geeinigt, gilt das am häufigsten gewählte Opfer (bei
  Gleichstand eines davon); hat kein Wolf gewählt, greift niemand an. Ein
  offener Schuss des Jägers, eine offene Nachfolge (dann ohne Hauptmann) oder
  die offene Wahl des Sündenbocks (dann dürfen alle abstimmen) verfällt.
- **Doppelte Anfragen** (z. B. nach einem Funkloch) werden nur einmal
  ausgeführt.
- **Gerät gewechselt:** Auf dem neuen Gerät den eigenen Namen wählen; die
  Spielleitung bestätigt. Das alte Gerät verliert damit den Zugang.
- **Spielleitung weg:** Ist sie 45 Sekunden nicht erreichbar, übernimmt der
  nächste verbundene Spieler.

## 10. Was jeder sieht

- Die eigene Rolle und eigene Nachtergebnisse sieht nur man selbst.
- Wölfe sehen ihr Rudel (der Weiße Werwolf gilt dabei als normaler Wolf),
  Verliebte einander, Verzauberte alle Verzauberten.
- Rollen anderer Lebender schickt der Server nie an ein Handy – erst wenn
  jemand ausscheidet oder das Spiel endet.
- Der Spielverlauf mit allen geheimen Ereignissen ist erst nach Spielende
  sichtbar.
