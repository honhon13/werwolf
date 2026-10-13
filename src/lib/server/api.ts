import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { GameError } from "../game/engine";
import type { GameState, Player, View } from "../game/types";
import { viewFor } from "../game/view";
import { RoomNotFound, type Room } from "./store";

/** No vowels, so a random code never spells a word. */
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const CODE_LENGTH = 4;
/** A player counts as online for this many seconds after the last poll. */
const ONLINE_FOR = 12;
/** The room is handed to someone else when the host was away this long. */
export const HOST_AWAY_AFTER = 45;

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const rng = () => randomInt(0x100000000) / 0x100000000;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

export function newCredentials() {
  const token = randomBytes(24).toString("base64url");
  return { id: randomBytes(6).toString("base64url"), token, tokenHash: hashToken(token) };
}

export interface Credentials {
  id: string;
  tokenHash: string;
}

/** Reads "Authorization: Bearer <playerId>.<token>". */
export function credentialsFrom(request: Request): Credentials | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([\w-]{1,32})\.([\w-]{1,128})$/.exec(header);
  return match ? { id: match[1], tokenHash: hashToken(match[2]) } : null;
}

export class NotMember extends Error {}

export function member(state: GameState, creds: Credentials | null): Player | null {
  if (!creds) return null;
  const player = state.players.find((p) => p.id === creds.id);
  if (!player) return null;
  const a = Buffer.from(player.tokenHash);
  const b = Buffer.from(creds.tokenHash);
  return a.length === b.length && timingSafeEqual(a, b) ? player : null;
}

export function onlineIds(room: Room, now: number, alsoOnline?: string): Set<string> {
  const online = new Set(
    Object.entries(room.seen)
      .filter(([, at]) => at >= now - ONLINE_FOR)
      .map(([id]) => id),
  );
  if (alsoOnline) online.add(alsoOnline);
  return online;
}

export interface MemberResponse {
  member: true;
  v: number;
  online: string[];
  /** Left out when the client already has this version. */
  view?: View;
}

export interface GuestResponse {
  member: false;
  phase: GameState["phase"];
  players: string[];
}

export function memberResponse(room: Room, playerId: string, knownVersion?: number): MemberResponse {
  const online = onlineIds(room, nowSeconds(), playerId);
  const body: MemberResponse = { member: true, v: room.version, online: [...online] };
  if (knownVersion !== room.version) {
    body.view = viewFor(room.state, playerId, { now: Date.now(), online }) ?? undefined;
  }
  return body;
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const fail = (message: string, status: number) => json({ error: message }, status);

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

/** Turns the errors a handler may throw into the matching response. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof GameError) return fail(e.message, 400);
    if (e instanceof RoomNotFound) return fail("Diesen Raum gibt es nicht (mehr).", 404);
    if (e instanceof NotMember) return fail("Du bist nicht in diesem Raum.", 401);
    console.error(e);
    return fail("Da ist etwas schiefgelaufen. Versuch es gleich noch einmal.", 500);
  }
}
