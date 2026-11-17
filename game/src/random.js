// A small seeded random generator (mulberry32). The world owns one instance, so a shot
// scene with a fixed seed replays exactly, and live play seeds it from the clock instead.

/** Create a generator from a 32-bit seed; the same seed always gives the same stream. */
export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** A random element of the array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** A random point on the arena edge, kept off the corners: where enemies enter. */
    edgePoint(width, height, margin) {
      const side = Math.floor(next() * 4);
      if (side === 0) return { x: margin + next() * (width - 2 * margin), y: margin };
      if (side === 1) return { x: margin + next() * (width - 2 * margin), y: height - margin };
      if (side === 2) return { x: margin, y: margin + next() * (height - 2 * margin) };
      return { x: width - margin, y: margin + next() * (height - 2 * margin) };
    },
  };
}
