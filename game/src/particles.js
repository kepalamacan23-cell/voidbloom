// Particles and floating score text: the juice. Every hit, explosion, pickup and dash
// leaves something moving on screen, and every kill prints its points where it happened.
// One pooled list, updated by the world step and drawn by the renderer, so effects stay
// deterministic under a fixed seed like everything else in the simulation.

const MAX_PARTICLES = 900;

export class Particles {
  constructor(rng) {
    this.rng = rng;
    this.list = [];
    this.texts = [];
  }

  clear() {
    this.list.length = 0;
    this.texts.length = 0;
  }

  #push(particle) {
    if (this.list.length < MAX_PARTICLES) this.list.push(particle);
  }

  /** A radial burst of sparks in one colour: hits, deaths, pickups. */
  burst(x, y, color, count, speed = 260, life = 0.5, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const pace = this.rng.range(speed * 0.25, speed);
      this.#push({
        kind: 'spark',
        x, y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: this.rng.range(life * 0.5, life),
        age: 0,
        size: this.rng.range(size * 0.5, size * 1.4),
        color,
        drag: 3.2,
      });
    }
  }

  /** An expanding ring: explosions and the nova shockwave. */
  ring(x, y, color, maxRadius = 90, life = 0.4, width = 4) {
    this.#push({ kind: 'ring', x, y, vx: 0, vy: 0, life, age: 0, size: maxRadius, color, width, drag: 0 });
  }

  /** A short fading streak behind a fast thing: engine trail, dash afterimage feed. */
  trail(x, y, color, size = 8, life = 0.3) {
    this.#push({ kind: 'glow', x, y, vx: 0, vy: 0, life, age: 0, size, color, drag: 0 });
  }

  /** A chunk of debris that tumbles and slows: the bigger half of an explosion. */
  debris(x, y, color, count = 5) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const pace = this.rng.range(60, 300);
      this.#push({
        kind: 'shard',
        x, y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: this.rng.range(0.4, 0.9),
        age: 0,
        size: this.rng.range(3, 8),
        color,
        spin: this.rng.range(-9, 9),
        angle: angle,
        drag: 1.6,
      });
    }
  }

  /** Rising points text at a kill, tinted by how much the combo paid. */
  scoreText(x, y, text, color) {
    this.texts.push({ x, y, text, color, age: 0, life: 0.9 });
    if (this.texts.length > 40) this.texts.shift();
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.angle !== undefined) p.angle += p.spin * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.age += dt;
      t.y -= 44 * dt;
      if (t.age >= t.life) this.texts.splice(i, 1);
    }
  }
}
