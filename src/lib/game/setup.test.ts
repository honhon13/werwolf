import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, newGame, normalize } from "./engine";
import { autoRoles, cards, composition, deal, MAX_PLAYERS, problem, ROLES } from "./roles";
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
  for (let i = 0; i < n; i++) s = addPlayer(s, { id: `p${i}`, name: `P${i}`, tokenHash: "x" });
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

  it("use the fixed variants for three and four players, whatever the settings", () => {
    const manual = settings({ auto: false, counts: { werwolf: 2, hexe: 1, amor: 1 } });
    expect(composition(3, manual).roles).toEqual(["werwolf", "seherin", "dorfbewohner"]);
    expect(composition(4, manual).roles).toEqual(["werwolf", "seherin", "beschuetzer", "dorfbewohner"]);
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

  it("allows unique roles only once and needs a hunting wolf", () => {
    expect(check(6, { werwolf: 1, seherin: 2, dorfbewohner: 3 })).toMatch(/Seherin darf nur einmal/);
    expect(check(6, { weisserWolf: 1, dorfbewohner: 5 })).toMatch(/mindestens einen Werwolf/);
    expect(check(6, { urwolf: 1, dorfbewohner: 5 })).toBeNull();
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

  it("lets 3 to 18 players start and nobody more join", () => {
    for (const n of [3, 4, 5, 12, 18]) {
      const s = applyAction(lobby(n), "p0", { type: "start" }, ctx(seeded(n)));
      expect(s.mode).toBe(n === 3 ? "kurz" : n === 4 ? "vier" : "normal");
    }
    fails(() => addPlayer(lobby(18), { id: "x", name: "Neunzehn", tokenHash: "x" }), /voll/);
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
