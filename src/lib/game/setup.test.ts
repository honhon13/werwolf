import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, newGame, normalize } from "./engine";
import { autoRoles, cards, composition, countsOf, deal, MAX_PLAYERS, problem, ROLES } from "./roles";
import { ctx, fails, seeded, see } from "./test-helpers";
import type { GameState, RoleId, Settings } from "./types";

const settings = (patch: Partial<Settings> = {}): Settings => ({
  auto: true,
  counts: {},
  captain: false,
  decoy: true,
  discussionSeconds: 180,
  ...patch,
});

function lobby(n: number): GameState {
  let s = newGame("TEST", 0);
  for (let i = 0; i < n; i++) s = addPlayer(s, { id: `p${i}`, name: `P${i}`, tokenHash: `t${i}` });
  return s;
}

describe("automatic roles", () => {
  it("give every player count from 5 to 18 a valid, balanced set", () => {
    for (let n = 5; n <= MAX_PLAYERS; n++) {
      const roles = autoRoles(n);
      expect(roles).toHaveLength(n);
      expect(problem(n, roles)).toBeNull();
      const wolves = roles.filter((r) => ROLES[r].hunts).length;
      expect(wolves).toBeGreaterThanOrEqual(1);
      expect(wolves * 2).toBeLessThan(n);
      expect(wolves * 3.5).toBeLessThanOrEqual(n + 1);
    }
  });

  it("suggest a set for three and four players, which the host may replace", () => {
    expect(composition(3, settings()).roles).toEqual(["werwolf", "seherin", "dorfbewohner"]);
    expect(composition(4, settings()).roles).toEqual(["werwolf", "seherin", "beschuetzer", "dorfbewohner"]);
    const own = settings({ auto: false, counts: { werwolf: 1, hexe: 1, amor: 1 } });
    expect(composition(3, own)).toEqual({ roles: ["werwolf", "amor", "hexe"], error: null });
    expect(composition(4, own).error).toMatch(/3 Karten, gebraucht werden 4/);
    expect(composition(2, settings()).error).toMatch(/mindestens 3/);
    expect(composition(19, settings()).error).toMatch(/höchstens 18/);
  });
});

describe("manual roles", () => {
  const check = (n: number, counts: Partial<Record<RoleId, number>>) =>
    composition(n, settings({ auto: false, counts })).error;

  it("must add up to exactly the number of players, two more with the Dieb", () => {
    expect(check(6, { werwolf: 1, seherin: 1, dorfbewohner: 3 })).toMatch(/5 Karten, gebraucht werden 6/);
    expect(check(6, { werwolf: 1, seherin: 1, dorfbewohner: 4 })).toBeNull();
    expect(check(6, { werwolf: 1, dieb: 1, dorfbewohner: 4 })).toMatch(/gebraucht werden 8/);
    expect(check(6, { werwolf: 1, dieb: 1, dorfbewohner: 6 })).toBeNull();
  });

  it("allows unique roles only once and always needs a Werwolf", () => {
    expect(check(6, { werwolf: 1, seherin: 2, dorfbewohner: 3 })).toMatch(/Seherin darf nur einmal/);
    expect(check(6, { weisserWolf: 1, dorfbewohner: 5 })).toMatch(/mindestens einen Werwolf/);
    expect(check(6, { urwolf: 1, dorfbewohner: 5 })).toMatch(/mindestens einen Werwolf/);
    expect(check(6, { werwolf: 1, urwolf: 1, dorfbewohner: 4 })).toBeNull();
    expect(check(9, { werwolf: 3, dorfbewohner: 6 })).toBeNull();
  });

  it("checks three and four players like any game, and keeps out roles that need more", () => {
    expect(check(3, { werwolf: 1, dorfbewohner: 2 })).toBeNull();
    expect(check(3, { werwolf: 1, dieb: 1, dorfbewohner: 3 })).toBeNull();
    expect(check(4, { werwolf: 1, jaeger: 1, amor: 1, dorfbewohner: 1 })).toBeNull();
    expect(check(3, { seherin: 1, dorfbewohner: 2 })).toMatch(/mindestens einen Werwolf/);
    expect(check(3, { werwolf: 2, dorfbewohner: 1 })).toMatch(/Zu viele Wölfe/);
    expect(check(4, { werwolf: 2, dorfbewohner: 2 })).toMatch(/Zu viele Wölfe/);
    expect(check(4, { werwolf: 1, floetenspieler: 1, dorfbewohner: 2 })).toMatch(/Der Flötenspieler braucht mindestens 5/);
    expect(check(3, { werwolf: 1, wolfshund: 1, dorfbewohner: 1 })).toMatch(/Der Wolfshund braucht mindestens 5/);
    expect(check(5, { werwolf: 1, floetenspieler: 1, wolfshund: 1, dorfbewohner: 2 })).toBeNull();
  });

  it("refuses a set where the wolves would win from the start", () => {
    expect(check(6, { werwolf: 3, dorfbewohner: 3 })).toMatch(/Zu viele Wölfe/);
    expect(check(6, { werwolf: 2, weisserWolf: 1, dorfbewohner: 3 })).toMatch(/Zu viele Wölfe/);
    expect(check(7, { werwolf: 3, dorfbewohner: 4 })).toBeNull();
  });

  it("starts from the automatic set when the host switches to manual", () => {
    let s = lobby(7);
    s = applyAction(s, "p0", { type: "settings", settings: { auto: false } }, ctx());
    expect(cards(s.settings.counts)).toEqual(expect.arrayContaining(autoRoles(7)));
    expect(see(s, "p0").setup).toMatchObject({ chosen: 7, needed: 7, error: null });
    const counts = { ...s.settings.counts, dieb: 1 };
    s = applyAction(s, "p0", { type: "settings", settings: { counts } }, ctx());
    expect(see(s, "p0").setup).toMatchObject({ chosen: 8, needed: 9 });
    fails(() => applyAction(s, "p1", { type: "settings", settings: { captain: true } }, ctx()), /Spielleitung/);
  });

  it("starts from the suggestion with three players and deals the host's own choice", () => {
    let s = lobby(3);
    s = applyAction(s, "p0", { type: "settings", settings: { auto: false } }, ctx());
    expect(s.settings.counts).toEqual({ werwolf: 1, seherin: 1, dorfbewohner: 1 });
    const counts = { werwolf: 1, hexe: 1, dorfbewohner: 1 };
    s = applyAction(s, "p0", { type: "settings", settings: { counts } }, ctx());
    s = applyAction(s, "p0", { type: "start" }, ctx(seeded(4)));
    expect(s.mode).toBe("kurz");
    expect(s.players.map((p) => p.role).sort()).toEqual(["dorfbewohner", "hexe", "werwolf"]);
  });

  it("refuses a choice without a Werwolf, and to start one that does not add up", () => {
    let s = lobby(4);
    fails(() => applyAction(s, "p0", { type: "settings", settings: { auto: false, counts: { seherin: 1, dorfbewohner: 3 } } }, ctx()), /Mindestens ein Werwolf/);
    s = applyAction(s, "p0", { type: "settings", settings: { auto: false, counts: { werwolf: 1, dorfbewohner: 2 } } }, ctx());
    expect(see(s, "p0").setup).toMatchObject({ roles: null, chosen: 3, needed: 4, error: "Gewählt sind 3 Karten, gebraucht werden 4." });
    fails(() => applyAction(s, "p0", { type: "start" }, ctx()), /gebraucht werden 4/);
  });

  it("never takes more cards than places, two more with the Dieb", () => {
    const set = (s: GameState, counts: Partial<Record<RoleId, number>>) =>
      applyAction(s, "p0", { type: "settings", settings: { auto: false, counts } }, ctx());
    let s = set(lobby(5), { werwolf: 1, seherin: 1, dorfbewohner: 3 });
    fails(() => set(s, { werwolf: 1, seherin: 1, dorfbewohner: 4 }), /nur 5 Plätze/);
    fails(() => set(s, { werwolf: 1, seherin: 1, hexe: 1, dorfbewohner: 3 }), /nur 5 Plätze/);
    // The Dieb brings two more places with him.
    s = set(s, { werwolf: 1, seherin: 1, dieb: 1, dorfbewohner: 3 });
    s = set(s, { werwolf: 1, seherin: 1, dieb: 1, dorfbewohner: 4 });
    fails(() => set(s, { werwolf: 1, seherin: 1, dieb: 1, dorfbewohner: 5 }), /nur 7 Plätze/);
    // Without him the cards would be too many again.
    fails(() => set(s, { werwolf: 1, seherin: 1, dorfbewohner: 4 }), /nur 5 Plätze/);
    expect(applyAction(s, "p0", { type: "start" }, ctx(seeded(2))).phase).toBe("roles");
  });

  it("starts with as many cards as players when switching to manual", () => {
    for (const n of [1, 2, 3, 6]) {
      const s = applyAction(lobby(n), "p0", { type: "settings", settings: { auto: false } }, ctx());
      expect(cards(s.settings.counts)).toHaveLength(n);
      expect(s.settings.counts.werwolf).toBeGreaterThanOrEqual(1);
    }
  });

  it("checks the choice again whenever players come or go", () => {
    let s = lobby(6);
    s = applyAction(s, "p0", { type: "settings", settings: { auto: false } }, ctx());
    expect(see(s, "p0").setup).toMatchObject({ chosen: 6, needed: 6, error: null });
    // Somebody leaves: one card too many, the start waits.
    s = applyAction(s, "p5", { type: "leave" }, ctx());
    expect(see(s, "p0").setup).toMatchObject({ chosen: 6, needed: 5, roles: null });
    fails(() => applyAction(s, "p0", { type: "start" }, ctx()), /gebraucht werden 5/);
    // Adding is refused, taking one out is fine.
    const counts = s.settings.counts;
    fails(() => applyAction(s, "p0", { type: "settings", settings: { counts: { ...counts, dorfbewohner: 2 } } }, ctx()), /nur 5 Plätze/);
    s = applyAction(s, "p0", { type: "settings", settings: { counts: { ...counts, hexe: 0 } } }, ctx());
    expect(see(s, "p0").setup).toMatchObject({ chosen: 5, needed: 5, error: null });
    // Somebody joins: a place is free again, and the start waits for it.
    s = addPlayer(s, { id: "p9", name: "Neu", tokenHash: "t9" });
    expect(see(s, "p0").setup).toMatchObject({ chosen: 5, needed: 6, roles: null });
    s = applyAction(s, "p0", { type: "settings", settings: { counts: { ...s.settings.counts, hexe: 1 } } }, ctx());
    expect(applyAction(s, "p0", { type: "start" }, ctx(seeded(5))).players.every((p) => p.role !== null)).toBe(true);
  });
});

describe("dealing", () => {
  it("keeps two cards back for the Dieb and always hands out a wolf", () => {
    const roles: RoleId[] = ["dieb", "werwolf", "seherin", "dorfbewohner", "dorfbewohner", "dorfbewohner", "dorfbewohner"];
    for (let seed = 0; seed < 300; seed++) {
      const { hands, center } = deal(roles, 5, seeded(seed));
      expect(hands).toHaveLength(5);
      expect(center).toHaveLength(2);
      expect(hands).toContain("werwolf");
    }
  });

  it("deals every card once and tells the host nothing about the others", () => {
    let s = lobby(9);
    s = applyAction(s, "p0", { type: "start" }, ctx(seeded(3)));
    expect(s.phase).toBe("roles");
    expect(s.players.map((p) => p.role).sort()).toEqual([...autoRoles(9)].sort());
    const host = see(s, "p0");
    expect(host.players.filter((p) => p.id !== "p0").every((p) => p.role === null && !p.pack)).toBe(true);
    // Who got which card is logged for the end, but not shown before.
    expect(s.history.filter((h) => h.secret && h.text.includes(" ist "))).toHaveLength(9);
    expect(host.history.every((h) => !h.text.includes(" ist "))).toBe(true);
  });

  it("hands out exactly the chosen cards, one to each player, in a new order every time", () => {
    const counts = { werwolf: 2, seherin: 1, hexe: 1, jaeger: 1, dorfbewohner: 2 };
    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      let s = applyAction(lobby(7), "p0", { type: "settings", settings: { auto: false, counts } }, ctx());
      s = applyAction(s, "p0", { type: "start" }, ctx(seeded(seed)));
      const hands = s.players.map((p) => p.role!);
      expect(countsOf(hands)).toEqual(counts);
      orders.add(hands.join());
    }
    expect(orders.size).toBeGreaterThan(10);
  });

  it("deals again from scratch when a new round starts in the same room", () => {
    let s = applyAction(lobby(6), "p0", { type: "start" }, ctx(seeded(1)));
    const first = s.players.map((p) => p.role).join();
    s = applyAction(s, "p0", { type: "abort" }, ctx());
    expect(s.phase).toBe("lobby");
    expect(s.players.every((p) => p.role === null && p.alive && !p.turned && !p.enchanted && !p.exposed)).toBe(true);
    expect(s).toMatchObject({ round: 0, center: [], lovers: null, captain: null, notes: {}, history: [], winner: null });
    const rounds = new Set([first]);
    for (let seed = 2; seed <= 6; seed++) {
      const next = applyAction(s, "p0", { type: "start" }, ctx(seeded(seed)));
      expect(countsOf(next.players.map((p) => p.role!))).toEqual(countsOf(autoRoles(6)));
      rounds.add(next.players.map((p) => p.role).join());
    }
    expect(rounds.size).toBeGreaterThan(1);
  });

  it("lets 3 to 18 players start and nobody more join", () => {
    for (const n of [3, 4, 5, 12, 18]) {
      const s = applyAction(lobby(n), "p0", { type: "start" }, ctx(seeded(n)));
      expect(s.mode).toBe(n === 3 ? "kurz" : n === 4 ? "vier" : "normal");
    }
    fails(() => addPlayer(lobby(18), { id: "x", name: "Neunzehn", tokenHash: "t19" }), /voll/);
    fails(() => applyAction(lobby(2), "p0", { type: "start" }, ctx()), /mindestens 3/);
  });
});

describe("lobby", () => {
  it("shows who is ready", () => {
    let s = lobby(4);
    s = applyAction(s, "p2", { type: "ready", ready: true }, ctx());
    expect(see(s, "p0").players.map((p) => p.ready)).toEqual([false, false, true, false]);
    s = applyAction(s, "p2", { type: "ready", ready: false }, ctx());
    expect(see(s, "p0").players.some((p) => p.ready)).toBe(false);
  });

  it("brings rooms from before the role system back to the lobby", () => {
    const old = {
      code: "ABCD",
      createdAt: 5,
      hostId: "a",
      players: [{ id: "a", name: "Anna", tokenHash: "h", role: "werwolf", alive: false }],
      settings: { auto: false, custom: { wolves: 2, seherin: true, hexe: false }, discussionSeconds: 120 },
      phase: "night",
    } as unknown as GameState;
    const s = normalize(old);
    expect(s).toMatchObject({ phase: "lobby", hostId: "a", rev: 2 });
    expect(s.players[0]).toMatchObject({ id: "a", name: "Anna", role: null, alive: true });
    expect(s.settings).toMatchObject({ auto: false, discussionSeconds: 120, counts: { werwolf: 2, seherin: 1 } });
  });
});
