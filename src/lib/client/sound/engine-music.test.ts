import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sound engine and its music against a pretend browser: however often a
 * mood is asked for or the screen is tapped, only one music plays.
 */

type Played = { moods: string[]; stopped: boolean; ticks: number };
const played = vi.hoisted(() => [] as Played[]);

vi.mock("./music", () => ({
  Music: class {
    private readonly record: Played;
    constructor(_ctx: unknown, _out: unknown, mood: string) {
      this.record = { moods: [mood], stopped: false, ticks: 0 };
      played.push(this.record);
    }
    setMood(mood: string) {
      this.record.moods.push(mood);
    }
    schedule() {
      this.record.ticks += 1;
    }
    stop() {
      this.record.stopped = true;
    }
  },
}));

class FakeNode {
  gain = { value: 1, setTargetAtTime() {} };
  threshold = { value: 0 };
  ratio = { value: 0 };
  connect() {}
  disconnect() {}
}

const contexts: FakeContext[] = [];

class FakeContext {
  state: string = startState;
  currentTime = 0;
  destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  constructor() {
    contexts.push(this);
  }
  createGain() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  resume() {
    // A phone only lets the page make sound after a tap.
    if (!allowed) return Promise.resolve();
    this.state = "running";
    this.onstatechange?.();
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    this.onstatechange?.();
    return Promise.resolve();
  }
}

let startState = "running";
let allowed = true;
const playing = () => played.filter((p) => !p.stopped);

async function engine() {
  played.length = 0;
  vi.stubGlobal("window", { AudioContext: FakeContext });
  vi.stubGlobal("document", { hidden: false, addEventListener() {} });
  vi.stubEnv("RECORDINGS", "");
  vi.resetModules();
  const { sound } = await import("./engine");
  return sound;
}

describe("the music", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startState = "running";
    allowed = true;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("starts once, however often the same night is asked for and the screen is tapped", async () => {
    const sound = await engine();
    sound.wake();
    for (let i = 0; i < 5; i++) {
      sound.setMusic("night");
      sound.wake();
    }
    expect(played).toHaveLength(1);
    expect(played[0].moods.every((m) => m === "night")).toBe(true);
  });

  it("goes from night to day and back on the same music, without a second one", async () => {
    const sound = await engine();
    sound.wake();
    for (let round = 0; round < 4; round++) {
      sound.setMusic("night");
      sound.setMusic("day");
    }
    sound.setMusic("night");
    expect(played).toHaveLength(1);
    expect(played[0].moods.filter((m, i, all) => m !== all[i - 1])).toEqual(["night", "day", "night", "day", "night", "day", "night", "day", "night"]);
  });

  it("stops when turned off, and a new music only starts after the old one was stopped", async () => {
    const sound = await engine();
    sound.wake();
    sound.setMusic("night");
    sound.setMusic(null);
    expect(played[0].stopped).toBe(true);
    sound.setMusic("night");
    expect(played).toHaveLength(2);
    expect(playing()).toHaveLength(1);
    sound.sleep();
    expect(playing()).toHaveLength(0);
  });

  it("waits until the browser allows sound, then starts exactly once", async () => {
    startState = "suspended";
    allowed = false;
    const sound = await engine();
    sound.wake();
    sound.setMusic("night");
    expect(played).toHaveLength(0);
    allowed = true;
    sound.wake();
    await Promise.resolve();
    expect(played).toHaveLength(1);
    // The browser reports its state again and again, for example after the phone was locked.
    const ctx = contexts.at(-1)!;
    ctx.onstatechange?.();
    await ctx.suspend();
    await ctx.resume();
    ctx.onstatechange?.();
    expect(played).toHaveLength(1);
  });

  it("keeps queueing the music while it plays and stops once it is turned off", async () => {
    const sound = await engine();
    sound.wake();
    sound.setMusic("night");
    vi.advanceTimersByTime(1000);
    const ticks = played[0].ticks;
    expect(ticks).toBeGreaterThanOrEqual(4);
    sound.setMusic(null);
    vi.advanceTimersByTime(5000);
    expect(played[0].ticks).toBe(ticks);
  });
});
