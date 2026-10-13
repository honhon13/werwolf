import { ROLE_ORDER, ROLES } from "@/lib/game/roles";

const STEPS = [
  ["🎭", "Rolle ansehen", "Jeder bekommt heimlich eine Rolle. Zeig dein Handy niemandem!"],
  ["🌙", "Nacht", "Alle tippen heimlich etwas auf ihrem Handy. So merkt keiner, wer eine besondere Rolle hat."],
  ["🌅", "Morgen", "Die App verrät, wen es in der Nacht erwischt hat."],
  ["💬", "Tag", "Ihr besprecht euch und stimmt ab, wer das Dorf verlassen muss."],
  ["🔁", "Und wieder", "Dann wird es erneut Nacht – bis ein Team gewonnen hat."],
];

export function Rules() {
  return (
    <div className="space-y-5 text-base leading-snug">
      <p>
        Im Dorf verstecken sich <b>Werwölfe</b>. Das Dorf will sie entlarven. Die Werwölfe wollen
        unentdeckt bleiben, bis sie nicht mehr in der Unterzahl sind.
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

      <div>
        <h3 className="mb-2 font-display text-2xl font-extrabold">Die Rollen</h3>
        <ul className="space-y-2.5">
          {ROLE_ORDER.map((id) => (
            <li key={id} className="flex gap-3">
              <span className="text-2xl" aria-hidden>
                {ROLES[id].emoji}
              </span>
              <span>
                <b>{ROLES[id].name}:</b> {ROLES[id].text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-display text-2xl font-extrabold">Gut zu wissen</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Wer ausscheidet, zeigt seine Rolle, darf zuschauen und verrät nichts mehr.</li>
          <li>Bei Gleichstand gibt es eine Stichwahl. Steht es wieder gleich, muss niemand gehen.</li>
          <li>Sind die Verliebten aus verschiedenen Teams, gewinnen sie nur gemeinsam als Letzte.</li>
          <li>
            Zu dritt spielt ihr eine Kurzrunde: Nachts scheidet niemand aus, die Seherin findet den
            Werwolf, und eine einzige Abstimmung entscheidet.
          </li>
          <li>Hängt das Spiel, kann die Spielleitung im Menü eine Phase überspringen.</li>
        </ul>
      </div>
    </div>
  );
}
