import { CAPTAIN_TEXT, CATEGORY_NAMES, type Category, NOT_AVAILABLE, ROLE_ORDER, ROLES, SOURCE_NAMES } from "@/lib/game/roles";

const STEPS = [
  ["🎭", "Rolle ansehen", "Jeder bekommt heimlich eine Rolle. Zeig dein Handy niemandem!"],
  ["🌙", "Nacht", "Wer eine Fähigkeit hat, bekommt seine Aufgabe aufs Handy. Im Tarnmodus tippen alle etwas, damit am Tisch niemand auffällt."],
  ["🌅", "Morgen", "Die App verrät, wen es in der Nacht erwischt hat."],
  ["💬", "Tag", "Ihr besprecht euch und stimmt ab, wer das Dorf verlassen muss. Die Stimmen werden erst gezeigt, wenn alle abgestimmt haben."],
  ["🔁", "Und wieder", "Dann wird es erneut Nacht – bis jemand gewonnen hat."],
];

const RULES = [
  "Wer ausscheidet, zeigt seine Rolle, darf zuschauen und verrät nichts mehr.",
  "Bei der Abstimmung darf man sich enthalten. Bei Gleichstand wird der Sündenbock verbannt; ohne ihn gibt es eine Stichwahl, und steht es wieder gleich, muss niemand gehen.",
  "Das Rudel gewinnt, sobald es mindestens so viele Wölfe gibt wie alle anderen zusammen. Das Dorf gewinnt, wenn kein Wolf, kein Weißer Werwolf und kein Flötenspieler mehr lebt.",
  "Sind die Verliebten aus verschiedenen Teams, gewinnen sie nur gemeinsam als die letzten beiden.",
  "Die Sitzreihenfolge ist die Reihenfolge in der Lobby – wichtig für Fuchs, Bärenführer und Ritter.",
  "Zu dritt spielt ihr eine Kurzrunde: Nachts erwischen die Wölfe niemanden, und eine einzige Abstimmung entscheidet.",
  "Zu viert gelten die normalen Regeln, nur ohne Hauptmann. Auch bei 3 und 4 Spielern könnt ihr die Rollen selbst wählen – ein Werwolf ist immer dabei.",
  "Wer das Spiel verlässt, scheidet aus und zeigt seine Rolle. Ausgelöst wird dadurch nichts: kein Jäger-Schuss, kein Liebeskummer.",
  "Hängt das Spiel, kann die Spielleitung im Menü eine Phase überspringen.",
];

export function Rules() {
  const groups = (Object.keys(CATEGORY_NAMES) as Category[]).map((category) => ({
    category,
    roles: ROLE_ORDER.filter((r) => ROLES[r].category === category),
  }));

  return (
    <div className="space-y-5 text-base leading-snug">
      <p>
        Im Dorf verstecken sich <b>Werwölfe</b>. Das Dorf will sie entlarven, die Wölfe wollen unentdeckt
        bleiben. Manche spielen auch ganz für sich allein.
      </p>

      <ol className="space-y-2.5">
        {STEPS.map(([emoji, title, text]) => (
          <li key={title} className="flex gap-3">
            <span className="text-2xl" aria-hidden>
              {emoji}
            </span>
            <span>
              <b>{title}:</b> {text}
            </span>
          </li>
        ))}
      </ol>

      {groups.map(({ category, roles }) => (
        <div key={category}>
          <h3 className="mb-2 font-display text-2xl font-extrabold">{CATEGORY_NAMES[category]}</h3>
          <ul className="space-y-2.5">
            {roles.map((id) => (
              <li key={id} className="flex gap-3">
                <span className="text-2xl" aria-hidden>
                  {ROLES[id].emoji}
                </span>
                <span>
                  <b>{ROLES[id].name}</b>{" "}
                  <span className="text-sm text-ink-soft">
                    ({SOURCE_NAMES[ROLES[id].source]}
                    {ROLES[id].adapted ? ", Digitalregel" : ""})
                  </span>
                  : {ROLES[id].text}
                </span>
              </li>
            ))}
            {category === "sonder" && (
              <li className="flex gap-3">
                <span className="text-2xl" aria-hidden>
                  🎖️
                </span>
                <span>
                  <b>Hauptmann</b> <span className="text-sm text-ink-soft">(Grundspiel, wählbar)</span>: {CAPTAIN_TEXT}
                </span>
              </li>
            )}
          </ul>
        </div>
      ))}

      <div>
        <h3 className="mb-2 font-display text-2xl font-extrabold">Gut zu wissen</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-display text-2xl font-extrabold">Nicht auswählbar</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
          {NOT_AVAILABLE.map((r) => (
            <li key={r.name}>
              <b className="text-ink">{r.name}:</b> {r.reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
