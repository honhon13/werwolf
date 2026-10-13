import type { RoleId, RoleSetup, Settings, Team } from "./types";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

export interface RoleInfo {
  name: string;
  /** Name with article, as used in a sentence: "Anna war …". */
  was: string;
  emoji: string;
  team: Team;
  goal: string;
  text: string;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  werwolf: {
    name: "Werwolf",
    was: "ein Werwolf",
    emoji: "🐺",
    team: "wolf",
    goal: "Du gewinnst mit den Werwölfen.",
    text: "Jede Nacht sucht ihr Werwölfe euch heimlich ein Opfer aus. Am Tag tust du so, als wärst du ein harmloser Dorfbewohner.",
  },
  dorfbewohner: {
    name: "Dorfbewohner",
    was: "ein Dorfbewohner",
    emoji: "🧑‍🌾",
    team: "dorf",
    goal: "Du gewinnst mit dem Dorf.",
    text: "Du hast keine besondere Fähigkeit. Beobachte gut, diskutiere mit und finde am Tag heraus, wer ein Werwolf ist.",
  },
  seherin: {
    name: "Seherin",
    was: "die Seherin",
    emoji: "🔮",
    team: "dorf",
    goal: "Du gewinnst mit dem Dorf.",
    text: "Jede Nacht darfst du die Rolle eines Mitspielers ansehen. Nutze dein Wissen klug, sonst holen dich die Werwölfe.",
  },
  hexe: {
    name: "Hexe",
    was: "die Hexe",
    emoji: "🧪",
    team: "dorf",
    goal: "Du gewinnst mit dem Dorf.",
    text: "Du hast zwei Tränke für das ganze Spiel: Mit dem Heiltrank rettest du das Opfer der Werwölfe, mit dem Gifttrank lässt du jemanden ausscheiden.",
  },
  jaeger: {
    name: "Jäger",
    was: "der Jäger",
    emoji: "🏹",
    team: "dorf",
    goal: "Du gewinnst mit dem Dorf.",
    text: "Wenn du ausscheidest, darfst du mit deinem letzten Schuss noch einen Mitspieler mitnehmen.",
  },
  amor: {
    name: "Amor",
    was: "Amor",
    emoji: "💘",
    team: "dorf",
    goal: "Du gewinnst mit dem Dorf.",
    text: "In der ersten Nacht bestimmst du zwei Verliebte. Scheidet einer von beiden aus, geht der andere aus Kummer mit.",
  },
};

export const ROLE_ORDER: RoleId[] = [
  "werwolf",
  "seherin",
  "hexe",
  "jaeger",
  "amor",
  "dorfbewohner",
];

export function autoSetup(n: number): RoleSetup {
  return {
    wolves: n >= 18 ? 4 : n >= 12 ? 3 : n >= 6 ? 2 : 1,
    seherin: true,
    hexe: true,
    jaeger: n >= 5,
    amor: n >= 7,
  };
}

export function effectiveSetup(n: number, settings: Settings): RoleSetup {
  return settings.auto ? autoSetup(n) : settings.custom;
}

/** The list of roles dealt to n players, or a reason why that is not possible. */
export function composition(
  n: number,
  settings: Settings,
): { roles: RoleId[]; error: null } | { roles: null; error: string } {
  if (n < MIN_PLAYERS) {
    return { roles: null, error: `Ihr braucht mindestens ${MIN_PLAYERS} Spieler.` };
  }
  const setup = effectiveSetup(n, settings);
  const roles: RoleId[] = [];
  for (let i = 0; i < setup.wolves; i++) roles.push("werwolf");
  if (setup.seherin) roles.push("seherin");
  if (setup.hexe) roles.push("hexe");
  if (setup.jaeger) roles.push("jaeger");
  if (setup.amor) roles.push("amor");
  if (setup.wolves < 1) {
    return { roles: null, error: "Es muss mindestens einen Werwolf geben." };
  }
  if (roles.length > n) {
    return { roles: null, error: "Es gibt mehr Rollen als Spieler." };
  }
  if (setup.wolves * 2 >= n) {
    return { roles: null, error: "Das sind zu viele Werwölfe für diese Runde." };
  }
  while (roles.length < n) roles.push("dorfbewohner");
  return { roles, error: null };
}
