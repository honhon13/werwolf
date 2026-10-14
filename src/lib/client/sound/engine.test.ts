import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sound engine against a pretend browser: it counts how many voices are
 * audible at once, recordings and the fallback voice together.
 */

type Gate = { promise: Promise<void>; open: () => void };
function gate(): Gate {
  let open = () => {};
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

let playing: Set<FakeSource>;
let started: string[];
let spoken: string[];
let loudest: number;
let fetchGates: Map<string, Gate>;
let decodeGates: Map<string, Gate>;
let broken: Set<string>;
let gains: FakeNode[];
let synth: ReturnType<typeof fakeSynth>;

const audible = () => playing.size + synth.queue.filter((u) => u.volume !== 0).length;
const measure = () => (loudest = Math.max(loudest, audible()));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeParam {
  value = 1;
  setTargetAtTime(value: number) {
    this.value = value;
  }
}

class FakeNode {
  gain = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  connect() {}
  disconnect() {}
}

class FakeSource extends FakeNode {
  buffer: { name: string } | null = null;
  onended: (() => void) | null = null;
  start() {
    playing.add(this);
    started.push(this.buffer!.name);
    measure();
  }
  stop() {
    playing.delete(this);
  }
  disconnect() {
    playing.delete(this);
  }
}

class FakeContext {
  state = "running";
  currentTime = 0;
  destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  createGain() {
    const node = new FakeNode();
    gains.push(node);
    return node;
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeSource();
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  decodeAudioData(bytes: ArrayBuffer, ok: (b: { name: string }) => void, fail: (e: Error) => void) {
    const name = new TextDecoder().decode(bytes);
    void (decodeGates.get(name)?.promise ?? Promise.resolve()).then(() =>
      broken.has(name) ? fail(new Error("cannot decode")) : ok({ name }),
    );
  }
}

class FakeUtterance {
  lang = "";
  rate = 1;
  volume = 1;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function fakeSynth() {
  return {
    queue: [] as FakeUtterance[],
    speak(line: FakeUtterance) {
      this.queue.push(line);
      if (line.volume !== 0) spoken.push(line.text);
      measure();
      line.onstart?.();
    },
    cancel() {
      const cancelled = this.queue;
      this.queue = [];
      // Browsers report the end of a cancelled line a moment later.
      setTimeout(() => cancelled.forEach((line) => line.onend?.()), 0);
    },
    getVoices: () => [],
  };
}

async function engine(recorded: string[]) {
  playing = new Set();
  started = [];
  spoken = [];
  loudest = 0;
  gains = [];
  synth = fakeSynth();
  vi.stubGlobal("window", { AudioContext: FakeContext, speechSynthesis: synth });
  vi.stubGlobal("document", { hidden: false, addEventListener() {} });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("fetch", async (url: string) => {
    const name = url.slice(url.lastIndexOf("/") + 1, url.lastIndexOf("."));
    await fetchGates.get(name)?.promise;
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(name).buffer };
  });
  vi.stubEnv("RECORDINGS", recorded.map((name) => `${name}.m4a`).join(","));
  vi.resetModules();
  const { sound } = await import("./engine");
  sound.wake();
  return sound;
}

beforeEach(() => {
  fetchGates = new Map();
  decodeGates = new Map();
  broken = new Set();
});

describe("only one voice at a time", () => {
  it("stops the recording that is playing when the next one starts", async () => {
    const sound = await engine(["01-rollen", "02-nacht-erste"]);
    await sound.narrate("rollen", "Rollen");
    expect([...playing].map((s) => s.buffer!.name)).toEqual(["01-rollen"]);
    await sound.narrate("nachtErste", "Nacht");
    expect([...playing].map((s) => s.buffer!.name)).toEqual(["02-nacht-erste"]);
    expect(loudest).toBe(1);
  });

  it("never starts a recording that is still loading once a newer one began", async () => {
    fetchGates.set("01-rollen", gate());
    const sound = await engine(["01-rollen", "02-nacht-erste"]);
    const late = sound.narrate("rollen", "Rollen");
    await sound.narrate("nachtErste", "Nacht");
    fetchGates.get("01-rollen")!.open();
    await late;
    expect(started).toEqual(["02-nacht-erste"]);
    expect(loudest).toBe(1);
  });

  it("drops a recording that is still loading when the sound is turned off", async () => {
    fetchGates.set("01-rollen", gate());
    const sound = await engine(["01-rollen"]);
    const late = sound.narrate("rollen", "Rollen");
    sound.sleep();
    fetchGates.get("01-rollen")!.open();
    await late;
    expect(started).toEqual([]);
    expect(spoken).toEqual([]);
  });

  it("does not fall back to the voice for an outdated recording that cannot be played", async () => {
    decodeGates.set("01-rollen", gate());
    broken.add("01-rollen");
    const sound = await engine(["01-rollen", "02-nacht-erste"]);
    const late = sound.narrate("rollen", "Rollen");
    await tick();
    await sound.narrate("nachtErste", "Nacht");
    decodeGates.get("01-rollen")!.open();
    await late;
    expect(spoken).toEqual([]);
    expect(started).toEqual(["02-nacht-erste"]);
    expect(loudest).toBe(1);
  });

  it("silences the fallback voice for a recording and keeps the music down", async () => {
    const sound = await engine(["02-nacht-erste"]);
    await sound.narrate("rollen", "Schaut euch heimlich eure Rolle an.");
    expect(spoken).toEqual(["Schaut euch heimlich eure Rolle an."]);
    await sound.narrate("nachtErste", "Nacht");
    await tick();
    expect(synth.queue).toEqual([]);
    expect(started).toEqual(["02-nacht-erste"]);
    expect(loudest).toBe(1);
    // The music bus is the first gain; it stays ducked while the recording plays.
    expect(gains[0].gain.value).toBeLessThan(1);
  });
});
