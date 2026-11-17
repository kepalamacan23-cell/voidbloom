// The VOIDBLOOM simulation: one World holds the player, every enemy, bullet, bolt and
// pickup, and advances them all in fixed steps. It knows nothing of the DOM or of sound;
// it records what happened in `events` (names the audio engine maps to effects) and lets
// render.js draw whatever state it holds. A control object in, a world stepped: that is
// the whole contract, which is what lets shots.js replay a run deterministically.

import { ARENA_MARGIN, CANNON, NOVA, PLAYER, SCORE, VIEW } from './config.js';
import { createEnemy, KIND_BULWARK, updateEnemy } from './enemies.js';
import { Particles } from './particles.js';
import { applyPickup, rollDrop, updatePickups } from './pickups.js';
import { createRng } from './random.js';
import { WaveDirector } from './waves.js';

export class World {
  constructor(seed) {
    this.rng = createRng(seed);
    this.particles = new Particles(this.rng);
    this.director = new WaveDirector(this.rng);
    this.events = [];
    this.reset();
  }

  /** A fresh run: full hull, wave 1 about to begin, nothing on the field. */
  reset() {
    this.time = 0;
    this.phase = 'fighting'; // fighting | intermission | over
    this.wave = 0;
    this.intermissionTimer = 0;
    this.bannerTimer = 0;
    this.bannerText = '';
    this.score = 0;
    this.kills = 0;
    this.timeAlive = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.hurtFlash = 0;
    this.novaFlash = 0;
    this.enemies = [];
    this.bullets = [];
    this.bolts = [];
    this.pickups = [];
    this.particles.clear();
    this.events.length = 0;
    this.player = {
      x: VIEW.width / 2, y: VIEW.height / 2,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      hp: PLAYER.hull, maxHp: PLAYER.hull,
      fireTimer: 0,
      spreadTimer: 0, rapidTimer: 0,
      shield: false,
      novaCharges: NOVA.startCharges,
      dashTimer: 0, dashCooldown: 0, dashX: 0, dashY: 0,
      invulnTimer: 0,
      dead: false,
    };
    this.startWave(1);
  }

  startWave(wave) {
    this.wave = wave;
    this.director.startWave(wave);
    this.phase = 'fighting';
    this.bannerText = `WAVE ${wave}`;
    this.bannerTimer = 1.6;
    if (wave > 1 && wave % NOVA.wavesPerCharge === 1) {
      this.player.novaCharges = Math.min(NOVA.maxCharges, this.player.novaCharges + 1);
    }
    this.events.push('wave');
  }

  /** Enemies still to kill this wave: on the field plus the queue. */
  get enemiesLeft() {
    return this.enemies.length + this.director.pending;
  }

  spawnEnemy(kind) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 8; tries += 1) {
      const point = this.rng.edgePoint(VIEW.width, VIEW.height, ARENA_MARGIN + 8);
      x = point.x;
      y = point.y;
      if (Math.hypot(x - this.player.x, y - this.player.y) > 250) break;
    }
    const enemy = createEnemy(kind, x, y, this.wave);
    if (kind === 'orbiter') enemy.fireTimer = this.rng.range(0.9, 2.1);
    this.enemies.push(enemy);
    this.particles.ring(x, y, enemy.stats.color, 34, 0.35, 3);
    return enemy;
  }

  /** Advance the whole world by one fixed step under the given control. */
  step(dt, control) {
    this.time += dt;
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.novaFlash = Math.max(0, this.novaFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 26);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.particles.update(dt);
      return;
    }
    if (this.phase !== 'over') this.timeAlive += dt;

    this.#stepPlayer(dt, control);
    this.#stepSpawning(dt);
    this.#stepEnemies(dt);
    this.#stepBullets(dt);
    this.#stepBolts(dt);
    updatePickups(this, dt);
    this.#stepPickupCollection();
    this.particles.update(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.phase === 'fighting' && this.director.pending === 0 && this.enemies.length === 0 && !this.player.dead) {
      this.score += SCORE.waveClearPerWave * this.wave;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + SCORE.betweenWaveHeal);
      this.phase = 'intermission';
      this.intermissionTimer = 2.4;
      this.bannerText = `WAVE ${this.wave} CLEAR`;
      this.bannerTimer = 1.6;
    } else if (this.phase === 'intermission') {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) this.startWave(this.wave + 1);
    }
    // Sweep the dead.
    this.enemies = this.enemies.filter((e) => e.alive);
    this.bullets = this.bullets.filter((b) => b.alive);
    this.bolts = this.bolts.filter((b) => b.alive);
    this.pickups = this.pickups.filter((p) => p.alive);
  }

  #stepPlayer(dt, control) {
    const player = this.player;
    if (player.dead) return;
    player.fireTimer -= dt;
    player.spreadTimer = Math.max(0, player.spreadTimer - dt);
    player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.invulnTimer = Math.max(0, player.invulnTimer - dt);

    const aimDx = control.aimX - player.x;
    const aimDy = control.aimY - player.y;
    if (Math.hypot(aimDx, aimDy) > 4) player.angle = Math.atan2(aimDy, aimDx);

    if (control.dashPressed && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      let dx = control.moveX;
      let dy = control.moveY;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(player.angle);
        dy = Math.sin(player.angle);
      }
      const len = Math.hypot(dx, dy) || 1;
      player.dashX = dx / len;
      player.dashY = dy / len;
      player.dashTimer = PLAYER.dashSeconds;
      player.dashCooldown = PLAYER.dashCooldown;
      this.events.push('dash');
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
      this.particles.trail(player.x, player.y, '#3ff2ff', 16, 0.28);
    } else {
      const len = Math.hypot(control.moveX, control.moveY);
      const nx = len > 0 ? control.moveX / len : 0;
      const ny = len > 0 ? control.moveY / len : 0;
      const blend = Math.min(1, 18 * dt);
      player.vx += (nx * PLAYER.speed - player.vx) * blend;
      player.vy += (ny * PLAYER.speed - player.vy) * blend;
      if (len > 0 && this.time % 0.05 < dt) {
        this.particles.trail(
          player.x - Math.cos(player.angle) * 14,
          player.y - Math.sin(player.angle) * 14,
          '#2aa7c9', 7, 0.3,
        );
      }
    }
    player.x = clamp(player.x + player.vx * dt, ARENA_MARGIN + player.radius, VIEW.width - ARENA_MARGIN - player.radius);
    player.y = clamp(player.y + player.vy * dt, ARENA_MARGIN + player.radius, VIEW.height - ARENA_MARGIN - player.radius);

    if (control.novaPressed) this.#nova();

    if (control.firing) {
      const rate = CANNON.shotsPerSecond * (player.rapidTimer > 0 ? CANNON.rapidFactor : 1);
      while (player.fireTimer <= 0) {
        player.fireTimer += 1 / rate;
        this.#fireOne(player.spreadTimer > 0);
        this.events.push('shoot');
      }
    } else if (player.fireTimer < 0) {
      player.fireTimer = 0;
    }
  }

  #fireOne(spread) {
    const player = this.player;
    const pellets = spread ? CANNON.spreadPellets : 1;
    for (let i = 0; i < pellets; i += 1) {
      const offset = spread ? (i - (pellets - 1) / 2) * CANNON.spreadAngle : 0;
      const angle = player.angle + offset + this.rng.range(-0.012, 0.012);
      this.bullets.push({
        x: player.x + Math.cos(player.angle) * (player.radius + 8),
        y: player.y + Math.sin(player.angle) * (player.radius + 8),
        vx: Math.cos(angle) * CANNON.bulletSpeed,
        vy: Math.sin(angle) * CANNON.bulletSpeed,
        radius: CANNON.bulletRadius,
        life: CANNON.bulletLife,
        alive: true,
      });
    }
    this.particles.burst(
      player.x + Math.cos(player.angle) * (player.radius + 12),
      player.y + Math.sin(player.angle) * (player.radius + 12),
      '#8ff7ff', 2, 120, 0.16, 2.5,
    );
  }

  #nova() {
    const player = this.player;
    if (player.novaCharges <= 0 || this.enemies.length === 0) return;
    player.novaCharges -= 1;
    this.novaFlash = 0.4;
    this.shake = Math.max(this.shake, 13);
    this.events.push('nova');
    this.particles.ring(player.x, player.y, '#f78fb3', 620, 0.7, 7);
    this.particles.ring(player.x, player.y, '#ffffff', 420, 0.5, 4);
    for (const enemy of [...this.enemies]) this.killEnemy(enemy, NOVA.scoreFactor);
    this.bolts.length = 0;
  }

  #stepSpawning(dt) {
    if (this.phase !== 'fighting') return;
    const kind = this.director.nextSpawn(dt, this.enemies.length);
    if (kind) this.spawnEnemy(kind);
  }

  #stepEnemies(dt) {
    const player = this.player;
    for (const enemy of this.enemies) {
      const bolt = updateEnemy(this, enemy, dt);
      if (bolt) this.bolts.push(bolt);
      enemy.x = clamp(enemy.x, ARENA_MARGIN + enemy.radius * 0.5, VIEW.width - ARENA_MARGIN - enemy.radius * 0.5);
      enemy.y = clamp(enemy.y, ARENA_MARGIN + enemy.radius * 0.5, VIEW.height - ARENA_MARGIN - enemy.radius * 0.5);
    }
    // Gentle separation so a swarm reads as bodies, not one blob.
    const list = this.enemies;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = (a.radius + b.radius) * 0.82;
        if (dist > 0.01 && dist < min) {
          const push = ((min - dist) / dist) * 0.5;
          a.x -= dx * push * 0.5;
          a.y -= dy * push * 0.5;
          b.x += dx * push * 0.5;
          b.y += dy * push * 0.5;
        }
      }
    }
    // Contact with the player.
    if (!player.dead) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist < enemy.radius + player.radius - 2) {
          const damage = enemy.kind === 'lancer' && enemy.state === 'charge'
            ? enemy.stats.chargeDamage
            : enemy.contactDamage;
          const hurt = this.hurtPlayer(damage);
          if (enemy.kind === KIND_BULWARK) {
            const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            enemy.x += Math.cos(angle) * 26;
            enemy.y += Math.sin(angle) * 26;
          } else if (hurt || player.invulnTimer > 0) {
            enemy.alive = false;
            this.particles.burst(enemy.x, enemy.y, enemy.stats.color, 12, 240, 0.4, 3);
            this.events.push('explosion');
          }
        }
      }
    }
  }

  #stepBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -30 || bullet.x > VIEW.width + 30 || bullet.y < -30 || bullet.y > VIEW.height + 30) {
        bullet.alive = false;
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
        if (dist < enemy.radius + bullet.radius) {
          bullet.alive = false;
          enemy.hp -= 1;
          enemy.flash = 0.09;
          const mass = enemy.kind === KIND_BULWARK ? 0.15 : 1;
          enemy.vx += bullet.vx * 0.06 * mass;
          enemy.vy += bullet.vy * 0.06 * mass;
          this.particles.burst(bullet.x, bullet.y, enemy.stats.color, 4, 200, 0.25, 2.5);
          if (enemy.hp <= 0) this.killEnemy(enemy, 1);
          else this.events.push('hit');
          break;
        }
      }
    }
  }

  #stepBolts(dt) {
    const player = this.player;
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0 || bolt.x < ARENA_MARGIN - 10 || bolt.x > VIEW.width - ARENA_MARGIN + 10
        || bolt.y < ARENA_MARGIN - 10 || bolt.y > VIEW.height - ARENA_MARGIN + 10) {
        bolt.alive = false;
        continue;
      }
      if (!player.dead && Math.hypot(bolt.x - player.x, bolt.y - player.y) < bolt.radius + player.radius - 2) {
        bolt.alive = false;
        this.hurtPlayer(bolt.damage);
      }
    }
  }

  #stepPickupCollection() {
    const player = this.player;
    if (player.dead) return;
    for (const pickup of this.pickups) {
      if (!pickup.alive) continue;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < pickup.radius + player.radius + 6) {
        pickup.alive = false;
        const label = applyPickup(this, pickup.kind);
        this.particles.burst(pickup.x, pickup.y, '#ffffff', 10, 180, 0.35, 3);
        this.particles.scoreText(player.x, player.y - 30, label, '#eaf6ff');
        this.events.push('pickup');
      }
    }
  }

  /** Damage the player, honouring dash, invulnerability and the Aegis shield. */
  hurtPlayer(damage) {
    const player = this.player;
    if (player.dead || player.dashTimer > 0 || player.invulnTimer > 0) return false;
    if (player.shield) {
      player.shield = false;
      player.invulnTimer = 1.1;
      this.particles.ring(player.x, player.y, '#4dc9ff', 60, 0.4, 4);
      this.events.push('shield');
      return true;
    }
    player.hp -= damage;
    player.invulnTimer = PLAYER.hurtInvulnSeconds;
    this.hurtFlash = 0.3;
    this.shake = Math.max(this.shake, 8);
    this.hitStop = Math.max(this.hitStop, 0.045);
    this.particles.burst(player.x, player.y, '#ff5d7a', 14, 280, 0.4, 3);
    if (player.hp <= 0) {
      player.hp = 0;
      player.dead = true;
      this.phase = 'over';
      this.shake = 18;
      this.particles.burst(player.x, player.y, '#3ff2ff', 46, 420, 0.9, 4);
      this.particles.debris(player.x, player.y, '#3ff2ff', 12);
      this.particles.ring(player.x, player.y, '#ffffff', 150, 0.6, 5);
      this.events.push('over');
    } else {
      this.events.push('hurt');
    }
    return true;
  }

  /** Kill an enemy: score it (combo-scaled), burst it, maybe drop, maybe split. */
  killEnemy(enemy, scoreFactor) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.kills += 1;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = SCORE.comboWindow;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const gained = Math.round(
      enemy.score * scoreFactor * (1 + Math.min(this.combo, SCORE.comboCap) * SCORE.comboStep),
    );
    this.score += gained;
    const big = enemy.kind === KIND_BULWARK;
    this.particles.burst(enemy.x, enemy.y, enemy.stats.color, big ? 34 : 16, big ? 380 : 300, 0.55, 3.5);
    this.particles.debris(enemy.x, enemy.y, enemy.stats.color, big ? 9 : 4);
    if (big) this.particles.ring(enemy.x, enemy.y, enemy.stats.color, 110, 0.5, 5);
    this.particles.scoreText(enemy.x, enemy.y - 12, `+${gained}`, big ? '#ffd93d' : '#cfe6ff');
    this.events.push(big ? 'bigExplosion' : 'explosion');
    if (scoreFactor === 1) {
      const drop = rollDrop(this, enemy.x, enemy.y);
      if (drop) this.pickups.push(drop);
    }
    if (big) {
      for (let i = 0; i < enemy.stats.splitInto; i += 1) {
        const angle = (i / enemy.stats.splitInto) * Math.PI * 2 + this.rng.range(0, 1);
        const mote = this.spawnEnemyAt('mote', enemy.x + Math.cos(angle) * 20, enemy.y + Math.sin(angle) * 20);
        mote.vx = Math.cos(angle) * 190;
        mote.vy = Math.sin(angle) * 190;
      }
    }
  }

  /** Spawn one enemy at an exact point (Bulwark splits); no edge logic. */
  spawnEnemyAt(kind, x, y) {
    const enemy = createEnemy(kind, x, y, this.wave);
    this.enemies.push(enemy);
    return enemy;
  }
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
