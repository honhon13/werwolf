import { describe, expect, it } from "vitest";
import { checkWinner } from "./win";
import { ackAll, act, alive, fails, game, night, see, tasks, toVote, votes } from "./test-helpers";

const D = "dorfbewohner" as const;

describe("Werwolf", () => {
  it("needs the whole pack to agree, and never attacks a wolf", () => {
    let s = game(["werwolf", "werwolf", D, D, D]);
    expect(s.night.step).toBe("haupt");
    fails(() => night(s, "p0", "wolf", { targets: ["p1"] }), /Wölfe greifen keine Wölfe/);
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    s = night(s, "p1", "wolf", { targets: ["p3"] });
    expect(s.phase).toBe("night");
    s = night(s, "p1", "wolf", { targets: ["p2"] });
    expect(s.announce).toMatchObject({ kind: "morning", deaths: [{ id: "p2", cause: "wolf" }] });
  });

  it("shows the pack to its members only", () => {
    const s = game(["werwolf", "werwolf", D, D, D]);
    expect(see(s, "p0").players.filter((p) => p.pack).map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(see(s, "p2").players.some((p) => p.pack)).toBe(false);
    expect(see(s, "p2").players.find((p) => p.id === "p0")!.role).toBeNull();
  });
});

describe("Seherin", () => {
  it("learns one role a night, which nobody else sees", () => {
    let s = game(["werwolf", "seherin", D, D, D]);
    fails(() => night(s, "p1", "seherin", { targets: ["p1"] }));
    s = night(s, "p1", "seherin", { targets: ["p0"] });
    fails(() => night(s, "p1", "seherin", { targets: ["p2"] }), /schon erledigt/);
    expect(see(s, "p1").notes).toEqual([{ kind: "seen", round: 1, target: "p0", role: "werwolf" }]);
    expect(see(s, "p2").notes).toEqual([]);
  });
});

describe("Hexe", () => {
  it("saves one attacked player, poisons another, and has each potion once", () => {
    let s = game(["werwolf", "hexe", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    expect(s.night.step).toBe("hexe");
    expect(see(s, "p1").tasks[0]).toMatchObject({ id: "hexe", attacked: ["p2"] });
    fails(() => night(s, "p1", "hexe", { heal: "p3" }), /hilft hier nicht/);
    s = night(s, "p1", "hexe", { heal: "p2", poison: "p3" });
    expect(s.announce!.deaths).toEqual([{ id: "p3", cause: "gift" }]);
    expect(s.potions).toEqual({ heal: false, poison: false });

    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p4: null });
    s = ackAll(s);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    fails(() => night(s, "p1", "hexe", { heal: "p4" }));
    fails(() => night(s, "p1", "hexe", { poison: "p0" }));
    s = night(s, "p1", "hexe", {});
    expect(s.announce!.deaths).toEqual([{ id: "p4", cause: "wolf" }]);
  });
});

describe("Jäger", () => {
  it("takes somebody along when he dies", () => {
    let s = game(["werwolf", "jaeger", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = ackAll(s);
    expect(s.phase).toBe("hunter");
    expect(see(s, "p1").pending).toEqual({ kind: "hunter", who: "p1" });
    fails(() => act(s, "p2", { type: "choose", targets: ["p0"] }), /nicht dran/);
    s = act(s, "p1", { type: "choose", targets: ["p0"] });
    expect(s.announce).toMatchObject({ kind: "hunter", deaths: [{ id: "p0", cause: "jaeger" }] });
    s = ackAll(s);
    expect(s.winner).toBe("dorf");
  });
});

describe("Amor", () => {
  it("lets the lovers die together", () => {
    let s = game(["werwolf", "amor", D, D, D, D]);
    expect(s.night.step).toBe("erwachen");
    s = night(s, "p1", "amor", { targets: ["p2", "p3"] });
    expect(see(s, "p2").me.loverId).toBe("p3");
    expect(see(s, "p4").lovers).toBeNull();
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    expect(s.announce!.deaths).toEqual([
      { id: "p2", cause: "wolf" },
      { id: "p3", cause: "liebe" },
    ]);
  });

  it("lets a couple from different teams win as the last two", () => {
    let s = game(["werwolf", "amor", D, D, D]);
    s = night(s, "p1", "amor", { targets: ["p0", "p2"] });
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    s = toVote(s);
    s = votes(s, { p0: "p3", p2: "p3", p3: "p4", p4: "p0" });
    s = ackAll(s);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = ackAll(s);
    expect(s.winner).toBe("paar");
    expect(s.winners.sort()).toEqual(["p0", "p2"]);
  });
});

describe("Dieb", () => {
  it("swaps his card in the first night and plays the new role right away", () => {
    let s = game(["dieb", "werwolf", D, D, D], { center: ["seherin", D] });
    expect(s.night.step).toBe("dieb");
    expect(see(s, "p0").tasks[0].options.map((o) => o.id)).toEqual(["0", "1", "keep"]);
    s = night(s, "p0", "dieb", { option: "0" });
    expect(s.players[0].role).toBe("seherin");
    expect(s.center).toEqual(["dieb", D]);
    expect(tasks(s, "p0")).toEqual(["seherin"]);
  });

  it("must take a wolf card when both are wolves", () => {
    let s = game(["dieb", "werwolf", D, D, D, D, D], { center: ["werwolf", "werwolf"] });
    fails(() => night(s, "p0", "dieb", { option: "keep" }), /musst eine nehmen/);
    s = night(s, "p0", "dieb", { option: "1" });
    expect(tasks(s, "p0")).toEqual(["wolf"]);
  });
});

describe("Kleines Mädchen", () => {
  it("learns a wolf's name when she is not noticed", () => {
    let s = game(["werwolf", "maedchen", D, D, D]);
    s = night(s, "p1", "maedchen", { option: "spy" });
    s = night(s, "p0", "wolf", { targets: ["p2"] }, () => 0.9);
    expect(see(s, "p1").notes).toEqual([{ kind: "spied", round: 1, wolf: "p0" }]);
    expect(s.announce!.deaths).toEqual([{ id: "p2", cause: "wolf" }]);
  });

  it("is attacked instead of the victim when the wolves notice her", () => {
    let s = game(["werwolf", "maedchen", D, D, D]);
    s = night(s, "p1", "maedchen", { option: "spy" });
    s = night(s, "p0", "wolf", { targets: ["p2"] }, () => 0.1);
    expect(s.announce!.deaths).toEqual([{ id: "p1", cause: "wolf" }]);
  });
});

describe("Beschützer", () => {
  it("stops the wolves, but not twice in a row on the same player, and not poison", () => {
    let s = game(["werwolf", "beschuetzer", "hexe", D, D, D]);
    s = night(s, "p1", "beschuetzer", { targets: ["p3"] });
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p2", "hexe", { poison: "p4" });
    expect(s.announce!.deaths).toEqual([{ id: "p4", cause: "gift" }]);
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p5: null });
    s = ackAll(s);
    fails(() => night(s, "p1", "beschuetzer", { targets: ["p3"] }), /zweimal/);
    s = night(s, "p1", "beschuetzer", { targets: ["p1"] });
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p2", "hexe", {});
    expect(s.announce!.deaths).toEqual([{ id: "p3", cause: "wolf" }]);
  });
});

describe("Ältester", () => {
  it("survives the first attack but not the second", () => {
    let s = game(["werwolf", "aeltester", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    expect(s.announce!.deaths).toEqual([]);
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null });
    s = ackAll(s);
    s = night(s, "p0", "wolf", { targets: ["p1"] });
    expect(s.announce!.deaths).toEqual([{ id: "p1", cause: "wolf" }]);
  });

  it("takes all village abilities when the village kills him", () => {
    let s = game(["werwolf", "aeltester", "seherin", "jaeger", D, D]);
    s = night(s, "p2", "seherin", { targets: ["p0"] });
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p1", p1: "p0", p2: "p1", p3: "p1", p5: "p1" });
    expect(s.announce).toMatchObject({ deaths: [{ id: "p1", cause: "vote" }], powersLost: true });
    s = ackAll(s);
    expect(tasks(s, "p2")).toEqual([]);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    expect(s.announce!.deaths).toEqual([{ id: "p3", cause: "wolf" }]);
    s = ackAll(s);
    expect(s.phase).toBe("discussion");
  });
});

describe("Sündenbock", () => {
  it("is banished on a tie and decides who votes next", () => {
    let s = game(["werwolf", "suendenbock", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = toVote(s);
    s = votes(s, { p0: "p2", p2: "p0", p3: "p2", p4: "p0", p1: null });
    expect(s.announce!.deaths).toEqual([{ id: "p1", cause: "suendenbock" }]);
    s = ackAll(s);
    expect(s.phase).toBe("scapegoat");
    s = act(s, "p1", { type: "choose", targets: ["p2", "p3"] });
    expect(s.announce).toMatchObject({ kind: "scapegoat", voters: ["p2", "p3"] });
    s = ackAll(s);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    expect(see(s, "p0").me.canVote).toBe(false);
    fails(() => act(s, "p0", { type: "vote", target: "p2" }), /nicht abstimmen/);
    s = votes(s, { p2: "p0", p3: "p0" });
    expect(s.announce!.deaths).toEqual([{ id: "p0", cause: "vote" }]);
  });
});

describe("Dorfdepp", () => {
  it("survives being voted out once, but loses his vote", () => {
    let s = game(["werwolf", "idiot", D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: "p1", p1: "p0", p2: "p1", p3: "p1" });
    expect(s.announce).toMatchObject({ deaths: [], exposed: "p1" });
    expect(alive(s, "p1")).toBe(true);
    s = ackAll(s);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = toVote(s);
    fails(() => act(s, "p1", { type: "vote", target: "p0" }), /nicht abstimmen/);
    s = votes(s, { p0: "p1", p2: "p1" });
    expect(s.announce!.deaths).toEqual([{ id: "p1", cause: "vote" }]);
  });
});

describe("Flötenspieler", () => {
  it("wins alone once everybody else is enchanted", () => {
    let s = game(["werwolf", "floetenspieler", D, D, D]);
    fails(() => night(s, "p1", "floetenspieler", { targets: ["p2"] }), /zwei/);
    s = night(s, "p1", "floetenspieler", { targets: ["p2", "p3"] });
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    expect(see(s, "p2").players.filter((p) => p.enchanted).map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(see(s, "p0").players.some((p) => p.enchanted)).toBe(false);
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null });
    s = ackAll(s);
    s = night(s, "p1", "floetenspieler", { targets: ["p0"] });
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    s = ackAll(s);
    expect(s.winner).toBe("floetenspieler");
    expect(s.winners).toEqual(["p1"]);
  });
});

describe("Wolfshund", () => {
  it("can join the pack in the first night and hunts with it at once", () => {
    let s = game(["werwolf", "wolfshund", "seherin", D, D, D]);
    expect(s.night.step).toBe("erwachen");
    s = night(s, "p1", "wolfshund", { option: "wolf" });
    expect(tasks(s, "p1")).toEqual(["wolf"]);
    s = night(s, "p2", "seherin", { targets: ["p1"] });
    expect(see(s, "p2").notes[0]).toMatchObject({ role: "wolfshund" });
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    expect(s.phase).toBe("night");
    s = night(s, "p1", "wolf", { targets: ["p3"] });
    expect(s.announce!.deaths).toEqual([{ id: "p3", cause: "wolf" }]);
  });
});

describe("Weißer Werwolf", () => {
  it("may kill a wolf every second night", () => {
    let s = game(["werwolf", "werwolf", "weisserWolf", D, D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "wolf", { targets: ["p3"] });
    expect(s.phase).toBe("night");
    s = night(s, "p2", "wolf", { targets: ["p3"] });
    expect(s.phase).toBe("announce");
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p4: null, p5: null, p6: null, p7: null });
    s = ackAll(s);
    for (const w of ["p0", "p1", "p2"]) s = night(s, w, "wolf", { targets: ["p4"] });
    expect(s.night.step).toBe("rudel");
    s = night(s, "p2", "weisserWolf", { targets: ["p0"] });
    expect(s.announce!.deaths.map((d) => d.id).sort()).toEqual(["p0", "p4"]);
  });

  it("wins only alone, while the pack wins as soon as it is not outnumbered", () => {
    const s = game(["werwolf", "weisserWolf", D, D, D]);
    const only = (...ids: string[]) => {
      const copy = structuredClone(s);
      for (const p of copy.players) p.alive = ids.includes(p.id);
      return checkWinner(copy);
    };
    expect(only("p1")).toBe("weisserWolf");
    expect(only("p1", "p2")).toBe("weisserWolf");
    expect(only("p0", "p1", "p2")).toBeNull();
    expect(only("p0", "p1")).toBe("wolf");
  });
});

describe("Großer böser Wolf", () => {
  it("takes a second victim until the first wolf dies", () => {
    let s = game(["werwolf", "grosserWolf", D, D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    s = night(s, "p1", "wolf", { targets: ["p2"] });
    expect(s.night.step).toBe("rudel");
    fails(() => night(s, "p1", "grosserWolf", { targets: ["p2"] }));
    s = night(s, "p1", "grosserWolf", { targets: ["p3"] });
    expect(s.announce!.deaths.map((d) => d.id)).toEqual(["p2", "p3"]);
    s = toVote(s);
    s = votes(s, { p0: "p4", p1: "p4", p4: "p0", p5: "p0", p6: "p0" });
    s = ackAll(s);
    s = night(s, "p1", "wolf", { targets: ["p4"] });
    expect(s.phase).toBe("announce");
  });
});

describe("Urwolf", () => {
  it("infects the victim once instead of killing it", () => {
    let s = game(["werwolf", "urwolf", "seherin", D, D, D, D]);
    s = night(s, "p2", "seherin", { targets: ["p3"] });
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "wolf", { targets: ["p3"] });
    expect(see(s, "p1").tasks[0]).toMatchObject({ id: "urwolf", victim: "p3" });
    s = night(s, "p1", "urwolf", { option: "infect" });
    expect(s.announce!.deaths).toEqual([]);
    expect(see(s, "p3").me).toMatchObject({ pack: true, team: "wolf" });
    expect(see(s, "p3").notes).toEqual([{ kind: "turned", round: 1, why: "infected" }]);
    expect(see(s, "p0").players.find((p) => p.id === "p3")!.pack).toBe(true);
    expect(see(s, "p2").players.find((p) => p.id === "p3")!.pack).toBe(false);
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null, p5: null, p6: null });
    s = ackAll(s);
    expect(tasks(s, "p3")).toEqual(["wolf"]);
    s = night(s, "p2", "seherin", { targets: ["p3"] });
    for (const w of ["p0", "p1", "p3"]) s = night(s, w, "wolf", { targets: ["p4"] });
    expect(s.announce!.deaths).toEqual([{ id: "p4", cause: "wolf" }]);
  });

  it("cannot infect a protected player", () => {
    let s = game(["werwolf", "urwolf", "beschuetzer", D, D, D, D]);
    s = night(s, "p2", "beschuetzer", { targets: ["p3"] });
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "urwolf", { option: "infect" });
    expect(s.players[3].turned).toBe(false);
    expect(s.infectionUsed).toBe(true);
  });
});

describe("Wildes Kind", () => {
  it("becomes a wolf when its model dies", () => {
    let s = game(["werwolf", "wildesKind", D, D, D, D]);
    s = night(s, "p1", "wildesKind", { targets: ["p2"] });
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    expect(see(s, "p1").notes).toContainEqual({ kind: "turned", round: 1, why: "model" });
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p3: null, p4: null, p5: null });
    s = ackAll(s);
    expect(tasks(s, "p1")).toEqual(["wolf"]);
  });
});

describe("Fuchs", () => {
  it("smells a wolf among three neighbours, and loses his nose after a miss", () => {
    let s = game(["werwolf", "fuchs", D, D, D, D]);
    s = night(s, "p1", "fuchs", { targets: ["p1"] });
    expect(see(s, "p1").notes[0]).toMatchObject({ kind: "sniffed", targets: ["p1", "p0", "p2"], wolf: true });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null });
    s = ackAll(s);
    s = night(s, "p1", "fuchs", { targets: ["p3"] });
    expect(s.foxActive).toBe(false);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null });
    s = ackAll(s);
    expect(tasks(s, "p1")).toEqual([]);
  });
});

describe("Bärenführer", () => {
  it("lets the bear growl when a living neighbour is a wolf", () => {
    let s = game(["werwolf", "baerenfuehrer", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p4"] });
    expect(s.announce!.growl).toBe(true);

    let quiet = game(["baerenfuehrer", D, "werwolf", D, D, D]);
    quiet = night(quiet, "p2", "wolf", { targets: ["p4"] });
    expect(quiet.announce!.growl).toBe(false);
  });
});

describe("Rabe", () => {
  it("adds two votes against the marked player and says so in the morning", () => {
    let s = game(["werwolf", "rabe", D, D, D, D]);
    s = night(s, "p1", "rabe", { targets: ["p2"] });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    expect(s.announce!.marked).toEqual(["p2"]);
    s = toVote(s);
    expect(see(s, "p3").vote!.marked).toEqual(["p2"]);
    s = votes(s, { p0: "p3", p1: null, p2: null, p3: null, p4: null });
    expect(s.announce!.deaths).toEqual([{ id: "p2", cause: "vote" }]);
  });
});

describe("Ritter mit der rostigen Klinge", () => {
  it("kills the next wolf after him at the end of the following night", () => {
    let s = game(["werwolf", "werwolf", "ritter", D, D, D, D]);
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    s = night(s, "p1", "wolf", { targets: ["p2"] });
    expect(s.tetanus).toBe("p0");
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p3: null, p4: null, p5: null, p6: null });
    s = ackAll(s);
    s = night(s, "p0", "wolf", { targets: ["p3"] });
    s = night(s, "p1", "wolf", { targets: ["p3"] });
    expect(s.announce!.deaths).toEqual([
      { id: "p3", cause: "wolf" },
      { id: "p0", cause: "tetanus" },
    ]);
  });
});

describe("Engel", () => {
  it("opens with a day and wins when the first vote takes him", () => {
    let s = game(["werwolf", "engel", D, D, D]);
    expect(s.phase).toBe("discussion");
    expect(s.round).toBe(0);
    s = ackAll(s);
    s = votes(s, { p0: "p1", p1: "p0", p2: "p1", p3: "p1", p4: "p1" });
    s = ackAll(s);
    expect(s.winner).toBe("engel");
    expect(s.winners).toEqual(["p1"]);
  });

  it("also wins when he dies in the first night, but not later", () => {
    let s = game(["werwolf", "engel", D, D, D]);
    s = ackAll(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null });
    s = ackAll(s);
    const first = night(s, "p0", "wolf", { targets: ["p1"] });
    expect(ackAll(first).winner).toBe("engel");

    s = night(s, "p0", "wolf", { targets: ["p2"] });
    expect(s.angelChance).toBe(false);
    s = toVote(s);
    s = votes(s, { p0: "p1", p1: "p0", p3: "p1", p4: "p1" });
    s = ackAll(s);
    expect(s.winner).toBeNull();
    expect(s.phase).toBe("night");
  });
});

describe("Schauspieler", () => {
  it("uses each of his three abilities once", () => {
    let s = game(["werwolf", "schauspieler", D, D, D]);
    expect(see(s, "p1").actorPowers).toEqual(["seherin", "beschuetzer", "fuchs"]);
    fails(() => night(s, "p1", "schauspieler", { option: "rabe", targets: ["p2"] }));
    s = night(s, "p1", "schauspieler", { option: "beschuetzer", targets: ["p2"] });
    s = night(s, "p0", "wolf", { targets: ["p2"] });
    expect(s.announce!.deaths).toEqual([]);
    s = toVote(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null });
    s = ackAll(s);
    fails(() => night(s, "p1", "schauspieler", { option: "beschuetzer", targets: ["p3"] }));
    s = night(s, "p1", "schauspieler", { option: "seherin", targets: ["p0"] });
    expect(see(s, "p1").notes.at(-1)).toMatchObject({ kind: "seen", target: "p0", role: "werwolf", actor: true });
  });
});

describe("Hauptmann", () => {
  it("is elected on the first day, votes twice and names a successor", () => {
    let s = game(["werwolf", D, D, D, D, D], { captain: true });
    s = night(s, "p0", "wolf", { targets: ["p5"] });
    s = ackAll(s);
    expect(s.phase).toBe("election");
    s = votes(s, { p0: "p1", p1: "p1", p2: "p1", p3: "p2", p4: "p1" });
    expect(s.announce).toMatchObject({ kind: "election", captain: "p1" });
    s = ackAll(s);
    s = ackAll(s);
    expect(s.phase).toBe("vote");
    s = votes(s, { p1: "p0", p0: "p1", p2: "p3", p3: "p4", p4: "p2" });
    expect(s.announce!.deaths).toEqual([{ id: "p0", cause: "vote" }]);
    expect(s.winner).toBeNull();
  });

  it("hands the title on when the Hauptmann dies", () => {
    let s = game(["werwolf", "werwolf", D, D, D, D, D], { captain: true });
    for (const w of ["p0", "p1"]) s = night(s, w, "wolf", { targets: ["p6"] });
    s = ackAll(s);
    s = votes(s, { p0: "p2", p1: "p2", p2: "p2", p3: "p2", p4: "p2", p5: "p2" });
    s = ackAll(s);
    s = ackAll(s);
    s = votes(s, { p0: null, p1: null, p2: null, p3: null, p4: null, p5: null });
    s = ackAll(s);
    for (const w of ["p0", "p1"]) s = night(s, w, "wolf", { targets: ["p2"] });
    s = ackAll(s);
    expect(s.phase).toBe("succession");
    fails(() => act(s, "p2", { type: "choose", targets: ["p2"] }));
    s = act(s, "p2", { type: "choose", targets: ["p3"] });
    expect(s.captain).toBe("p3");
    s = ackAll(s);
    expect(s.phase).toBe("discussion");
  });
});
