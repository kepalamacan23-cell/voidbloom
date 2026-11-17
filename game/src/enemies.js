// The four enemy kinds of VOIDBLOOM: what each is worth, how hard it hits, and how it
// moves. Behaviour lives here, drawing in render.js, spawning in waves.js. Each kind has
// one clear idea: the Mote hunts, the Lancer telegraphs and charges, the Orbiter keeps
// its distance and shoots, the Bulwark soaks fire and splits into Motes when it breaks.

export const KIND_MOTE = 'mote';
export const KIND_LANCER = 'lancer';
export const KIND_ORBITER = 'orbiter';
export const KIND_BULWARK = 'bulwark';

export const ENEMY_KINDS = {
  [KIND_MOTE]: {
    radius: 11, hp: 1, speed: 118, contactDamage: 10, score: 50,
    color: '#ff4fd8',
  },
  [KIND_LANCER]: {
    radius: 13, hp: 2, speed: 105, contactDamage: 14, score: 80,
    color: '#ff9a3d', chargeSpeed: 560, chargeDamage: 18,
  },
  [KIND_ORBITER]: {
    radius: 14, hp: 3, speed: 92, contactDamage: 12, score: 120,
    color: '#a78bfa', orbitRange: 235, boltSpeed: 250, boltDamage: 8, fireSeconds: 2.3,
  },
  [KIND_BULWARK]: {
    radius: 27, hp: 12, speed: 42, contactDamage: 20, score: 300,
    color: '#ff4757', splitInto: 3,
  },
};

/** Wave scaling: later waves are a little faster and a little tougher, never unfair. */
export function scaledStats(kind, wave) {
  const base = ENEMY_KINDS[kind];
  const hpBonus = kind === KIND_BULWARK ? Math.floor((wave - 4) / 2) : wave >= 6 && kind !== KIND_MOTE ? 1 : 0;
  return {
    ...base,
    hp: base.hp + Math.max(0, hpBonus),
    speed: base.speed * (1 + Math.min(0.45, (wave - 1) * 0.045)),
  };
}

/** A fresh enemy of a kind at a point, with its behaviour state at rest. */
export function createEnemy(kind, x, y, wave) {
  const stats = scaledStats(kind, wave);
  return {
    kind,
    x, y,
    vx: 0, vy: 0,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    contactDamage: stats.contactDamage,
    score: stats.score,
    stats,
    state: 'hunt', // lancer: hunt | aim | charge | rest; others stay in hunt
    stateTime: 0,
    fireTimer: 1.5, // the world re-rolls this from its own seeded rng at spawn
    wobble: 0,
    flash: 0, // white hit-flash timer, read by the renderer
    angle: 0,
    alive: true,
  };
}

function steer(enemy, targetX, targetY, speed, dt, turn = 14) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantX = (dx / dist) * speed;
  const wantY = (dy / dist) * speed;
  const blend = Math.min(1, turn * dt);
  enemy.vx += (wantX - enemy.vx) * blend;
  enemy.vy += (wantY - enemy.vy) * blend;
  enemy.angle = Math.atan2(enemy.vy, enemy.vx);
}

/** Advance one enemy by dt against the player; returns a bolt to spawn, or null. */
export function updateEnemy(world, enemy, dt) {
  const player = world.player;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.stateTime += dt;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (enemy.kind === KIND_MOTE) {
    enemy.wobble += dt * 5;
    const sway = Math.sin(enemy.wobble + enemy.x * 0.02) * 34;
    steer(enemy, player.x - (dy / dist) * sway, player.y + (dx / dist) * sway, enemy.speed, dt, 6);
  } else if (enemy.kind === KIND_LANCER) {
    if (enemy.state === 'hunt') {
      steer(enemy, player.x, player.y, enemy.speed, dt, 8);
      if (dist < 300 && enemy.stateTime > 0.4) {
        enemy.state = 'aim';
        enemy.stateTime = 0;
      }
    } else if (enemy.state === 'aim') {
      enemy.vx *= 0.8;
      enemy.vy *= 0.8;
      enemy.angle = Math.atan2(dy, dx);
      if (enemy.stateTime > 0.55) {
        enemy.state = 'charge';
        enemy.stateTime = 0;
        enemy.vx = Math.cos(enemy.angle) * enemy.stats.chargeSpeed;
        enemy.vy = Math.sin(enemy.angle) * enemy.stats.chargeSpeed;
      }
    } else if (enemy.state === 'charge') {
      if (enemy.stateTime > 0.55) {
        enemy.state = 'rest';
        enemy.stateTime = 0;
      }
    } else { // rest
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;
      if (enemy.stateTime > 0.7) {
        enemy.state = 'hunt';
        enemy.stateTime = 0;
      }
    }
  } else if (enemy.kind === KIND_ORBITER) {
    const range = enemy.stats.orbitRange;
    const radial = dist > range + 24 ? 1 : dist < range - 24 ? -1 : 0;
    const orbitDir = enemy.x < player.x ? 1 : -1; // stable per side, no jitter
    const tx = player.x + (dx / dist) * -radial * 60 + (-dy / dist) * orbitDir * 90;
    const ty = player.y + (dy / dist) * -radial * 60 + (dx / dist) * orbitDir * 90;
    steer(enemy, tx, ty, enemy.speed * 1.35, dt, 5);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 560 && !player.dead) {
      enemy.fireTimer = enemy.stats.fireSeconds * world.rng.range(0.85, 1.2);
      return {
        x: enemy.x, y: enemy.y,
        vx: (dx / dist) * enemy.stats.boltSpeed,
        vy: (dy / dist) * enemy.stats.boltSpeed,
        radius: 5, damage: enemy.stats.boltDamage, life: 3.4, alive: true,
      };
    }
  } else if (enemy.kind === KIND_BULWARK) {
    steer(enemy, player.x, player.y, enemy.speed, dt, 3);
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  return null;
}
