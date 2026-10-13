import { CLIPS, type ClipId, clipUrl } from "./clips";
import { type Mood, Music } from "./music";

/** Music level while the narrator speaks, relative to normal. */
const DUCKED = 0.22;

type AudioSession = { type: string };

/**
 * Everything the game plays: narrator recordings, the fallback voice of the
 * device for lines that have not been recorded yet, and the music.
 *
 * Browsers only let a page make sound after a tap, so `wake` has to be
 * called from a tap handler once; everything after that may be automatic.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private music: Music | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private wanted: Mood | null = null;
  private awake = false;
  private readonly clips = new Map<ClipId, Promise<ArrayBuffer | null>>();
  private voice: AudioBufferSourceNode | null = null;
  /** Counts narrations, so a slow one cannot talk over a newer one. */
  private turn = 0;

  /** Starts or resumes audio. Must run inside a tap or click handler. */
  wake() {
    if (typeof window === "undefined") return;
    if (this.awake && this.ctx?.state === "running") return;
    if (!this.awake) this.primeSpeech();
    this.awake = true;
    if (!this.ctx) this.build();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== "running") void ctx.resume().then(() => this.sync());
    for (const id of Object.keys(CLIPS) as ClipId[]) void this.load(id);
    this.sync();
  }

  /** Silences everything and lets the audio hardware rest. */
  sleep() {
    this.awake = false;
    this.hush();
    this.wanted = null;
    this.sync();
    // Suspending right away would cut off the fade-out.
    const ctx = this.ctx;
    setTimeout(() => {
      if (!this.awake && ctx?.state === "running") void ctx.suspend();
    }, 1800);
  }

  /** Which music should play, or null for none. */
  setMusic(mood: Mood | null) {
    this.wanted = mood;
    this.sync();
  }

  /** Plays a narrator recording, or reads `fallback` if there is none. */
  async narrate(id: ClipId, fallback: string) {
    const turn = ++this.turn;
    this.hush();
    const ctx = this.ctx;
    if (!ctx || !this.voiceBus || ctx.state !== "running") return;

    const bytes = await this.load(id);
    if (turn !== this.turn) return;
    if (bytes) {
      try {
        // Decoding empties the buffer it is given, so it gets a copy.
        const audio = await decode(ctx, bytes.slice(0));
        if (turn !== this.turn) return;
        const source = ctx.createBufferSource();
        source.buffer = audio;
        source.connect(this.voiceBus);
        source.onended = () => {
          if (this.voice === source) {
            this.voice = null;
            this.duck(false);
          }
        };
        this.voice = source;
        this.duck(true);
        source.start();
        return;
      } catch {
        // Not a format this browser can play: treat it like a missing file.
        this.clips.set(id, Promise.resolve(null));
      }
    }
    this.speak(fallback);
  }

  private build() {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    // Without this an iPhone stays silent while its mute switch is on.
    const session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
    if (session) session.type = "playback";

    const ctx = new Ctor();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    limiter.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(limiter);
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1.15;
    this.voiceBus.connect(limiter);
    this.ctx = ctx;

    ctx.onstatechange = () => this.sync();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void ctx.suspend();
      else if (this.awake) void ctx.resume();
    });
  }

  /** Brings the music in line with what is wanted and what is possible. */
  private sync() {
    const { ctx, musicBus } = this;
    const mood = ctx?.state === "running" ? this.wanted : null;
    if (!ctx || !musicBus) return;

    if (mood && !this.music) {
      const music = new Music(ctx, musicBus, mood, ctx.currentTime);
      this.music = music;
      const tick = () => music.schedule(ctx.currentTime + 1);
      tick();
      this.ticker = setInterval(tick, 250);
    } else if (mood && this.music) {
      this.music.setMood(mood, ctx.currentTime);
    } else if (!this.wanted && this.music) {
      if (this.ticker) clearInterval(this.ticker);
      this.ticker = null;
      this.music.stop(ctx.currentTime);
      this.music = null;
    }
  }

  private load(id: ClipId): Promise<ArrayBuffer | null> {
    let clip = this.clips.get(id);
    if (!clip) {
      const url = clipUrl(id);
      clip = url
        ? fetch(url)
            .then((res) => (res.ok ? res.arrayBuffer() : null))
            // Offline or blocked: the fallback voice takes over.
            .catch(() => null)
        : Promise.resolve(null);
      this.clips.set(id, clip);
    }
    return clip;
  }

  private duck(down: boolean) {
    if (!this.ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(down ? DUCKED : 1, this.ctx.currentTime, down ? 0.08 : 0.5);
  }

  /** Stops whatever the narrator is saying right now. */
  private hush() {
    if (this.voice) {
      this.voice.onended = null;
      this.voice.stop();
      this.voice = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.duck(false);
  }

  private speak(text: string) {
    if (!("speechSynthesis" in window) || !text) return;
    const synth = window.speechSynthesis;
    const line = new SpeechSynthesisUtterance(text);
    line.lang = "de-DE";
    line.rate = 0.95;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("de"));
    if (voice) line.voice = voice;
    line.onstart = () => this.duck(true);
    line.onend = line.onerror = () => this.duck(false);
    synth.speak(line);
  }

  /** Phones only let a page talk on its own after it once spoke on a tap. */
  private primeSpeech() {
    if (!("speechSynthesis" in window)) return;
    const silent = new SpeechSynthesisUtterance("Ton an");
    silent.lang = "de-DE";
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
  }
}

function decode(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  // The callback form also works on older iPhones.
  return new Promise((resolve, reject) => {
    // Newer browsers also return a promise; its failure is already handled.
    ctx.decodeAudioData(bytes, resolve, reject)?.catch(() => {});
  });
}

export const sound = new SoundEngine();
