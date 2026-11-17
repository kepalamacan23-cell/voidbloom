// Pickups: what falls out of a broken enemy and what it does for the player. Five kinds,
// each one a clear choice to fly for: firepower (Spread, Rapid), survival (Aegis shield,
// Heart) and a Nova charge. They drift, blink before they fade, and are drawn to the
// player who comes close, so a pickup is a small risk taken on purpose.

import { CANNON, COLORS, NOVA } from './config.js';

export const PICKUP_SPREAD = 'spread';
export const PICKUP_RAPID = 'rapid';
export const PICKUP_SHIELD = 'shield';
export const PICKUP_HEART = 'heart';
export const PICKUP_NOVA = 'nova';

export const PICKUP_KINDS = {
  [PICKUP_SPREAD]: { label: 'SPREAD', color: COLORS.spread, glyph: 'III' },
  [PICKUP_RAPID]: { label: 'RAPID', color: COLORS.rapid, glyph: '>>' },
  [PICKUP_SHIELD]: { label: 'AEGIS', color: COLORS.shield, glyph: 'O' },
  [PICKUP_HEART]: { label: 'HULL +25', color: COLORS.heart, glyph: '+' },
  [PICKUP_NOVA]: { label: 'NOVA', color: COLORS.novaPickup, glyph: '*' },
};

/** The drop table: weapons most often, survival when it matters, nova rarely. */
const DROP_TABLE = [
  PICKUP_SPREAD, PICKUP_SPREAD, PICKUP_RAPID, PICKUP_RAPID,
  PICKUP_SHIELD, PICKUP_HEART, PICKUP_HEART, PICKUP_NOVA,
];

export const DROP_CHANCE = 0.13;
export const PICKUP_LIFE = 9;
export const MAGNET_RANGE = 110;

/** Roll a drop for a kill at (x, y); returns the pickup or null. Uses the world rng. */
export function rollDrop(world, x, y) {
  if (!world.rng.chance(DROP_CHANCE)) return null;
  const kind = world.rng.pick(DROP_TABLE);
  return {
    kind, x, y,
    vx: world.rng.range(-30, 30),
    vy: world.rng.range(-30, 30),
    radius: 13,
    age: 0,
    alive: true,
  };
}

/** Apply a pickup to the player and say what the HUD should flash. */
export function applyPickup(world, kind) {
  const player = world.player;
  if (kind === PICKUP_SPREAD) player.spreadTimer = CANNON.pickupSeconds;
  else if (kind === PICKUP_RAPID) player.rapidTimer = CANNON.pickupSeconds;
  else if (kind === PICKUP_SHIELD) player.shield = true;
  else if (kind === PICKUP_HEART) player.hp = Math.min(player.maxHp, player.hp + 25);
  else if (kind === PICKUP_NOVA) player.novaCharges = Math.min(NOVA.maxCharges, player.novaCharges + 1);
  return PICKUP_KINDS[kind].label;
}

/** Drift, magnet and expiry for every live pickup. */
export function updatePickups(world, dt) {
  const player = world.player;
  for (const pickup of world.pickups) {
    pickup.age += dt;
    if (pickup.age >= PICKUP_LIFE) {
      pickup.alive = false;
      continue;
    }
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < MAGNET_RANGE && !player.dead) {
      const pull = 340 * (1 - dist / MAGNET_RANGE) + 60;
      pickup.vx += (dx / dist) * pull * dt * 4;
      pickup.vy += (dy / dist) * pull * dt * 4;
    }
    pickup.vx *= Math.max(0, 1 - 2.4 * dt);
    pickup.vy *= Math.max(0, 1 - 2.4 * dt);
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
  }
}
