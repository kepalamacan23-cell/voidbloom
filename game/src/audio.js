// All of VOIDBLOOM's sound is synthesised here with WebAudio oscillators and filtered
// noise: no audio files, nothing to load. Effects are one-shot voices on a master gain;
// the music is a small step sequencer pulsing a bass line under the fight. The context
// opens on the first user gesture, as browsers require, and M mutes everything.

const BASS_LINE = [55, 55, 82.41, 55, 65.41, 55, 98, 73.42]; // A1 pattern, Hz
const ARP_NOTES = [440, 554.37, 659.25, 880, 659.25, 554.37]; // A major sparkle, Hz

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
  }

  /** Create or resume the context; call from a click or key handler. Safe to repeat. */
  unlock() {
    if (this.ctx === null) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** One oscillator voice with an exponential decay envelope. */
  #tone({ type = 'sine', from = 440, to = null, seconds = 0.15, gain = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  /** One burst of filtered noise: explosions, dash whooshes, nova wash. */
  #noise({ seconds = 0.25, gain = 0.3, from = 3000, to = 200, type = 'lowpass', delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + seconds);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  shoot() {
    this.#tone({ type: 'square', from: 920, to: 480, seconds: 0.06, gain: 0.05 });
  }

  enemyHit() {
    this.#tone({ type: 'triangle', from: 300, to: 190, seconds: 0.05, gain: 0.07 });
  }

  explosion(big) {
    this.#noise({ seconds: big ? 0.5 : 0.25, gain: big ? 0.5 : 0.28, from: 2600, to: 120 });
    this.#tone({ type: 'sine', from: big ? 160 : 200, to: 40, seconds: big ? 0.45 : 0.25, gain: 0.3 });
  }

  playerHurt() {
    this.#tone({ type: 'sawtooth', from: 240, to: 55, seconds: 0.3, gain: 0.3 });
    this.#noise({ seconds: 0.18, gain: 0.2, from: 1800, to: 300 });
  }

  shieldBreak() {
    this.#tone({ type: 'sine', from: 1250, to: 300, seconds: 0.22, gain: 0.22 });
    this.#noise({ seconds: 0.15, gain: 0.12, from: 3200, to: 900, type: 'highpass' });
  }

  pickup() {
    this.#tone({ type: 'sine', from: 660, seconds: 0.09, gain: 0.18 });
    this.#tone({ type: 'sine', from: 990, seconds: 0.14, gain: 0.18, delay: 0.07 });
  }

  dash() {
    this.#noise({ seconds: 0.18, gain: 0.16, from: 500, to: 3400, type: 'bandpass' });
  }

  nova() {
    this.#noise({ seconds: 0.8, gain: 0.5, from: 400, to: 5200, type: 'bandpass' });
    this.#tone({ type: 'sine', from: 90, to: 34, seconds: 0.8, gain: 0.45 });
    this.#tone({ type: 'triangle', from: 1200, to: 2400, seconds: 0.4, gain: 0.1 });
  }

  waveStart() {
    this.#tone({ type: 'triangle', from: 392, seconds: 0.1, gain: 0.16 });
    this.#tone({ type: 'triangle', from: 523.25, seconds: 0.1, gain: 0.16, delay: 0.09 });
    this.#tone({ type: 'triangle', from: 783.99, seconds: 0.18, gain: 0.16, delay: 0.18 });
  }

  gameOver() {
    this.#tone({ type: 'triangle', from: 392, to: 380, seconds: 0.25, gain: 0.2 });
    this.#tone({ type: 'triangle', from: 311, to: 300, seconds: 0.25, gain: 0.2, delay: 0.22 });
    this.#tone({ type: 'triangle', from: 233, to: 110, seconds: 0.6, gain: 0.22, delay: 0.44 });
  }

  uiClick() {
    this.#tone({ type: 'sine', from: 740, seconds: 0.06, gain: 0.12 });
  }

  /** Start the sequencer: an eighth-note bass pulse with a sparse arp on top. */
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.musicTimer = window.setInterval(() => this.#scheduleMusic(), 40);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  #scheduleMusic() {
    if (!this.ctx) return;
    const stepSeconds = 60 / 132 / 2; // 132 bpm eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const delay = Math.max(0, this.nextNoteTime - this.ctx.currentTime);
      const step = this.musicStep;
      const bass = BASS_LINE[step % BASS_LINE.length];
      this.#tone({ type: 'triangle', from: bass, seconds: 0.16, gain: 0.11, delay });
      if (step % 4 === 2) {
        const arp = ARP_NOTES[(step >> 2) % ARP_NOTES.length];
        this.#tone({ type: 'sine', from: arp, seconds: 0.2, gain: 0.035, delay });
      }
      this.nextNoteTime += stepSeconds;
      this.musicStep += 1;
    }
  }
}
