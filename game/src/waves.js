// The wave director: what each wave is made of and how it arrives. A wave is a shuffled
// queue of enemy kinds, dealt out from the arena edges on a timer that tightens as the
// wave grows, so pressure builds inside a wave as well as across waves. New kinds join
// on a schedule the player can learn: Lancers from wave 2, Orbiters from wave 3, the
// first Bulwark on wave 4 and more after that.

import { KIND_BULWARK, KIND_LANCER, KIND_MOTE, KIND_ORBITER } from './enemies.js';

/** The roster of one wave: counts per kind, before shuffling. */
export function waveComposition(wave) {
  const motes = 6 + wave * 2;
  const lancers = wave >= 2 ? 1 + Math.floor(wave * 0.9) : 0;
  const orbiters = wave >= 3 ? Math.floor((wave - 1) * 0.8) : 0;
  const bulwarks = wave >= 4 ? 1 + Math.floor((wave - 4) / 2) : 0;
  return { motes, lancers, orbiters, bulwarks };
}

export function waveSize(wave) {
  const c = waveComposition(wave);
  return c.motes + c.lancers + c.orbiters + c.bulwarks;
}

export class WaveDirector {
  constructor(rng) {
    this.rng = rng;
    this.queue = [];
    this.spawnTimer = 0;
    this.wave = 0;
  }

  /** Build the shuffled spawn queue for a wave. */
  startWave(wave) {
    this.wave = wave;
    const c = waveComposition(wave);
    const kinds = [];
    for (let i = 0; i < c.motes; i += 1) kinds.push(KIND_MOTE);
    for (let i = 0; i < c.lancers; i += 1) kinds.push(KIND_LANCER);
    for (let i = 0; i < c.orbiters; i += 1) kinds.push(KIND_ORBITER);
    for (let i = 0; i < c.bulwarks; i += 1) kinds.push(KIND_BULWARK);
    // Shuffle, but never open with a Bulwark: the first thing met is always fair.
    for (let i = kinds.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    while (kinds.length > 1 && kinds[0] === KIND_BULWARK) kinds.push(kinds.shift());
    this.queue = kinds;
    this.spawnTimer = 0.5;
  }

  /** Seconds between spawns: brisk early, a flood late, capped by what's alive. */
  spawnInterval() {
    return Math.max(0.34, 0.85 - this.wave * 0.045);
  }

  get pending() {
    return this.queue.length;
  }

  /** Deal the next kind if the timer and the alive cap allow; otherwise null. */
  nextSpawn(dt, aliveCount) {
    if (this.queue.length === 0) return null;
    this.spawnTimer -= dt;
    const cap = 14 + this.wave * 2;
    if (this.spawnTimer > 0 || aliveCount >= cap) return null;
    this.spawnTimer = this.spawnInterval() * this.rng.range(0.75, 1.25);
    return this.queue.shift();
  }
}
