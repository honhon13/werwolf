import type { Mode, RoleId, Settings, Source, Team } from "./types";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 18;
/** Fewer players than this get a fixed variant instead of free role choice. */
export const FREE_CHOICE_FROM = 5;
/** Kept for the screens that ask about the short round. */
export const SHORT_ROUND_PLAYERS = 3;

export type Category = "grund" | "info" | "sonder" | "erweiterung";

export interface RoleInfo {
  name: string;
  /** Name with article, as used in a sentence: "Anna war …". */
  was: string;
  emoji: string;
  /** Team at the start of the game. */
  team: Team;
  source: Source;
  category: Category;
  /** How often the role may be in one game. */
  max: number;
  /** A wolf card: hunts with the pack from the first night. */
  hunts?: boolean;
  /** Loses its ability once the Ältester has been killed by the village. */
  village?: boolean;
  /** The rule is adapted for phones, which the printed rules do not cover. */
  adapted?: boolean;
  goal: string;
  text: string;
}

const ALONE = "Du gewinnst allein.";
const VILLAGE = "Du gewinnst mit dem Dorf.";
const PACK = "Du gewinnst mit dem Rudel.";

export const ROLES: Record<RoleId, RoleInfo> = {
  dorfbewohner: {
    name: "Dorfbewohner",
    was: "ein Dorfbewohner",
    emoji: "🧑‍🌾",
    team: "dorf",
    source: "grundspiel",
    category: "grund",
    max: Infinity,
    goal: VILLAGE,
    text: "Du hast keine besondere Fähigkeit. Beobachte gut, diskutiere mit und finde am Tag heraus, wer zum Rudel gehört.",
  },
  werwolf: {
    name: "Werwolf",
    was: "ein Werwolf",
    emoji: "🐺",
    team: "wolf",
    source: "grundspiel",
    category: "grund",
    max: Infinity,
    hunts: true,
    goal: PACK,
    text: "Jede Nacht wählt ihr Werwölfe gemeinsam ein Opfer – ihr müsst euch einig sein. Am Tag tust du so, als wärst du harmlos.",
  },
  seherin: {
    name: "Seherin",
    was: "die Seherin",
    emoji: "🔮",
    team: "dorf",
    source: "grundspiel",
    category: "info",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Jede Nacht siehst du die Rolle eines Mitspielers.",
  },
  amor: {
    name: "Amor",
    was: "Amor",
    emoji: "💘",
    team: "dorf",
    source: "grundspiel",
    category: "info",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "In der ersten Nacht bestimmst du zwei Verliebte – auch dich selbst. Stirbt einer der beiden, stirbt der andere aus Kummer mit. Sind sie in verschiedenen Teams, gewinnen sie nur gemeinsam als die letzten beiden.",
  },
  dieb: {
    name: "Dieb",
    was: "der Dieb",
    emoji: "🦹",
    team: "dorf",
    source: "grundspiel",
    category: "info",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Im Spiel liegen zwei Karten mehr, als es Spieler gibt. In der ersten Nacht darfst du deine Karte gegen eine der beiden tauschen und spielst ab sofort diese Rolle. Sind beide Wolfskarten, musst du eine nehmen. Behältst du deine Karte, bist du ein normaler Dorfbewohner.",
  },
  maedchen: {
    name: "Kleines Mädchen",
    was: "das Kleine Mädchen",
    emoji: "👧",
    team: "dorf",
    source: "grundspiel",
    category: "info",
    max: 1,
    village: true,
    adapted: true,
    goal: VILLAGE,
    text: "Jede Nacht darfst du die Werwölfe belauschen. Dann erfährst du den Namen eines Wolfs – aber mit einer Chance von 1 zu 3 bemerken sie dich und greifen dich statt ihres Opfers an.",
  },
  hexe: {
    name: "Hexe",
    was: "die Hexe",
    emoji: "🧪",
    team: "dorf",
    source: "grundspiel",
    category: "sonder",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Du hast zwei Tränke für das ganze Spiel. Jede Nacht siehst du, wen die Wölfe angegriffen haben. Mit dem Heiltrank rettest du einen davon, auch dich selbst; mit dem Gifttrank lässt du jemanden ausscheiden.",
  },
  jaeger: {
    name: "Jäger",
    was: "der Jäger",
    emoji: "🏹",
    team: "dorf",
    source: "grundspiel",
    category: "sonder",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Scheidest du aus, nimmst du mit deinem letzten Schuss sofort einen Mitspieler mit.",
  },
  beschuetzer: {
    name: "Beschützer",
    was: "der Beschützer",
    emoji: "🛡️",
    team: "dorf",
    source: "neumond",
    category: "sonder",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Jede Nacht schützt du einen Spieler vor allen Angriffen der Wölfe – auch dich selbst, aber nie zweimal hintereinander denselben. Gegen Gift und Abstimmungen hilft der Schutz nicht.",
  },
  aeltester: {
    name: "Ältester",
    was: "der Älteste",
    emoji: "👴",
    team: "dorf",
    source: "neumond",
    category: "sonder",
    max: 1,
    goal: VILLAGE,
    text: "Den ersten Angriff der Wölfe überlebst du. Tötet dich aber das Dorf selbst – durch Abstimmung, den Jäger oder den Gifttrank –, verlieren alle Dorfbewohner ihre Fähigkeiten.",
  },
  suendenbock: {
    name: "Sündenbock",
    was: "der Sündenbock",
    emoji: "🐐",
    team: "dorf",
    source: "neumond",
    category: "sonder",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Endet eine Abstimmung im Gleichstand, wirst du statt dessen verbannt. Dann bestimmst du, wer am nächsten Tag abstimmen darf.",
  },
  idiot: {
    name: "Dorfdepp",
    was: "der Dorfdepp",
    emoji: "🤪",
    team: "dorf",
    source: "neumond",
    category: "sonder",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Verbannt dich das Dorf, wirst du als Dorfdepp erkannt und darfst bleiben – aber nie mehr abstimmen. Das klappt nur einmal, und vor den Wölfen schützt es dich nicht.",
  },
  floetenspieler: {
    name: "Flötenspieler",
    was: "der Flötenspieler",
    emoji: "🎶",
    team: "solo",
    source: "neumond",
    category: "sonder",
    max: 1,
    goal: ALONE,
    text: "Du spielst für dich. Jede Nacht verzauberst du zwei Mitspieler, die davon erfahren. Sind alle anderen Lebenden verzaubert, hast du gewonnen.",
  },
  wolfshund: {
    name: "Wolfshund",
    was: "der Wolfshund",
    emoji: "🐕",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    goal: "Du gewinnst mit dem Team, das du wählst.",
    text: "In der ersten Nacht entscheidest du: Bleibst du beim Dorf, oder jagst du ab sofort mit den Wölfen? Die Seherin sieht dich immer als Wolfshund.",
  },
  weisserWolf: {
    name: "Weißer Werwolf",
    was: "der Weiße Werwolf",
    emoji: "🤍",
    team: "solo",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    hunts: true,
    goal: "Du gewinnst nur, wenn du am Ende allein übrig bist.",
    text: "Du jagst mit den Werwölfen, die dich für einen von ihnen halten. In jeder zweiten Nacht darfst du zusätzlich heimlich einen Wolf töten.",
  },
  grosserWolf: {
    name: "Großer böser Wolf",
    was: "der Große böse Wolf",
    emoji: "😈",
    team: "wolf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    hunts: true,
    goal: PACK,
    text: "Du jagst mit dem Rudel. Solange noch kein Wolf gestorben ist, darfst du jede Nacht allein ein zweites Opfer wählen.",
  },
  urwolf: {
    name: "Urwolf",
    was: "der Urwolf",
    emoji: "🦠",
    team: "wolf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    hunts: true,
    goal: PACK,
    text: "Du jagst mit dem Rudel. Einmal im Spiel darfst du das Opfer infizieren statt es zu töten: Es überlebt und gehört ab sofort heimlich zum Rudel – seine Fähigkeit behält es.",
  },
  wildesKind: {
    name: "Wildes Kind",
    was: "das Wilde Kind",
    emoji: "🧒",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    village: true,
    goal: "Du gewinnst mit dem Dorf – oder mit dem Rudel, wenn du zum Wolf wirst.",
    text: "In der ersten Nacht wählst du ein Vorbild. Solange es lebt, gehörst du zum Dorf. Stirbt es, wirst du zum Werwolf.",
  },
  fuchs: {
    name: "Fuchs",
    was: "der Fuchs",
    emoji: "🦊",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Jede Nacht wählst du einen Spieler und erfährst, ob er oder einer seiner beiden lebenden Nachbarn zum Rudel gehört. Ist keiner von ihnen ein Wolf, verlierst du deine Fähigkeit.",
  },
  baerenfuehrer: {
    name: "Bärenführer",
    was: "der Bärenführer",
    emoji: "🐻",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Jeden Morgen brummt dein Bär für alle hörbar, wenn einer deiner beiden lebenden Nachbarn zum Rudel gehört.",
  },
  rabe: {
    name: "Rabe",
    was: "der Rabe",
    emoji: "🪶",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Jede Nacht darfst du einen Spieler markieren. Bei der nächsten Abstimmung hat er schon zwei Stimmen gegen sich. Am Morgen erfahren alle, wen du markiert hast.",
  },
  ritter: {
    name: "Ritter mit der rostigen Klinge",
    was: "der Ritter mit der rostigen Klinge",
    emoji: "⚔️",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Töten dich die Wölfe, verletzt deine rostige Klinge den nächsten Wolf nach dir in der Sitzreihenfolge. Er stirbt am Ende der folgenden Nacht.",
  },
  engel: {
    name: "Engel",
    was: "der Engel",
    emoji: "👼",
    team: "solo",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    goal: "Du gewinnst allein, wenn du gleich zu Beginn ausscheidest.",
    text: "Mit dir beginnt das Spiel mit einem Tag. Wirst du bei dieser ersten Abstimmung oder in der ersten Nacht getötet, gewinnst du sofort allein. Sonst bist du danach ein normaler Dorfbewohner.",
  },
  schauspieler: {
    name: "Schauspieler",
    was: "der Schauspieler",
    emoji: "🤹",
    team: "dorf",
    source: "charaktere",
    category: "erweiterung",
    max: 1,
    village: true,
    goal: VILLAGE,
    text: "Zu Spielbeginn bekommst du drei Fähigkeiten aus Seherin, Beschützer, Fuchs und Rabe. In jeder Nacht darfst du eine davon für diese Nacht benutzen, jede nur einmal.",
  },
};

export const ROLE_ORDER = Object.keys(ROLES) as RoleId[];

export const CATEGORY_NAMES: Record<Category, string> = {
  grund: "Grundrollen",
  info: "Informations- und Nachtrollen",
  sonder: "Sonderrollen",
  erweiterung: "Erweiterungsrollen",
};

export const SOURCE_NAMES: Record<Source, string> = {
  grundspiel: "Grundspiel",
  neumond: "Erweiterung Neumond",
  charaktere: "Erweiterung Charaktere",
};

/** Roles from the wish list that cannot be chosen, and why. */
export const NOT_AVAILABLE: { name: string; reason: string }[] = [
  {
    name: "Hundewolf",
    reason: "Andere Bezeichnung für den Wolfshund – im Spiel als Wolfshund enthalten.",
  },
  {
    name: "Kräuterhexe",
    reason: "In keiner Ausgabe der Werwölfe von Düsterwald mit festen Regeln enthalten.",
  },
  {
    name: "Brandstifter",
    reason: "Braucht den Spielplan der Erweiterung „Die Gemeinde“ und lässt sich ohne ihn nicht regelgetreu spielen.",
  },
];

export const CAPTAIN_TEXT =
  "Wird am ersten Tag von allen gewählt. Seine Stimme zählt doppelt. Stirbt er, bestimmt er seinen Nachfolger.";

/** The abilities the Schauspieler can be dealt. */
export const ACTOR_POWERS: RoleId[] = ["seherin", "beschuetzer", "fuchs", "rabe"];

export function modeFor(n: number): Mode {
  return n === 3 ? "kurz" : n === 4 ? "vier" : "normal";
}

/** The fixed roles of the two small variants. */
const SMALL: Record<Exclude<Mode, "normal">, RoleId[]> = {
  kurz: ["werwolf", "seherin", "dorfbewohner"],
  vier: ["werwolf", "seherin", "beschuetzer", "dorfbewohner"],
};

/** Special roles added one after another as more players join. */
const AUTO_SPECIALS: RoleId[] = [
  "seherin",
  "hexe",
  "jaeger",
  "amor",
  "beschuetzer",
  "aeltester",
  "fuchs",
  "rabe",
  "baerenfuehrer",
  "idiot",
  "ritter",
  "wildesKind",
];

/** A balanced set of cards for n players (5 to 18). */
export function autoRoles(n: number): RoleId[] {
  const wolves = n <= 5 ? 1 : n <= 11 ? 2 : n <= 16 ? 3 : 4;
  const plain = n >= 10 ? 2 : 1;
  const specials = AUTO_SPECIALS.slice(0, Math.max(0, n - wolves - plain));
  const roles: RoleId[] = [...Array(wolves).fill("werwolf"), ...specials];
  while (roles.length < n) roles.push("dorfbewohner");
  return roles;
}

/** Turns role counts into a list of cards. */
export function cards(counts: Partial<Record<RoleId, number>>): RoleId[] {
  return ROLE_ORDER.flatMap((role) => Array(Math.max(0, Math.floor(counts[role] ?? 0))).fill(role));
}

export function countsOf(roles: RoleId[]): Partial<Record<RoleId, number>> {
  const counts: Partial<Record<RoleId, number>> = {};
  for (const role of roles) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}

/** Cards needed for n players: two more when the Dieb is in the game. */
export function cardsNeeded(n: number, roles: RoleId[]): number {
  return roles.includes("dieb") ? n + 2 : n;
}

/** Why a set of cards cannot be played by n players, or null if it can. */
export function problem(n: number, roles: RoleId[]): string | null {
  if (n < MIN_PLAYERS) return `Ihr braucht mindestens ${MIN_PLAYERS} Spieler.`;
  if (n > MAX_PLAYERS) return `Es können höchstens ${MAX_PLAYERS} Spieler mitspielen.`;
  const counts = countsOf(roles);
  for (const role of ROLE_ORDER) {
    if ((counts[role] ?? 0) > ROLES[role].max) return `${ROLES[role].name} darf nur einmal im Spiel sein.`;
  }
  const needed = cardsNeeded(n, roles);
  if (roles.length !== needed) {
    const extra = roles.includes("dieb") ? " (mit Dieb zwei mehr als Spieler)" : "";
    return `Gewählt sind ${roles.length} Karten, gebraucht werden ${needed}${extra}.`;
  }
  if (!roles.some((r) => r === "werwolf" || r === "urwolf" || r === "grosserWolf")) {
    return "Es braucht mindestens einen Werwolf, Urwolf oder Großen bösen Wolf.";
  }
  const hunters = roles.filter((r) => ROLES[r].hunts).length;
  if (hunters * 2 >= n) {
    return "Zu viele Wölfe: Sie dürfen nicht von Anfang an mindestens so viele sein wie alle anderen.";
  }
  if (!roles.some((r) => ROLES[r].team === "dorf")) return "Es braucht mindestens eine Rolle für das Dorf.";
  return null;
}

/** The cards for n players under the given settings, or why there are none. */
export function composition(
  n: number,
  settings: Settings,
): { roles: RoleId[]; error: null } | { roles: null; error: string } {
  if (n < MIN_PLAYERS) return { roles: null, error: `Ihr braucht mindestens ${MIN_PLAYERS} Spieler.` };
  if (n > MAX_PLAYERS) return { roles: null, error: `Es können höchstens ${MAX_PLAYERS} Spieler mitspielen.` };
  const mode = modeFor(n);
  if (mode !== "normal") return { roles: [...SMALL[mode]], error: null };
  const roles = settings.auto ? autoRoles(n) : cards(settings.counts);
  const error = problem(n, roles);
  return error ? { roles: null, error } : { roles, error: null };
}

/**
 * Shuffles the cards and hands them out. With the Dieb the two cards left
 * over are the centre; at least one wolf card always ends up with a player.
 */
export function deal(roles: RoleId[], n: number, rng: () => number): { hands: RoleId[]; center: RoleId[] } {
  for (let attempt = 0; ; attempt++) {
    const shuffled = shuffle(roles, rng);
    const hands = shuffled.slice(0, n);
    if (hands.some((r) => ROLES[r].hunts && r !== "weisserWolf") || attempt > 200) {
      return { hands, center: shuffled.slice(n) };
    }
  }
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** What the three roles of a short round do, which differs from a full game. */
const SHORT_ROUND_TEXT: Partial<Record<RoleId, string>> = {
  werwolf:
    "In dieser Kurzrunde erwischst du niemanden. Am Tag gibt es genau eine Abstimmung: Wirst du nicht verbannt, hast du gewonnen. Tipp: Behaupte, du wärst die Seherin!",
  seherin:
    "In der Nacht siehst du die Rolle eines Mitspielers. Danach weißt du, wer der Werwolf ist. Überzeuge am Tag den Dorfbewohner davon!",
  dorfbewohner:
    "Du weißt nicht, wer der Werwolf ist. Am Tag erzählen dir die beiden anderen ihre Geschichte. Finde heraus, wer lügt – ihr habt nur eine Abstimmung!",
};

export function roleText(role: RoleId, short: boolean): string {
  return (short && SHORT_ROUND_TEXT[role]) || ROLES[role].text;
}
