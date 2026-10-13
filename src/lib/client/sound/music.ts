export type Mood = "night" | "day";

/** Seconds per quarter note. The tune is a slow waltz, three beats to a bar. */
const BEAT = 0.72;
const BAR = 3 * BEAT;

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

/** How loud and how bright each layer is in the two moods. */
const MIX: Record<Mood, { pad: number; cutoff: number; wind: number; box: number; bell: number }> = {
  night: { pad: 0.42, cutoff: 620, wind: 0.26, box: 0.42, bell: 0.22 },
  day: { pad: 0.26, cutoff: 1250, wind: 0, box: 0.2, bell: 0 },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * The background music, generated on the fly: a slow pad that glides from
 * chord to chord, a music-box melody with an echo, and at night wind and a
 * distant bell. Works on any audio context, so it can be rendered offline.
 */
export class Music {
  private readonly out: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private readonly padLevel: GainNode;
  private readonly padVoices: OscillatorNode[][] = [];
  private readonly windLevel: GainNode;
  private readonly boxLevel: GainNode;
  private readonly bellLevel: GainNode;
  private readonly running: AudioScheduledSourceNode[] = [];
  private mood: Mood;
  private bar = 0;
  private nextBarAt: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    mood: Mood,
    startAt: number,
  ) {
    this.mood = mood;
    this.nextBarAt = startAt + 0.1;
    const mix = MIX[mood];

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
    const sweep = this.lfo(0.05, 140, startAt);
    sweep.connect(this.padFilter.frequency);
    for (const midi of VOICING[HARMONY[mood][0]]) {
      const voice = ctx.createGain();
      voice.gain.value = 0.11;
      voice.connect(this.padFilter);
      this.padVoices.push(
        [-7, 7].map((cents) => {
          const osc = ctx.createOscillator();
          osc.type = "sawtooth";
          osc.frequency.value = hz(midi);
          osc.detune.value = cents;
          osc.connect(voice);
          this.start(osc, startAt);
          return osc;
        }),
      );
    }

    // Wind: soft noise through a band-pass that wanders up and down.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise(3);
    noise.loop = true;
    const howl = ctx.createBiquadFilter();
    howl.type = "bandpass";
    howl.Q.value = 5;
    howl.frequency.value = 620;
    this.lfo(0.07, 260, startAt).connect(howl.frequency);
    const gust = ctx.createGain();
    gust.gain.value = 0.55;
    this.lfo(0.11, 0.4, startAt).connect(gust.gain);
    this.windLevel = ctx.createGain();
    this.windLevel.gain.value = mix.wind;
    noise.connect(howl).connect(gust).connect(this.windLevel).connect(this.out);
    this.start(noise, startAt);

    // Music box and bell share an echo that makes the room feel large.
    this.boxLevel = ctx.createGain();
    this.boxLevel.gain.value = mix.box;
    this.bellLevel = ctx.createGain();
    this.bellLevel.gain.value = mix.bell;
    const echo = ctx.createDelay(1);
    echo.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    echo.connect(damp).connect(feedback).connect(echo);
    damp.connect(wet).connect(this.out);
    for (const dry of [this.boxLevel, this.bellLevel]) {
      dry.connect(this.out);
      dry.connect(echo);
    }
  }

  /** Cross-fades the layers to another mood; the chords follow at the next bar. */
  setMood(mood: Mood, at: number) {
    this.mood = mood;
    const mix = MIX[mood];
    this.padLevel.gain.setTargetAtTime(mix.pad, at, 0.9);
    this.padFilter.frequency.setTargetAtTime(mix.cutoff, at, 0.9);
    this.windLevel.gain.setTargetAtTime(mix.wind, at, 0.9);
    this.boxLevel.gain.setTargetAtTime(mix.box, at, 0.9);
    this.bellLevel.gain.setTargetAtTime(mix.bell, at, 0.9);
  }

  /** Queues every bar that starts before `until`. Call this regularly. */
  schedule(until: number) {
    while (this.nextBarAt < until) {
      const at = this.nextBarAt;
      const chord = VOICING[HARMONY[this.mood][this.bar]];
      this.padVoices.forEach((voice, i) => {
        for (const osc of voice) osc.frequency.setTargetAtTime(hz(chord[i]), at, 0.22);
      });
      TUNE[this.bar].forEach((midi, beat) => {
        if (midi) this.chime(hz(midi), at + beat * BEAT);
      });
      if (this.bar === 0) this.toll(hz(62), at);
      this.bar = (this.bar + 1) % TUNE.length;
      this.nextBarAt += BAR;
    }
  }

  /** Fades out and releases every node. The instance is finished afterwards. */
  stop(at: number) {
    // Not every browser can hold a ramp that is still running.
    if (this.out.gain.cancelAndHoldAtTime) this.out.gain.cancelAndHoldAtTime(at);
    else this.out.gain.cancelScheduledValues(at);
    this.out.gain.setTargetAtTime(0, at, 0.25);
    for (const source of this.running) source.stop(at + 1.5);
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

  /** A few seconds of soft, low-heavy noise to loop. */
  private noise(seconds: number): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      data[i] = last * 9;
    }
    return buffer;
  }

  /** One decaying sine partial. */
  private partial(to: AudioNode, freq: number, at: number, peak: number, decay: number) {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(env).connect(to);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  /** A music-box note: a clear tone with a short glassy overtone on top. */
  private chime(freq: number, at: number) {
    this.partial(this.boxLevel, freq, at, 0.5, 1.9);
    this.partial(this.boxLevel, freq * 2.003, at, 0.16, 1.0);
    this.partial(this.boxLevel, freq * 4.2, at, 0.05, 0.25);
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
}
