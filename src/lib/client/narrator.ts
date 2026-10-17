import { ROLES } from "../game/roles";
import type { DeathCause, View } from "../game/types";

export const CAUSE_TEXT: Record<DeathCause, string> = {
  wolf: "wurde von den Wölfen erwischt",
  gift: "wurde vergiftet",
  vote: "wurde vom Dorf verbannt",
  jaeger: "wurde vom Jäger getroffen",
  liebe: "ging aus Liebeskummer mit",
  tetanus: "starb an der Wunde der rostigen Klinge",
  suendenbock: "wurde als Sündenbock verbannt",
};

const name = (view: View, id: string | null | undefined) => view.players.find((p) => p.id === id)?.name ?? "jemand";

function deathLines(view: View): string {
  const deaths = view.announce?.deaths ?? [];
  return deaths
    .map((d) => {
      const p = view.players.find((x) => x.id === d.id);
      if (!p) return "";
      const role = p.role ? ` ${p.name} war ${ROLES[p.role].was}.` : "";
      return `${p.name} ${CAUSE_TEXT[d.cause]}.${role}`;
    })
    .join(" ");
}

/** The public story text for the current moment. Never contains secrets. */
export function narration(view: View): string {
  switch (view.phase) {
    case "roles":
      return "Schaut euch heimlich eure Rolle an.";
    case "night":
      if (view.step === "hexe") return "Die Hexe erwacht.";
      return view.firstStep
        ? "Es wird Nacht im Dorf. Wer jetzt eine Aufgabe hat, findet sie auf seinem Handy."
        : "Die Nacht geht weiter.";
    case "announce": {
      const a = view.announce;
      if (!a) return "";
      const none = a.deaths.length === 0;
      switch (a.kind) {
        case "morning":
          return none
            ? "Die Sonne geht auf. Alle haben die Nacht überlebt."
            : `Die Sonne geht auf. ${deathLines(view)}`;
        case "hunter":
          return `Der Jäger hat geschossen. ${deathLines(view)}`;
        case "election":
          return `${name(view, a.captain)} ist jetzt Hauptmann.`;
        case "succession":
          return `${name(view, a.captain)} ist der neue Hauptmann.`;
        case "scapegoat":
          return "Der Sündenbock hat bestimmt, wer morgen abstimmen darf.";
        default:
          if (a.exposed) return `${name(view, a.exposed)} ist der Dorfdepp und darf bleiben.`;
          if (none) {
            return a.tie
              ? "Wieder Gleichstand. Heute muss niemand das Dorf verlassen."
              : "Heute muss niemand das Dorf verlassen.";
          }
          return `Das Dorf hat entschieden. ${deathLines(view)}`;
      }
    }
    case "hunter":
      return "Der Jäger darf noch ein letztes Mal schießen.";
    case "succession":
      return "Der Hauptmann bestimmt seinen Nachfolger.";
    case "scapegoat":
      return "Der Sündenbock bestimmt, wer morgen abstimmen darf.";
    case "election":
      return view.vote?.round === 2 ? "Gleichstand! Es gibt eine Stichwahl." : "Wählt euren Hauptmann!";
    case "discussion":
      return "Wer von euch ist ein Werwolf? Besprecht euch!";
    case "vote":
      return view.vote?.round === 2
        ? "Gleichstand! Es gibt eine Stichwahl."
        : "Wer von euch ist ein Werwolf? Besprecht euch und stimmt ab, bevor die Zeit um ist!";
    case "ended":
      switch (view.ended?.winner) {
        case "dorf":
          return "Alle Wölfe sind entlarvt. Das Dorf hat gewonnen!";
        case "wolf":
          return "Die Wölfe haben das Dorf übernommen. Das Rudel gewinnt!";
        case "paar":
          return "Nur die Verliebten sind noch übrig. Das Liebespaar gewinnt!";
        case "floetenspieler":
          return "Das ganze Dorf tanzt nach seiner Flöte. Der Flötenspieler gewinnt!";
        case "weisserWolf":
          return "Am Ende ist nur einer übrig. Der Weiße Werwolf gewinnt!";
        case "engel":
          return "Der Engel ist gleich zu Beginn gegangen – und hat damit gewonnen!";
        default:
          return "Niemand hat überlebt. Diese Runde hat keinen Sieger.";
      }
    default:
      return "";
  }
}
