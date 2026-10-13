export type RoleId =
  | "werwolf"
  | "dorfbewohner"
  | "seherin"
  | "hexe"
  | "jaeger"
  | "amor";

export type Team = "dorf" | "wolf";

export type Phase =
  | "lobby"
  | "roles"
  | "night"
  | "witch"
  | "announce"
  | "hunter"
  | "discussion"
  | "vote"
  | "ended";

export type DeathCause = "wolf" | "gift" | "vote" | "jaeger" | "liebe";
export type Winner = "dorf" | "wolf" | "paar" | "niemand";
export type NightTask = "wolf" | "seer" | "amor" | "suspect";

export interface Player {
  id: string;
  name: string;
  /** sha256 of the player's secret token. Never leaves the server. */
  tokenHash: string;
  role: RoleId | null;
  alive: boolean;
}

export interface RoleSetup {
  wolves: number;
  seherin: boolean;
  hexe: boolean;
  jaeger: boolean;
  amor: boolean;
}

export interface Settings {
  /** true: roles are chosen automatically from the number of players. */
  auto: boolean;
  custom: RoleSetup;
  /** Length of the day discussion in seconds, 0 = no time limit. */
  discussionSeconds: number;
}

export interface Death {
  id: string;
  cause: DeathCause;
}

export interface Announce {
  kind: "morning" | "verdict" | "hunter";
  deaths: Death[];
  next: "discussion" | "night";
  /** Ballots of the vote that led to a verdict. */
  ballots?: Record<string, string | null>;
  tie?: boolean;
}

export interface NightState {
  wolfVotes: Record<string, string>;
  victim: string | null;
  seerDone: boolean;
  amorDone: boolean;
  /** Answers of everyone without a night action, so that all players tap. */
  suspects: Record<string, string>;
  witch: { heal: boolean; poison: string | null } | null;
}

export interface VoteState {
  round: 1 | 2;
  /** Only set in a runoff: the players that may still be voted for. */
  candidates: string[] | null;
  ballots: Record<string, string | null>;
  /** Ballots of the first round, shown during a runoff. */
  previous: Record<string, string | null> | null;
}

export interface GameState {
  code: string;
  hostId: string;
  createdAt: number;
  players: Player[];
  settings: Settings;
  phase: Phase;
  /** Number of the current night, 0 while in the lobby. */
  round: number;
  /** Players that confirmed the current phase. */
  acks: string[];
  /** End of the discussion as epoch milliseconds. */
  deadline: number | null;
  night: NightState;
  lovers: [string, string] | null;
  /** true = potion is still available. */
  potions: { heal: boolean; poison: boolean };
  seerLog: { round: number; target: string; role: RoleId }[];
  /** Dead hunter who still has to fire the last shot. */
  hunterPending: string | null;
  vote: VoteState;
  announce: Announce | null;
  winner: Winner | null;
  suspicions: { round: number; by: string; target: string }[];
}

export type Action =
  | { type: "settings"; settings: Partial<Omit<Settings, "custom">> & { custom?: Partial<RoleSetup> } }
  | { type: "kick"; target: string }
  | { type: "leave" }
  | { type: "start" }
  | { type: "ack" }
  | { type: "wolfVote"; target: string }
  | { type: "seerPeek"; target: string }
  | { type: "amorPick"; a: string; b: string }
  | { type: "suspect"; target: string }
  | { type: "witch"; heal: boolean; poison: string | null }
  | { type: "hunterShoot"; target: string }
  | { type: "vote"; target: string | null }
  | { type: "tick" }
  | { type: "force" }
  | { type: "abort" }
  | { type: "again" };

/** What a single player is allowed to see. */
export interface PublicPlayer {
  id: string;
  name: string;
  alive: boolean;
  host: boolean;
  online: boolean;
  /** Only set when this viewer may know it. */
  role: RoleId | null;
  /** Finished the current phase. Hidden at night so nobody is exposed. */
  done: boolean;
}

export interface View {
  code: string;
  phase: Phase;
  round: number;
  now: number;
  deadline: number | null;
  me: {
    id: string;
    name: string;
    role: RoleId | null;
    alive: boolean;
    host: boolean;
    loverId: string | null;
    done: boolean;
  };
  players: PublicPlayer[];
  progress: { done: number; total: number };
  setup: {
    auto: boolean;
    custom: RoleSetup;
    discussionSeconds: number;
    roles: RoleId[] | null;
    error: string | null;
    min: number;
    max: number;
  };
  /** Roles that are in this game (known to everybody, like the open card set). */
  inPlay: RoleId[];
  lovers: [string, string] | null;
  night: {
    task: NightTask;
    pick: string | null;
    wolfVotes: Record<string, string> | null;
    amorPicked: boolean;
  } | null;
  witch: {
    isWitch: boolean;
    victim: string | null;
    canHeal: boolean;
    canPoison: boolean;
  } | null;
  potions: { heal: boolean; poison: boolean } | null;
  seerLog: { round: number; target: string; role: RoleId }[] | null;
  announce: Announce | null;
  hunterId: string | null;
  vote: {
    round: 1 | 2;
    candidates: string[] | null;
    voted: string[];
    myBallot: string | null | undefined;
    previous: Record<string, string | null> | null;
  } | null;
  ended: {
    winner: Winner;
    noses: { id: string; hits: number; total: number }[];
  } | null;
}
