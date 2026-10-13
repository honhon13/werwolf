import type { View } from "../../game/types";

/**
 * The narrator recordings, by the file name (without extension) they are
 * looked up under in public/audio/sprache. SPRECHTEXTE.md has the lines.
 */
export const CLIPS = {
  rollen: "01-rollen",
  nachtErste: "02-nacht-erste",
  nacht: "03-nacht",
  hexe: "04-hexe",
  morgenRuhig: "05-morgen-ruhig",
  morgenOpfer: "06-morgen-opfer",
  jaeger: "07-jaeger",
  jaegerSchuss: "08-jaeger-schuss",
  diskussion: "09-diskussion",
  abstimmung: "10-abstimmung",
  stichwahl: "11-stichwahl",
  urteilVerbannt: "12-urteil-verbannt",
  urteilNiemand: "13-urteil-niemand",
  siegDorf: "14-sieg-dorf",
  siegWerwoelfe: "15-sieg-werwoelfe",
  siegLiebespaar: "16-sieg-liebespaar",
  siegNiemand: "17-sieg-niemand",
} as const;

export type ClipId = keyof typeof CLIPS;

export const CLIP_FOLDER = "/audio/sprache";
/** A recording may be saved in any of these formats. */
export const CLIP_FORMATS = ["m4a", "mp3", "wav"] as const;

/** File names of the recordings that exist; next.config.ts fills this in. */
const RECORDED = (process.env.RECORDINGS ?? "").split(",").filter(Boolean);

/** Where to fetch a clip, or null while it is still an empty placeholder. */
export function clipUrl(id: ClipId): string | null {
  const file = RECORDED.find((name) => name.slice(0, name.lastIndexOf(".")) === CLIPS[id]);
  return file ? `${CLIP_FOLDER}/${file}` : null;
}

/** The recording that belongs to the current moment of the game. */
export function clipFor(view: View): ClipId | null {
  switch (view.phase) {
    case "roles":
      return "rollen";
    case "night":
      return view.round === 1 ? "nachtErste" : "nacht";
    case "witch":
      return "hexe";
    case "announce": {
      if (!view.announce) return null;
      const nobody = view.announce.deaths.length === 0;
      if (view.announce.kind === "morning") return nobody ? "morgenRuhig" : "morgenOpfer";
      if (view.announce.kind === "hunter") return "jaegerSchuss";
      return nobody ? "urteilNiemand" : "urteilVerbannt";
    }
    case "hunter":
      return "jaeger";
    case "discussion":
      return "diskussion";
    case "vote":
      return view.vote?.round === 2 ? "stichwahl" : "abstimmung";
    case "ended":
      switch (view.ended?.winner) {
        case "dorf":
          return "siegDorf";
        case "wolf":
          return "siegWerwoelfe";
        case "paar":
          return "siegLiebespaar";
        case "niemand":
          return "siegNiemand";
        default:
          return null;
      }
    default:
      return null;
  }
}
