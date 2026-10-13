import { ROLES } from "../game/roles";
import type { DeathCause, View } from "../game/types";

export const CAUSE_TEXT: Record<DeathCause, string> = {
  wolf: "wurde von den Werwölfen erwischt",
  gift: "wurde vergiftet",
  vote: "wurde vom Dorf verbannt",
  jaeger: "wurde vom Jäger getroffen",
  liebe: "ging aus Liebeskummer mit",
};

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
      return "Es wird Nacht im Dorf. Schaut auf euer Handy: Jeder hat jetzt eine geheime Aufgabe.";
    case "witch":
      return "Die Hexe erwacht.";
    case "announce": {
      const none = (view.announce?.deaths.length ?? 0) === 0;
      if (view.announce?.kind === "morning") {
        return none
          ? "Die Sonne geht auf. Alle haben die Nacht überlebt."
          : `Die Sonne geht auf. ${deathLines(view)}`;
      }
      if (view.announce?.kind === "hunter") return `Der Jäger hat geschossen. ${deathLines(view)}`;
      if (none) {
        return view.announce?.tie
          ? "Wieder Gleichstand. Heute muss niemand das Dorf verlassen."
          : "Niemand wurde gewählt. Heute muss niemand das Dorf verlassen.";
      }
      return `Das Dorf hat entschieden. ${deathLines(view)}`;
    }
    case "hunter":
      return "Der Jäger darf noch ein letztes Mal schießen.";
    case "discussion":
      return "Wer von euch ist ein Werwolf? Besprecht euch!";
    case "vote":
      return view.vote?.round === 2
        ? "Gleichstand! Es gibt eine Stichwahl."
        : "Stimmt jetzt ab: Wer soll das Dorf verlassen?";
    case "ended":
      switch (view.ended?.winner) {
        case "dorf":
          return "Alle Werwölfe sind entlarvt. Das Dorf hat gewonnen!";
        case "wolf":
          return "Die Werwölfe haben das Dorf übernommen. Die Werwölfe gewinnen!";
        case "paar":
          return "Nur die Verliebten sind noch übrig. Das Liebespaar gewinnt!";
        default:
          return "Niemand hat überlebt. Diese Runde hat keinen Sieger.";
      }
    default:
      return "";
  }
}
