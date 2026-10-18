import { Fire } from "./fire";

export type Mood = "night" | "day";

/** Seconds per quarter note. The tune is a waltz; the night drags it out. */
const BEAT: Record<Mood, number> = { night: 0.96, day: 0.72 };

type Chord = "Dm" | "Bb" | "Gm" | "A" | "F" | "C";

/** Three pad voices per chord as MIDI notes, voiced to move in small steps. */
const VOICING: Record<Chord, [number, number, number]> = {
  Dm: [50, 57, 65],
  Bb: [50, 58, 65],
  Gm: [50, 58, 67],
  A: [49, 57, 64],
  F: [48, 57, 65],
  C: [48, 55, 64],
};

/**
 * One chord per bar. The night stays in D minor; the day puts the same tune
 * over its relative major, which sounds lighter without changing a note.
 */
const HARMONY: Record<Mood, Chord[]> = {
  night: ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A", "Dm", "Dm", "Bb", "Bb", "Gm", "A", "Dm", "Dm"],
  day: ["F", "F", "Bb", "Bb", "C", "C", "A", "A", "F", "F", "Bb", "Bb", "C", "A", "F", "F"],
};

/** The melody: one bar per row, one MIDI note per beat, 0 = let it ring. */
const TUNE: [number, number, number][] = [
  [69, 74, 77],
  [76, 0, 74],
  [74, 77, 82],
  [81, 0, 0],
  [79, 77, 74],
  [74, 0, 70],
  [69, 73, 76],
  [76, 0, 0],
  [77, 76, 74],
  [69, 0, 0],
  [70, 74, 77],
  [79, 0, 77],
  [70, 74, 79],
  [77, 76, 73],
  [74, 0, 0],
  [0, 0, 0],
];

interface Mix {
  pad: number;
  /** A pad voice an octave below the chord, for weight. */
  sub: number;
  /** Low-pass on the pad in Hz: lower is darker. */
  cutoff: number;
  wind: number;
  box: number;
  bell: number;
  crickets: number;
  howls: number;
  /** The melody is moved by this many semitones. */
  shift: number;
  /** How far the music box drifts out of tune and back, in cents, like an old one. */
  warble: number;
  /** The campfire: roar, hiss and crackling wood. */
  fire: number;
}

/** How loud and how bright each layer is in the two moods. */
const MIX: Record<Mood, Mix> = {
  night: {
    pad: 0.42,
    sub: 0.1,
    cutoff: 470,
    wind: 0.2,
    box: 0.46,
    bell: 0.22,
    crickets: 0.03,
    howls: 1,
    shift: -12,
    warble: 6,
    fire: 2,
  },
  day: { pad: 0.26, sub: 0, cutoff: 1250, wind: 0, box: 0.2, bell: 0, crickets: 0, howls: 0, shift: 0, warble: 0, fire: 0 },
};

/** How far ahead `schedule` queues notes, in seconds. */
const AHEAD = 1;

/** Seconds the fire keeps crackling after daybreak, while it fades out. */
const EMBERS = 5;

/** Seconds from nightfall to the first howl, and between howls after that. */
const FIRST_HOWL = { after: 9, spread: 8 };
const NEXT_HOWL = { after: 35, spread: 30 };

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * The background music, generated on the fly: a slow pad that glides from
 * chord to chord and a music-box melody with an echo. The night plays it
 * lower and slower on a slightly warped music box, with wind, crickets, the
 * campfire, a distant bell and now and then a wolf howling far away. Works
 * on any audio context, so it can be rendered offline.
 */
export class Music {
  private readonly out: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private readonly padLevel: GainNode;
  private readonly padVoices: OscillatorNode[][] = [];
  private readonly subLevel: GainNode;
  private readonly subVoice: OscillatorNode[];
  private readonly windLevel: GainNode;
  private readonly cricketLevel: GainNode;
  private readonly boxLevel: GainNode;
  private readonly bellLevel: GainNode;
  private readonly howlLevel: GainNode;
  private readonly warble: GainNode;
  private readonly fire: Fire;
  private readonly running: AudioScheduledSourceNode[] = [];
  private mood: Mood;
  /** Until when the fire still crackles after the night has ended. */
  private embersUntil = 0;
  private bar = 0;
  private nextBarAt: number;
  private nextHowlAt: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    mood: Mood,
    startAt: number,
  ) {
    this.mood = mood;
    this.nextBarAt = startAt + 0.1;
    this.nextHowlAt = startAt + FIRST_HOWL.after + Math.random() * FIRST_HOWL.spread;
    const mix = MIX[mood];
    const chord = VOICING[HARMONY[mood][0]];

    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, startAt);
    this.out.gain.linearRampToValueAtTime(1, startAt + 2.5);
    this.out.connect(destination);

    // Pad: two slightly detuned saws per voice, darkened by a low-pass.
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.Q.value = 0.7;
    this.padFilter.frequency.value = mix.cutoff;
    this.padLevel = ctx.createGain();
    this.padLevel.gain.value = mix.pad;
    this.padFilter.connect(this.padLevel).connect(this.out);
    this.lfo(0.05, 140, startAt).connect(this.padFilter.frequency);
    const saws = (midi: number, into: AudioNode) =>
      [-7, 7].map((cents) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = hz(midi);
        osc.detune.value = cents;
        osc.connect(into);
        this.start(osc, startAt);
        return osc;
      });
    for (const midi of chord) {
      const voice = ctx.createGain();
      voice.gain.value = 0.11;
      voice.connect(this.padFilter);
      this.padVoices.push(saws(midi, voice));
    }
    this.subLevel = ctx.createGain();
    this.subLevel.gain.value = mix.sub;
    this.subLevel.connect(this.padFilter);
    this.subVoice = saws(chord[0] - 12, this.subLevel);

    // Wind: soft noise through a band-pass that wanders up and down.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise(3);
    noise.loop = true;
    const whistle = ctx.createBiquadFilter();
    whistle.type = "bandpass";
    whistle.Q.value = 5;
    whistle.frequency.value = 620;
    this.lfo(0.07, 260, startAt).connect(whistle.frequency);
    const gust = ctx.createGain();
    gust.gain.value = 0.55;
    this.lfo(0.11, 0.4, startAt).connect(gust.gain);
    this.windLevel = ctx.createGain();
    this.windLevel.gain.value = mix.wind;
    noise.connect(whistle).connect(gust).connect(this.windLevel).connect(this.out);
    this.start(noise, startAt);

    const chirping = ctx.createBufferSource();
    chirping.buffer = this.crickets(9);
    chirping.loop = true;
    this.cricketLevel = ctx.createGain();
    this.cricketLevel.gain.value = mix.crickets;
    chirping.connect(this.cricketLevel).connect(this.out);
    this.start(chirping, startAt);

    this.fire = new Fire(ctx, this.out, mix.fire, startAt);
    this.warble = this.lfo(0.21, mix.warble, startAt);

    // Music box, bell and howls share an echo that makes the night feel wide.
    this.boxLevel = ctx.createGain();
    this.boxLevel.gain.value = mix.box;
    this.bellLevel = ctx.createGain();
    this.bellLevel.gain.value = mix.bell;
    this.howlLevel = ctx.createGain();
    this.howlLevel.gain.value = mix.howls;
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.54;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    echo.connect(damp).connect(feedback).connect(echo);
    damp.connect(wet).connect(this.out);
    for (const dry of [this.boxLevel, this.bellLevel, this.howlLevel]) {
      dry.connect(this.out);
      dry.connect(echo);
    }
  }

  /** Cross-fades the layers to another mood; chords and tempo follow at the next bar. */
  setMood(mood: Mood, at: number) {
    if (mood === this.mood) return;
    if (mood === "night") this.nextHowlAt = at + FIRST_HOWL.after + Math.random() * FIRST_HOWL.spread;
    else this.embersUntil = at + EMBERS;
    this.mood = mood;
    const mix = MIX[mood];
    const fade = (param: AudioParam, value: number) => param.setTargetAtTime(value, at, 0.9);
    fade(this.padLevel.gain, mix.pad);
    fade(this.subLevel.gain, mix.sub);
    fade(this.padFilter.frequency, mix.cutoff);
    fade(this.windLevel.gain, mix.wind);
    fade(this.cricketLevel.gain, mix.crickets);
    fade(this.boxLevel.gain, mix.box);
    fade(this.bellLevel.gain, mix.bell);
    fade(this.howlLevel.gain, mix.howls);
    fade(this.warble.gain, mix.warble);
    this.fire.level.gain.setTargetAtTime(mix.fire, at, 1.2);
  }

  /** Queues everything that starts within the next second. Call this regularly with the current time. */
  schedule(now: number) {
    const until = now + AHEAD;
    // After a stall the music picks up from now instead of playing the missed bars at once.
    if (this.nextBarAt < now) this.nextBarAt = now + 0.05;
    this.fire.schedule(now, until, this.mood === "night" ? Infinity : this.embersUntil);
    while (this.nextBarAt < until) {
      const at = this.nextBarAt;
      const beat = BEAT[this.mood];
      const night = this.mood === "night";
      const chord = VOICING[HARMONY[this.mood][this.bar]];
      const glide = (osc: OscillatorNode, midi: number) => osc.frequency.setTargetAtTime(hz(midi), at, 0.22);
      this.padVoices.forEach((voice, i) => voice.forEach((osc) => glide(osc, chord[i])));
      this.subVoice.forEach((osc) => glide(osc, chord[0] - 12));
      TUNE[this.bar].forEach((midi, i) => {
        if (midi) this.chime(hz(midi + MIX[this.mood].shift), at + i * beat, night);
      });
      if (this.bar === 0) this.toll(hz(62), at);
      if (night && at >= this.nextHowlAt) {
        this.pack(at + Math.random() * 3 * beat);
        this.nextHowlAt = at + NEXT_HOWL.after + Math.random() * NEXT_HOWL.spread;
      }
      this.bar = (this.bar + 1) % TUNE.length;
      this.nextBarAt += 3 * beat;
    }
  }

  /** Fades out and releases every node. The instance is finished afterwards. */
  stop(at: number) {
    // Not every browser can hold a ramp that is still running.
    if (this.out.gain.cancelAndHoldAtTime) this.out.gain.cancelAndHoldAtTime(at);
    else this.out.gain.cancelScheduledValues(at);
    this.out.gain.setTargetAtTime(0, at, 0.25);
    for (const source of this.running) source.stop(at + 1.5);
    this.fire.stop(at + 1.5);
    setTimeout(() => this.out.disconnect(), 2000);
  }

  private start(source: AudioScheduledSourceNode, at: number) {
    source.start(at);
    this.running.push(source);
  }

  private lfo(rate: number, depth: number, at: number): GainNode {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = this.ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount);
    this.start(osc, at);
    return amount;
  }

  private buffer(seconds: number): AudioBuffer {
    return this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
  }

  /** A few seconds of soft, low-heavy noise to loop. */
  private noise(seconds: number): AudioBuffer {
    const buffer = this.buffer(seconds);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      data[i] = last * 9;
    }
    return buffer;
  }

  /**
   * A loop of three crickets, each with its own pitch and pace. A chirp is
   * three quick pulses of a high tone, and now and then a cricket rests.
   */
  private crickets(seconds: number): AudioBuffer {
    const buffer = this.buffer(seconds);
    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const pulse = Math.floor(0.02 * rate);
    for (const [pitch, every, loudness] of [
      [4350, 0.62, 1],
      [4900, 0.47, 0.55],
      [3980, 0.83, 0.4],
    ]) {
      // Stops early enough that no chirp is cut off where the loop repeats.
      for (let t = Math.random() * every; t < seconds - 0.12; ) {
        for (let k = 0; k < 3; k++) {
          const from = Math.floor((t + k * 0.032) * rate);
          for (let i = 0; i < pulse; i++) {
            const swell = Math.sin((Math.PI * i) / pulse) ** 2;
            data[from + i] += loudness * swell * Math.sin((2 * Math.PI * pitch * i) / rate);
          }
        }
        const rest = Math.random() < 0.08 ? 1 + Math.random() * 1.5 : 0;
        t += every * (0.92 + Math.random() * 0.16) + rest;
      }
    }
    return buffer;
  }

  /** One decaying sine partial; `bend` moves its pitch, in cents. */
  private partial(to: AudioNode, freq: number, at: number, peak: number, decay: number, bend?: AudioNode) {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = freq;
    if (bend) {
      bend.connect(osc.detune);
      // Lets the finished note go; the drift keeps running for the next ones.
      osc.onended = () => bend.disconnect(osc.detune);
    }
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(env).connect(to);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  /**
   * A music-box note. By day it has a short glassy overtone on top; the dark
   * version leaves that out, rings longer and drifts slightly out of tune.
   */
  private chime(freq: number, at: number, dark: boolean) {
    const bend = dark ? this.warble : undefined;
    this.partial(this.boxLevel, freq, at, 0.5, dark ? 2.8 : 1.9, bend);
    this.partial(this.boxLevel, freq * 2.003, at, dark ? 0.2 : 0.16, dark ? 1.4 : 1.0, bend);
    if (!dark) this.partial(this.boxLevel, freq * 4.2, at, 0.05, 0.25);
  }

  /** A distant church bell, with the minor-third overtone bells have. */
  private toll(freq: number, at: number) {
    const partials: [number, number, number][] = [
      [0.5, 0.3, 6],
      [1, 0.5, 5],
      [1.2, 0.3, 4],
      [1.5, 0.18, 3],
      [2, 0.22, 2.5],
      [2.51, 0.1, 1.6],
      [3.01, 0.07, 1.1],
    ];
    for (const [ratio, peak, decay] of partials) {
      this.partial(this.bellLevel, freq * ratio, at, peak, decay);
    }
  }

  /** One wolf howls, and often a second one answers a moment later. */
  private pack(at: number) {
    this.howl(at, hz(62), hz(69), 0.04);
    if (Math.random() < 0.6) {
      const answer = at + 1.5 + Math.random() * 0.9;
      if (Math.random() < 0.5) this.howl(answer, hz(57), hz(65), 0.027);
      else this.howl(answer, hz(65), hz(74), 0.023);
    }
  }

  /**
   * A howl: the pitch climbs from `from` to `to`, hangs there with a slight
   * tremble and sinks again. Muffled, so that it seems to come from far away.
   */
  private howl(at: number, from: number, to: number, level: number) {
    const length = 4.2 + Math.random() * 1.2;
    const risen = at + 0.9;
    const held = at + length * 0.62;
    const end = at + length;
    const tune = 1 + (Math.random() - 0.5) * 0.03;

    // Fades slowly at first, so that the sinking pitch is still heard.
    const voice = this.ctx.createGain();
    voice.gain.setValueAtTime(0, at);
    voice.gain.linearRampToValueAtTime(level, at + 0.7);
    voice.gain.setValueAtTime(level, held);
    voice.gain.linearRampToValueAtTime(level * 0.4, held + (end - held) * 0.65);
    voice.gain.exponentialRampToValueAtTime(0.0001, end);
    const far = this.ctx.createBiquadFilter();
    far.type = "lowpass";
    far.frequency.value = 900;
    voice.connect(far).connect(this.howlLevel);

    const tremble = this.ctx.createOscillator();
    tremble.frequency.value = 5.5;
    tremble.start(risen);
    tremble.stop(end + 0.05);

    // The fundamental and two fainter overtones follow the same curve.
    [1, 0.3, 0.1].forEach((share, i) => {
      const harmonic = (i + 1) * tune;
      const osc = this.ctx.createOscillator();
      osc.frequency.setValueAtTime(from * harmonic, at);
      osc.frequency.exponentialRampToValueAtTime(to * harmonic, risen);
      osc.frequency.linearRampToValueAtTime(to * 1.03 * harmonic, held);
      osc.frequency.exponentialRampToValueAtTime(to * 0.78 * harmonic, end);
      const depth = this.ctx.createGain();
      depth.gain.setValueAtTime(0, risen);
      depth.gain.linearRampToValueAtTime(4 * harmonic, risen + 0.9);
      tremble.connect(depth).connect(osc.frequency);
      const part = this.ctx.createGain();
      part.gain.value = share;
      osc.connect(part).connect(voice);
      osc.start(at);
      osc.stop(end + 0.05);
    });
  }
}
