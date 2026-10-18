/**
 * The campfire at night: the soft roar of the flames, a faint hiss and the
 * crackling of the wood, generated on the fly like the rest of the music.
 * The crackles are never a loop: each one is planned with its own moment,
 * sound, pitch and loudness, so the fire never repeats itself.
 */

/** Levels of the three parts, relative to the music. */
const ROAR = 0.0125;
const HISS = 0.0045;
const CRACKLE = 0.375;

/** How many short ticks and clustered snaps there are to choose from; pops come last. */
const TICKS = 8;
const SNAPS = 4;
const POPS = 3;

/** One crackle of the wood, planned ahead. `grain` picks the sound. */
export interface Crackle {
  at: number;
  grain: number;
  rate: number;
  gain: number;
}

/**
 * Decides when the wood crackles. The fire has livelier and calmer moments:
 * its heat drifts slowly around a middle, and a hotter fire crackles more
 * often and louder.
 * Now and then a few ticks come in a quick cluster, and every few seconds
 * resin pops. Whatever lies before `from` is skipped instead of being made
 * up for, so a stalled page never fires a burst of crackles at once.
 */
export class Kindling {
  private next: number;
  private nextPop: number;
  private heat = 0.5;

  constructor(
    start: number,
    private readonly random: () => number = Math.random,
  ) {
    this.next = start + this.gap();
    this.nextPop = start + this.popGap();
  }

  /** Every crackle that starts between `from` and `until`, in order. */
  take(from: number, until: number): Crackle[] {
    const out: Crackle[] = [];
    if (this.next < from) this.next = from + this.gap();
    if (this.nextPop < from) this.nextPop = from + this.popGap();
    while (this.next < until) {
      const drift = (0.5 - this.heat) * 0.03 + (this.random() - 0.5) * 0.12;
      this.heat = Math.min(1, Math.max(0.15, this.heat + drift));
      const loud = 0.35 + 0.65 * this.heat;
      out.push(this.crackle(this.next, this.random() * TICKS, (0.1 + 0.9 * this.random() ** 3) * loud));
      if (this.random() < 0.22 * this.heat) {
        const grain = TICKS + this.random() * SNAPS;
        out.push(this.crackle(this.next + 0.004 + this.random() * 0.03, grain, (0.3 + 0.4 * this.random()) * loud));
      }
      this.next += this.gap();
    }
    while (this.nextPop < until) {
      out.push(this.crackle(this.nextPop, TICKS + SNAPS + this.random() * POPS, 0.28 + 0.22 * this.random()));
      this.nextPop += this.popGap();
    }
    return out.sort((a, b) => a.at - b.at);
  }

  private crackle(at: number, grain: number, gain: number): Crackle {
    return { at, grain: Math.floor(grain), rate: 0.8 + 0.45 * this.random(), gain };
  }

  /** Seconds to the next tick: random, and shorter the hotter the fire. */
  private gap(): number {
    return -Math.log(1 - this.random()) / (3 + 7 * this.heat);
  }

  private popGap(): number {
    return 2.5 - Math.log(1 - this.random()) * 5;
  }
}

export class Fire {
  /** The fire's volume as a whole; the music fades it in and out with the night. */
  readonly level: GainNode;
  private readonly crackles: GainNode;
  private readonly grains: AudioBuffer[];
  private readonly running: AudioScheduledSourceNode[] = [];
  private readonly kindling: Kindling;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    level: number,
    startAt: number,
  ) {
    this.level = ctx.createGain();
    this.level.gain.value = level;
    this.level.connect(destination);
    this.kindling = new Kindling(startAt);

    // Roar: low noise that breathes, the flames moving in the air.
    const roar = this.loop(this.rumble(7.3), startAt);
    const body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 700;
    const breath = ctx.createGain();
    breath.gain.value = ROAR;
    this.lfo(0.13, ROAR * 0.35, startAt).connect(breath.gain);
    this.lfo(0.31, ROAR * 0.2, startAt).connect(breath.gain);
    roar.connect(body).connect(breath).connect(this.level);

    // Hiss: a very quiet high rustle, the gas escaping from the wood.
    const hiss = this.loop(this.white(5.1), startAt);
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 3000;
    const fizz = ctx.createGain();
    fizz.gain.value = HISS;
    this.lfo(0.21, HISS * 0.4, startAt).connect(fizz.gain);
    hiss.connect(high).connect(fizz).connect(this.level);

    // Crackles: kept out of the bass and softened at the top, so they stay
    // in the background on a phone speaker too.
    this.crackles = ctx.createGain();
    this.crackles.gain.value = CRACKLE;
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = "highpass";
    lowCut.frequency.value = 350;
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 7500;
    this.crackles.connect(lowCut).connect(soften).connect(this.level);

    this.grains = [
      ...Array.from({ length: TICKS }, () => this.tick()),
      ...Array.from({ length: SNAPS }, () => this.snap()),
      ...Array.from({ length: POPS }, () => this.pop()),
    ];
  }

  /** Queues the crackles between `from` and `until`; none that would start after `burnsUntil`. */
  schedule(from: number, until: number, burnsUntil: number) {
    for (const crackle of this.kindling.take(from, until)) {
      if (crackle.at >= burnsUntil) continue;
      const source = this.ctx.createBufferSource();
      source.buffer = this.grains[crackle.grain];
      source.playbackRate.value = crackle.rate;
      const gain = this.ctx.createGain();
      gain.gain.value = crackle.gain;
      source.connect(gain).connect(this.crackles);
      source.onended = () => gain.disconnect();
      source.start(crackle.at);
    }
  }

  /** Ends the roar and the hiss; crackles already queued fade with the music. */
  stop(at: number) {
    for (const source of this.running) source.stop(at);
  }

  private loop(buffer: AudioBuffer, at: number): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start(at);
    this.running.push(source);
    return source;
  }

  private lfo(rate: number, depth: number, at: number): GainNode {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = this.ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount);
    osc.start(at);
    this.running.push(osc);
    return amount;
  }

  private buffer(seconds: number): AudioBuffer {
    return this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
  }

  /** Low, rumbling noise whose end runs smoothly into its start, so the loop never clicks. */
  private rumble(seconds: number): AudioBuffer {
    const buffer = this.buffer(seconds);
    const data = buffer.getChannelData(0);
    const overlap = Math.floor(0.05 * buffer.sampleRate);
    const raw = new Float32Array(data.length + overlap);
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      last = (last + 0.05 * (Math.random() * 2 - 1)) / 1.05;
      raw[i] = last * 8;
    }
    // The start fades in from what follows the end, which is where the loop jumps back from.
    for (let i = 0; i < data.length; i++) {
      const mix = Math.min(1, i / overlap);
      data[i] = i < overlap ? raw[i] * mix + raw[data.length + i] * (1 - mix) : raw[i];
    }
    return buffer;
  }

  private white(seconds: number): AudioBuffer {
    const buffer = this.buffer(seconds);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** A single dry tick of splitting wood: a burst of noise that dies away within milliseconds. */
  private tick(): AudioBuffer {
    const buffer = this.buffer(0.012);
    snap(buffer.getChannelData(0), 0, buffer.sampleRate, 0.00025 + Math.random() * 0.0006, 1);
    return finish(buffer);
  }

  /** Two to four ticks in a quick row, the way wood cracks along its grain. */
  private snap(): AudioBuffer {
    const buffer = this.buffer(0.04);
    const data = buffer.getChannelData(0);
    const count = 2 + Math.floor(Math.random() * 3);
    let at = 0;
    for (let k = 0; k < count; k++) {
      snap(data, Math.floor(at * buffer.sampleRate), buffer.sampleRate, 0.0003 + Math.random() * 0.0005, 0.75 ** k);
      at += 0.002 + Math.random() * 0.007;
    }
    return finish(buffer);
  }

  /** A pop of resin: a sharp click with a short, woody knock behind it. */
  private pop(): AudioBuffer {
    const buffer = this.buffer(0.07);
    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    snap(data, 0, rate, 0.0005, 1);
    const knock = 250 + Math.random() * 250;
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      low = 0.85 * low + 0.15 * (Math.random() * 2 - 1);
      data[i] += Math.exp(-t / 0.008) * (0.9 * low + 0.35 * Math.sin(2 * Math.PI * knock * t));
    }
    return finish(buffer);
  }
}

/** Adds one tick at `from`: noise under a fast decay, slightly brightened. */
function snap(data: Float32Array, from: number, rate: number, decay: number, loudness: number) {
  let previous = 0;
  for (let i = from; i < data.length; i++) {
    const envelope = Math.exp(-(i - from) / rate / decay);
    if (envelope < 0.0005) break;
    const noise = Math.random() * 2 - 1;
    data[i] += loudness * envelope * (noise - 0.5 * previous);
    previous = noise;
  }
}

/** Scales a grain to a peak of 1 and lets its very end fade to silence. */
function finish(buffer: AudioBuffer): AudioBuffer {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (const x of data) peak = Math.max(peak, Math.abs(x));
  const fade = Math.floor(0.003 * buffer.sampleRate);
  for (let i = 0; i < data.length; i++) {
    const tail = Math.min(1, (data.length - 1 - i) / fade);
    data[i] = (data[i] / (peak || 1)) * tail;
  }
  return buffer;
}
