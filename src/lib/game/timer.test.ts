import { describe, expect, it } from "vitest";
import { applyAction, expireIfDue, isOverdue } from "./engine";
import { DECISION_MS, GRACE_MS, ROLE_ORDER } from "./roles";
import { ackAll, act, ctx, fails, game, night, seeded, see, timeUp, toVote, votes } from "./test-helpers";
import type { Action, GameState, RoleId } from "./types";

const D = "dorfbewohner" as const;
/** The moment the decision time of this state is over, grace included. */
const over = (s: GameState) => s.deadline! + GRACE_MS;
const expire = (s: GameState, rng = seeded(1)) => expireIfDue(s, ctx(rng, over(s)));
const at = (s: GameState, id: string, action: Action, now: number) => applyAction(s, id, action, ctx(undefined, now));

describe("decision time", () => {
  it("gives every decision 20 seconds on the server's clock", () => {
    let s = game(["werwolf", "seherin", D, D, D], { captain: true });
    expect(s.phase).toBe("night");
    expect(s.deadline).toBe(1000 + DECISION_MS);
    expect(see(s, "p2")).toMatchObject({ now: 0, deadline: 1000 + DECISION_MS });
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    expect(s.phase).toBe("announce");
    expect(s.deadline).toBeNull();
    s = ackAll(s);
    expect(s).toMatchObject({ phase: "election", deadline: 1000 + DECISION_MS });
  });

  it("waits until the time and a second of grace are over", () => {
    const s = game(["werwolf", "seherin", D, D, D]);
    expect(isOverdue(s, s.deadline!)).toBe(false);
    expect(expireIfDue(s, ctx(undefined, s.deadline! + GRACE_MS - 1))).toBe(s);
    // A decision sent at the last moment still counts.
    const late = at(s, "p1", { type: "night", task: "seherin", targets: ["p0"] }, s.deadline! + 500);
    expect(late.notes.p1).toHaveLength(1);
    fails(() => at(s, "p1", { type: "night", task: "seherin", targets: ["p0"] }, over(s)), /Zu spät/);
  });

  it("moves on at once when everybody has decided", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    expect(s.phase).toBe("announce");
  });

  it("decides for whoever did not, and keeps what the others chose", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = expire(s);
    expect(s.phase).toBe("announce");
    expect(s.announce?.deaths).toEqual([{ id: "p4", cause: "wolf" }]);
    // The Seherin looked at somebody else at random.
    const seen = s.notes.p1?.[0];
    expect(seen?.kind).toBe("seen");
    expect(seen && "target" in seen && seen.target).not.toBe("p1");
  });

  it("lets the pack attack somebody even if no wolf chose", () => {
    let s = game(["werwolf", "werwolf", "seherin", D, D, D, D]);
    s = night(s, "p2", "seherin", { targets: ["p0"] });
    s = expire(s);
    const deaths = s.announce!.deaths;
    expect(deaths).toHaveLength(1);
    expect(["p0", "p1"]).not.toContain(deaths[0].id);
  });

  it("never uses an optional power by chance", () => {
    let s = game(["werwolf", "hexe", "rabe", "urwolf", "maedchen", "schauspieler", D, D, D, D]);
    while (s.phase === "night") s = expire(s);
    expect(s.potions).toEqual({ heal: true, poison: true });
    expect(s.infectionUsed).toBe(false);
    expect(s.marks).toEqual([]);
    expect(s.actorPowers).toHaveLength(3);
    expect(s.notes.p4 ?? []).toEqual([]);
  });

  it("lets the Jäger shoot at random when he does not", () => {
    let s = game(["werwolf", "jaeger", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = ackAll(s);
    expect(s).toMatchObject({ phase: "hunter", deadline: 1000 + DECISION_MS });
    s = expire(s);
    expect(s.announce?.kind).toBe("hunter");
    expect(s.announce?.deaths).toHaveLength(1);
    expect(s.announce?.deaths[0].id).not.toBe("p1");
  });

  it("names a Hauptmann at random and lets everybody vote after the Sündenbock", () => {
    let s = game(["werwolf", "suendenbock", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p2", p1: "p3", p2: "p3", p3: "p2" });
    s = ackAll(s);
    expect(s.phase).toBe("scapegoat");
    s = expire(s);
    expect(s.announce).toMatchObject({ kind: "scapegoat", voters: ["p0", "p2", "p3"] });

    let c = game(["werwolf", "seherin", D, D, D, D], { captain: true });
    c = night(c, "p0", "wolf", { targets: ["p5"] });
    c = night(c, "p1", "seherin", { targets: ["p0"] });
    c = ackAll(c);
    c = votes(c, { p0: "p2", p1: "p2", p2: "p2", p3: "p2", p4: "p2" });
    c = ackAll(ackAll(c));
    c = votes(c, { p0: "p2", p1: "p2", p2: "p0", p3: "p2", p4: "p1" });
    c = ackAll(c);
    expect(c.phase).toBe("succession");
    c = expire(c);
    expect(c.announce?.kind).toBe("succession");
    expect(c.players.find((p) => p.id === c.captain)?.alive).toBe(true);
  });
});

describe("the day: talking and voting at once", () => {
  /** A game in the morning after a quiet night, with this day time. */
  function morning(seconds: number, roles: RoleId[] = ["werwolf", "seherin", D, D, D, D], captain = false) {
    let s = game(roles, { captain });
    s.settings.discussionSeconds = seconds;
    s = night(s, "p0", "wolf", { targets: [`p${roles.length - 1}`] });
    return night(s, "p1", "seherin", { targets: ["p0"] });
  }

  it("lasts as long as the host set, and goes straight from the morning to the vote", () => {
    for (const seconds of [120, 180, 300]) {
      const s = toVote(morning(seconds));
      expect(s).toMatchObject({ phase: "vote", deadline: 1000 + seconds * 1000 });
      expect(see(s, "p2").setup.discussionSeconds).toBe(seconds);
    }
  });

  it("lets votes change until the time is up and then locks them", () => {
    let s = toVote(morning(180));
    s = act(s, "p1", { type: "vote", target: "p2" });
    s = act(s, "p1", { type: "vote", target: "p0" });
    for (const voter of ["p0", "p2", "p3", "p4"]) s = act(s, voter, { type: "vote", target: voter === "p0" ? "p1" : "p0" });
    s = act(s, "p0", { type: "vote", target: "p3" });
    expect(s.vote.ballots).toEqual({ p0: "p3", p1: "p0", p2: "p0", p3: "p0", p4: "p0" });
    fails(() => at(s, "p1", { type: "vote", target: "p3" }, s.deadline! + GRACE_MS), /Zu spät/);
    s = timeUp(s);
    expect(s.announce?.ballots).toEqual({ p0: "p3", p1: "p0", p2: "p0", p3: "p0", p4: "p0" });
  });

  it("counts only when the time is up, even if everybody has voted", () => {
    let s = toVote(morning(120));
    for (const [voter, target] of [["p0", "p1"], ["p1", "p0"], ["p2", "p0"], ["p3", "p0"], ["p4", "p0"]]) {
      s = act(s, voter, { type: "vote", target });
    }
    expect(s.phase).toBe("vote");
    expect(expireIfDue(s, ctx(undefined, s.deadline! + GRACE_MS - 1))).toBe(s);
    s = timeUp(s);
    expect(s.announce?.deaths).toEqual([{ id: "p0", cause: "vote" }]);
  });

  it("gives whoever did not vote a random player they could have chosen", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = toVote(morning(180));
      s = act(s, "p1", { type: "vote", target: "p0" });
      s = timeUp(s, seeded(seed));
      // Random votes may tie; then the first round's ballots are kept for the runoff.
      const ballots = s.announce?.ballots ?? s.vote.previous!;
      expect(Object.keys(ballots).sort()).toEqual(["p0", "p1", "p2", "p3", "p4"]);
      for (const [voter, target] of Object.entries(ballots)) {
        expect(target).not.toBeNull();
        expect(target).not.toBe(voter);
        expect(["p0", "p1", "p2", "p3", "p4"]).toContain(target);
      }
    }
  });

  it("allows only other living players, and no abstaining", () => {
    const s = toVote(morning(180));
    fails(() => act(s, "p1", { type: "vote", target: "p1" }), /nicht stimmen/);
    fails(() => act(s, "p1", { type: "vote", target: "p5" }), /nicht stimmen/);
    fails(() => act(s, "p1", { type: "vote", target: null }), /Wähle einen Mitspieler/);
    fails(() => act(s, "p5", { type: "vote", target: "p0" }), /ausgeschieden/);
  });

  it("keeps the Hauptmann's double vote, also next to random votes", () => {
    let s = morning(180, ["werwolf", "seherin", D, D, D, D], true);
    s = ackAll(s);
    s = votes(s, { p0: "p2", p1: "p2", p2: "p2", p3: "p2", p4: "p2" });
    s = ackAll(s);
    expect(s).toMatchObject({ phase: "vote", captain: "p2" });
    s = act(s, "p2", { type: "vote", target: "p0" });
    s = act(s, "p0", { type: "vote", target: "p1" });
    s = act(s, "p3", { type: "vote", target: "p1" });
    s = act(s, "p1", { type: "vote", target: "p4" });
    s = act(s, "p4", { type: "vote", target: "p3" });
    s = timeUp(s);
    // p0 has the Hauptmann's two votes against p1's two: a tie, so a runoff.
    expect(s.vote).toMatchObject({ round: 2, candidates: ["p0", "p1"] });
  });

  it("gives a runoff 20 seconds, with the same rules", () => {
    let s = toVote(morning(180));
    for (const [voter, target] of [["p0", "p2"], ["p1", "p3"], ["p2", "p3"], ["p3", "p2"], ["p4", "p0"]]) {
      s = act(s, voter, { type: "vote", target });
    }
    s = timeUp(s);
    const started = 1000 + 180_000 + GRACE_MS;
    expect(s.vote).toMatchObject({ round: 2, candidates: ["p2", "p3"] });
    expect(s.deadline).toBe(started + DECISION_MS);
    fails(() => at(s, "p0", { type: "vote", target: "p0" }, started + 10), /nicht stimmen/);
    s = at(s, "p0", { type: "vote", target: "p2" }, started + 10);
    s = timeUp(s, seeded(3));
    expect(Object.values(s.announce!.ballots!).every((t) => t === "p2" || t === "p3")).toBe(true);
  });

  it("counts as soon as everybody has voted when the host chose no time limit", () => {
    let s = toVote(morning(0));
    expect(s.deadline).toBeNull();
    s = act(s, "p1", { type: "vote", target: "p2" });
    s = act(s, "p1", { type: "vote", target: "p0" });
    for (const voter of ["p0", "p2", "p3"]) s = act(s, voter, { type: "vote", target: voter === "p0" ? "p1" : "p0" });
    expect(s.phase).toBe("vote");
    s = act(s, "p4", { type: "vote", target: "p0" });
    expect(s.announce?.deaths).toEqual([{ id: "p0", cause: "vote" }]);
  });

  it("keeps the Hauptmann election final", () => {
    let s = morning(180, ["werwolf", "seherin", D, D, D, D], true);
    s = ackAll(s);
    s = act(s, "p1", { type: "vote", target: "p2" });
    fails(() => act(s, "p1", { type: "vote", target: "p3" }), /schon abgestimmt/);
  });

  it("ends the day only once, however often it is asked", () => {
    let s = toVote(morning(180));
    s = act(s, "p1", { type: "vote", target: "p0" });
    const once = timeUp(s);
    expect(expireIfDue(once, ctx(seeded(9), 1000 + 180_000 + GRACE_MS))).toBe(once);
    expect(at(once, "p2", { type: "tick" }, 1000 + 180_000 + GRACE_MS)).toMatchObject({ phase: once.phase, announce: once.announce });
  });
});

describe("no double or late decisions", () => {
  it("settles a deadline only once, however often it is asked", () => {
    const s = game(["werwolf", "seherin", D, D, D]);
    const once = expire(s);
    expect(expireIfDue(once, ctx(seeded(2), over(s)))).toBe(once);
    const ticked = at(once, "p2", { type: "tick" }, over(s));
    expect(ticked).toMatchObject({ phase: once.phase, round: once.round, deadline: once.deadline });
  });

  it("refuses decisions that arrive after the time is up, also from the last player", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    fails(() => at(s, "p1", { type: "night", task: "seherin", targets: ["p0"] }, over(s) + 5000), /Zu spät/);
    // The automatic choice is made instead, and the night is over.
    expect(expire(s).phase).toBe("announce");
  });

  it("applies the same request twice only once, before and after the deadline", () => {
    const s = game(["werwolf", "seherin", D, D, D]);
    const first = applyAction(s, "p1", { type: "night", task: "seherin", targets: ["p0"] }, ctx(undefined, 5000), "same-id");
    expect(applyAction(first, "p1", { type: "night", task: "seherin", targets: ["p0"] }, ctx(undefined, over(s)), "same-id")).toBe(first);
  });
});

describe("games nobody plays", () => {
  /** Everybody only confirms; every decision is left to the clock. */
  function idle(roles: RoleId[], seed: number, captain: boolean, center: RoleId[] = []) {
    const rng = seeded(seed);
    let s = game(roles, { captain, decoy: seed % 2 === 0, rng, center });
    let steps = 0;
    while (s.phase !== "ended") {
      if (++steps > 500) throw new Error(`stuck in ${s.phase}/${s.night.step}`);
      if (s.phase === "roles" || s.phase === "announce" || s.phase === "discussion") s = ackAll(s, rng);
      else {
        expect(s.deadline).not.toBeNull();
        s = expireIfDue(s, ctx(rng, over(s)));
      }
    }
    return s;
  }

  it("still run to the end, with every role and only valid choices", () => {
    const specials = ROLE_ORDER.filter((r) => r !== "dorfbewohner" && r !== "werwolf" && r !== "dieb");
    const used = new Set<RoleId>();
    for (let seed = 1; seed <= 40; seed++) {
      const extra = specials.filter((_, i) => (i + seed) % 4 === 0);
      const roles: RoleId[] = ["werwolf", "werwolf", ...extra, D, D, D];
      const s = idle(roles, seed, seed % 3 === 0);
      expect(s.winner).not.toBeNull();
      for (const r of roles) used.add(r);
    }
    expect(specials.filter((r) => !used.has(r))).toEqual([]);
  });

  it("let the Dieb take a card at random, and a wolf card when both are wolves", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const both = seed % 2 === 0;
      const center: RoleId[] = both ? ["werwolf", "werwolf"] : ["seherin", D];
      const rng = seeded(seed);
      let s = game(["dieb", "werwolf", D, D, D, D], { center, rng });
      expect(s.night.step).toBe("dieb");
      s = expireIfDue(s, ctx(rng, over(s)));
      const thief = s.notes.p0?.[0];
      expect(thief?.kind).toBe("thief");
      if (both) expect(s.players[0].role).toBe("werwolf");
      expect(idle(["dieb", "werwolf", D, D, D, D], seed, false, center).winner).not.toBeNull();
    }
  });
});
