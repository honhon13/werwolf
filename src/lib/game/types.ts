/** Schema version of the stored game state; older rooms are upgraded on load. */
export const STATE_REV = 2;

export type RoleId =
  | "dorfbewohner"
  | "werwolf"
  | "seherin"
  | "amor"
  | "dieb"
  | "maedchen"
  | "hexe"
  | "jaeger"
  | "beschuetzer"
  | "aeltester"
  | "suendenbock"
  | "idiot"
  | "floetenspieler"
  | "wolfshund"
  | "weisserWolf"
  | "grosserWolf"
  | "urwolf"
  | "wildesKind"
  | "fuchs"
  | "baerenfuehrer"
  | "rabe"
  | "ritter"
  | "engel"
  | "schauspieler";

/** "solo" roles play for themselves: Flötenspieler, Weißer Werwolf, Engel. */
export type Team = "dorf" | "wolf" | "solo";

/** Where a role's rules come from. */
export type Source = "grundspiel" | "neumond" | "charaktere";

/** 3 players: short round, 4 players: fixed small variant, 5+: normal game. */
export type Mode = "kurz" | "vier" | "normal";

export type Phase =
  | "lobby"
  | "roles"
  | "night"
  | "announce"
  | "hunter"
  | "succession"
  | "scapegoat"
  | "election"
  | "discussion"
  | "vote"
  | "ended";

/** The night runs in these steps, in this order; steps without a task are skipped. */
export type NightStep = "dieb" | "erwachen" | "haupt" | "rudel" | "hexe";

export type TaskId =
  | "dieb"
  | "amor"
  | "wildesKind"
  | "wolfshund"
  | "wolf"
  | "lurk"
  | "seherin"
  | "beschuetzer"
  | "fuchs"
  | "rabe"
  | "floetenspieler"
  | "schauspieler"
  | "maedchen"
  | "urwolf"
  | "grosserWolf"
  | "weisserWolf"
  | "hexe"
  /** Decoy for players without a task, so phones on a table look alike. */
  | "suspect"
  | "sleep";

export type DeathCause = "wolf" | "gift" | "vote" | "jaeger" | "liebe" | "tetanus" | "suendenbock";

export type Winner = "dorf" | "wolf" | "paar" | "niemand" | "floetenspieler" | "weisserWolf" | "engel";

export interface Player {
  id: string;
  name: string;
  /**
   * sha256 of the player's secret token. Devices that send their own device
   * key use it as the token, so one device can only hold one seat per room.
   * Never leaves the server; empty once the player has left.
   */
  tokenHash: string;
  /** The card the player holds. Changes only through the Dieb. */
  role: RoleId | null;
  alive: boolean;
  /** Joined the pack later: infected, a Wolfshund that chose it, or a Wildes Kind. */
  turned: boolean;
  enchanted: boolean;
  /** A Dorfdepp the village voted out: alive, but without a vote. */
  exposed: boolean;
  /** Left a running game: out for this round, removed when the next one starts. */
  left?: boolean;
}

export interface Settings {
  /** true: roles follow from the number of players. */
  auto: boolean;
  /** Manual choice: how often each role is in the game. */
  counts: Partial<Record<RoleId, number>>;
  /** The village elects a Hauptmann on the first day. */
  captain: boolean;
  /** Players without a night task tap anyway, so nobody stands out at the table. */
  decoy: boolean;
  /** Length of the day discussion in seconds, 0 = no time limit. */
  discussionSeconds: number;
}

export interface Death {
  id: string;
  cause: DeathCause;
}

export interface Announce {
  kind: "morning" | "verdict" | "hunter" | "election" | "succession" | "scapegoat";
  deaths: Death[];
  ballots?: Record<string, string | null>;
  tie?: boolean;
  /** Bärenführer: true when the bear growls, null when there is no bear. */
  growl?: boolean | null;
  /** Players the Rabe marked for today's vote. */
  marked?: string[];
  /** A Dorfdepp the village voted out, who stays alive. */
  exposed?: string | null;
  /** The new Hauptmann. */
  captain?: string | null;
  /** The Ältester died by the village's hand: all village roles lose their abilities. */
  powersLost?: boolean;
  /** Players the Sündenbock allowed to vote tomorrow. */
  voters?: string[];
}

/** Something a player has to do before the game can move on. */
export interface Pending {
  kind: "hunter" | "succession" | "scapegoat";
  who: string;
}

export interface NightState {
  step: NightStep | null;
  /** Steps run so far this night, in order. */
  ran: NightStep[];
  /** Players who finished their part of the current step. */
  done: string[];
  wolfVotes: Record<string, string>;
  victim: string | null;
  infect: boolean;
  bigWolfVictim: string | null;
  whiteWolfVictim: string | null;
  protect: string | null;
  actorProtect: string | null;
  enchant: string[];
  marks: string[];
  girlSpies: boolean;
  witch: { heal: string | null; poison: string | null } | null;
  suspects: Record<string, string>;
}

export interface VoteState {
  kind: "lynch" | "election";
  round: 1 | 2;
  /** Only set in a runoff: the players that may still be voted for. */
  candidates: string[] | null;
  ballots: Record<string, string | null>;
  /** Ballots of the first round, shown during a runoff. */
  previous: Record<string, string | null> | null;
}

/** Private knowledge of one player. */
export type Note =
  | { kind: "seen"; round: number; target: string; role: RoleId; actor?: boolean }
  | { kind: "sniffed"; round: number; targets: string[]; wolf: boolean; actor?: boolean }
  | { kind: "spied"; round: number; wolf: string | null }
  | { kind: "thief"; round: number; took: RoleId | null; center: RoleId[] }
  | { kind: "model"; round: number; target: string }
  | { kind: "dog"; round: number; wolf: boolean }
  | { kind: "turned"; round: number; why: "infected" | "model" | "dog" }
  | { kind: "infected"; round: number; target: string }
  | { kind: "protected"; round: number; target: string; actor?: boolean }
  | { kind: "marked"; round: number; target: string; actor?: boolean }
  | { kind: "enchanted"; round: number; targets: string[] };

export interface HistoryEntry {
  round: number;
  /** false: the night of that round, true: the day after it. */
  day: boolean;
  text: string;
  /** Only shown once the game is over. */
  secret: boolean;
}

export interface RejoinRequest {
  id: string;
  playerId: string;
  tokenHash: string;
  at: number;
}

export interface GameState {
  rev: number;
  code: string;
  hostId: string;
  createdAt: number;
  players: Player[];
  settings: Settings;
  phase: Phase;
  mode: Mode;
  /** Night number; the day after night n is day n. Day 0 exists only with the Engel. */
  round: number;
  /** Players that confirmed the current phase. */
  acks: string[];
  /** Lobby: players who said they are ready. */
  ready: string[];
  /** End of the discussion as epoch milliseconds. */
  deadline: number | null;
  night: NightState;
  /** The two cards left over for the Dieb. */
  center: RoleId[];
  lovers: [string, string] | null;
  wildModel: string | null;
  /** true = potion is still available. */
  potions: { heal: boolean; poison: boolean };
  /** Whom the Beschützer protected last night; not twice in a row. */
  lastProtected: string | null;
  /** Abilities the Schauspieler can still use. */
  actorPowers: RoleId[];
  foxActive: boolean;
  infectionUsed: boolean;
  /** A member of the pack has died; the Großer böser Wolf stops hunting twice. */
  packLost: boolean;
  /** The Ältester survives the first attack of the wolves. */
  elderShield: boolean;
  /** The Ältester was killed by the village: village roles have lost their abilities. */
  powersLost: boolean;
  /** Wolf who caught tetanus from the Ritter and dies at the end of the next night. */
  tetanus: string | null;
  /** The Engel wins if he dies before this turns false (after the first night). */
  angelChance: boolean;
  /** Rabe marks for the coming vote. */
  marks: string[];
  captain: string | null;
  captainElected: boolean;
  /** Sündenbock's choice: only these may vote at the next vote. */
  voters: string[] | null;
  pending: Pending[];
  /** Where the game goes once the announcements and pending choices are done. */
  after: "day" | "night" | "discussion";
  vote: VoteState;
  announce: Announce | null;
  winner: Winner | null;
  winners: string[];
  notes: Record<string, Note[]>;
  history: HistoryEntry[];
  suspicions: { round: number; by: string; target: string }[];
  rejoins: RejoinRequest[];
  /** Last action id per player, so a repeated request is not applied twice. */
  handled: Record<string, string>;
}

/** What a player sends. Night tasks share one action shape. */
export type Action =
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "kick"; target: string }
  | { type: "leave" }
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "ack" }
  | {
      type: "night";
      task: TaskId;
      targets?: string[];
      option?: string | null;
      heal?: string | null;
      poison?: string | null;
    }
  | { type: "vote"; target: string | null }
  | { type: "choose"; targets: string[] }
  | { type: "tick" }
  | { type: "force" }
  | { type: "abort" }
  | { type: "again" }
  | { type: "rejoin"; request: string; accept: boolean };

/** One thing a player is asked to do at night, as the page shows it. */
export interface Task {
  id: TaskId;
  /** Players that may be picked. */
  targets: string[];
  /** How many players to pick. */
  count: [number, number];
  /** Choices that are not players, e.g. the Dieb's cards. */
  options: { id: string; label: string; role?: RoleId }[];
  /** Whether the player may do nothing. */
  mayPass: boolean;
  done: boolean;
  /** Pack only: whom each member of the pack picked. */
  wolfVotes?: Record<string, string>;
  /** Hexe only: who was attacked tonight. */
  attacked?: string[];
  /** Hexe only. */
  potions?: { heal: boolean; poison: boolean };
  /** Urwolf only: the victim that could be infected. */
  victim?: string | null;
  /** Beschützer only: may not protect this player again. */
  blocked?: string | null;
  /** Earlier pick, if the task can still be changed. */
  pick?: string[];
}

/** What a single player is allowed to see. */
export interface PublicPlayer {
  id: string;
  name: string;
  alive: boolean;
  host: boolean;
  online: boolean;
  ready: boolean;
  /** Only set when this viewer may know it. */
  role: RoleId | null;
  /** Member of the pack, only shown to the pack and after the game. */
  pack: boolean;
  enchanted: boolean;
  lover: boolean;
  captain: boolean;
  exposed: boolean;
  /** Left the game; counts as out. */
  left: boolean;
  /** Finished the current phase. Hidden at night so nobody is exposed. */
  done: boolean;
}

export interface View {
  code: string;
  phase: Phase;
  /** In the lobby: whether starting now would give a short round. */
  short: boolean;
  round: number;
  step: NightStep | null;
  /** The current night step is the first one of the night. */
  firstStep: boolean;
  now: number;
  deadline: number | null;
  me: {
    id: string;
    role: RoleId | null;
    team: Team | null;
    alive: boolean;
    host: boolean;
    loverId: string | null;
    pack: boolean;
    enchanted: boolean;
    exposed: boolean;
    canVote: boolean;
    done: boolean;
  };
  players: PublicPlayer[];
  progress: { done: number; total: number };
  setup: {
    auto: boolean;
    counts: Partial<Record<RoleId, number>>;
    captain: boolean;
    decoy: boolean;
    discussionSeconds: number;
    mode: Mode;
    roles: RoleId[] | null;
    error: string | null;
    /** Cards needed: the number of players, plus two with the Dieb. */
    needed: number;
    chosen: number;
    max: number;
  };
  /** Roles in this game (known to everybody, like the open card set). */
  inPlay: RoleId[];
  lovers: [string, string] | null;
  tasks: Task[];
  notes: Note[];
  potions: { heal: boolean; poison: boolean } | null;
  actorPowers: RoleId[] | null;
  neighbours: string[] | null;
  announce: Announce | null;
  pending: Pending | null;
  captain: string | null;
  powersLost: boolean;
  vote: {
    kind: "lynch" | "election";
    round: 1 | 2;
    candidates: string[] | null;
    voted: string[];
    myBallot: string | null | undefined;
    previous: Record<string, string | null> | null;
    marked: string[];
  } | null;
  rejoins: { id: string; name: string }[];
  history: HistoryEntry[];
  ended: {
    winner: Winner;
    winners: string[];
    noses: { id: string; hits: number; total: number }[];
    center: RoleId[];
  } | null;
}
