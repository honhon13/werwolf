import { describe, expect, it } from "vitest";
import { type Crackle, Kindling } from "./fire";

/** The same "random" numbers on every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Asks for crackles the way the music does: a second ahead, four times a second. */
function listen(kindling: Kindling, from: number, seconds: number) {
  const all: Crackle[] = [];
  for (let now = from; now < from + seconds; now += 0.25) all.push(...kindling.take(now, now + 1));
  return all;
}

describe("the crackling campfire", () => {
  it("crackles a few times a second, livelier and calmer, but never wildly", () => {
    for (const seed of [1, 2, 3]) {
      const crackles = listen(new Kindling(0, seeded(seed)), 0, 600);
      const perTen = Array.from({ length: 60 }, (_, i) => crackles.filter((c) => c.at >= i * 10 && c.at < i * 10 + 10).length / 10);
      expect(Math.min(...perTen)).toBeGreaterThan(2);
      expect(Math.max(...perTen)).toBeLessThan(14);
      expect(new Set(perTen.map(Math.round)).size).toBeGreaterThan(2);
    }
  });

  it("pops now and then, louder than the ticks but never at full strength", () => {
    const crackles = listen(new Kindling(0, seeded(7)), 0, 600);
    const pops = crackles.filter((c) => c.grain >= 12);
    expect(pops.length / 10).toBeGreaterThan(4);
    expect(pops.length / 10).toBeLessThan(15);
    for (const c of crackles) {
      expect(c.grain).toBeGreaterThanOrEqual(0);
      expect(c.grain).toBeLessThan(15);
      expect(c.gain).toBeGreaterThan(0);
      expect(c.gain).toBeLessThanOrEqual(1);
      expect(c.rate).toBeGreaterThanOrEqual(0.8);
      expect(c.rate).toBeLessThanOrEqual(1.25);
    }
  });

  it("hands out every crackle once, in order and not before it is asked for", () => {
    for (const seed of [3, 4, 5, 6]) {
      const kindling = new Kindling(0, seeded(seed));
      const seen = new Set<number>();
      for (let now = 0; now < 120; now += 0.25) {
        const crackles = kindling.take(now, now + 1);
        crackles.forEach((c, i) => {
          expect(c.at).toBeGreaterThanOrEqual(now);
          if (i > 0) expect(c.at).toBeGreaterThanOrEqual(crackles[i - 1].at);
          expect(seen.has(c.at)).toBe(false);
          seen.add(c.at);
        });
      }
    }
  });

  it("does not make up for a stalled page with a burst of crackles", () => {
    const kindling = new Kindling(0, seeded(5));
    kindling.take(0, 1);
    // Thirty seconds without asking, as when the page hung or the phone was locked.
    const late = kindling.take(31, 32);
    expect(late.length).toBeLessThan(20);
    expect(late.every((c) => c.at >= 31)).toBe(true);
  });
});
