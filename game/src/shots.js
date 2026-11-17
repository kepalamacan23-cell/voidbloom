// Screenshot scenes and the autopilot that plays them. A shot URL (?shot=play&seed=1)
// replays the real rules forward from a seeded world, steered by the autopilot below, so
// every screenshot in screenshots/ is the game itself, unedited, and the same seed gives
// the same frame on any machine. The title screen's attract mode uses the same pilot.

import { STEP, VIEW } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function nearestEnemy(world, from) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of world.enemies) {
    const d = Math.hypot(enemy.x - from.x, enemy.y - from.y);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return { enemy: best, dist: bestDist };
}

/**
 * One frame of competent play, as a control object: hold a fighting distance from the
 * nearest enemy, strafe slowly around it, aim with a little lead, fire, dash out of a
 * crowd and spend a nova only when the screen is truly full.
 */
export function autopilotControl(world) {
  const player = world.player;
  const { enemy, dist } = nearestEnemy(world, player);
  const control = {
    moveX: 0, moveY: 0,
    aimX: player.x + Math.cos(player.angle) * 100,
    aimY: player.y + Math.sin(player.angle) * 100,
    firing: false, dashPressed: false, novaPressed: false,
  };
  if (!enemy) {
    // Nothing to fight: drift back toward the centre and wait for the wave.
    control.moveX = Math.sign(VIEW.width / 2 - player.x);
    control.moveY = Math.sign(VIEW.height / 2 - player.y);
    return control;
  }
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const lead = Math.min(0.35, dist / 900);
  control.aimX = enemy.x + enemy.vx * lead;
  control.aimY = enemy.y + enemy.vy * lead;
  control.firing = true;
  const wanted = 215;
  let mx = 0;
  let my = 0;
  if (dist > wanted + 30) {
    mx = dx / dist;
    my = dy / dist;
  } else if (dist < wanted - 30) {
    mx = -dx / dist;
    my = -dy / dist;
  }
  const strafe = Math.sin(world.time * 0.9) > 0 ? 1 : -1;
  mx += (-dy / dist) * strafe * 0.7;
  my += (dx / dist) * strafe * 0.7;
  // Walls: bias back inside well before the margin.
  if (player.x < 150) mx += 1.2;
  if (player.x > VIEW.width - 150) mx -= 1.2;
  if (player.y < 150) my += 1.2;
  if (player.y > VIEW.height - 150) my -= 1.2;
  control.moveX = Math.sign(mx);
  control.moveY = Math.sign(my);
  control.dashPressed = dist < 95 && player.dashCooldown <= 0;
  control.novaPressed = world.enemies.length >= 9 && player.novaCharges > 0;
  return control;
}

/** A pilot that runs at the nearest enemy and never shoots: the way a run ends. */
function recklessControl(world) {
  const player = world.player;
  const { enemy } = nearestEnemy(world, player);
  const control = {
    moveX: 0, moveY: 0, aimX: player.x, aimY: player.y - 100,
    firing: false, dashPressed: false, novaPressed: false,
  };
  if (enemy) {
    control.moveX = Math.sign(enemy.x - player.x);
    control.moveY = Math.sign(enemy.y - player.y);
    control.aimX = enemy.x;
    control.aimY = enemy.y;
  }
  return control;
}

function simulate(world, seconds, controlFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, controlFn(world));
    world.events.length = 0;
  }
}

/**
 * Ring a fresh wave of hostiles around the player through the game's own spawn path,
 * so a staged frame is full of the fight it claims to show: mixed kinds, mid-field,
 * already moving when the shutter falls a fraction of a second later.
 */
function stageRing(world, kinds) {
  const player = world.player;
  kinds.forEach((kind, i) => {
    const angle = (i / kinds.length) * Math.PI * 2 + 0.6;
    const dist = 290 + (i % 3) * 60;
    const x = Math.min(1220, Math.max(60, player.x + Math.cos(angle) * dist));
    const y = Math.min(660, Math.max(60, player.y + Math.sin(angle) * dist));
    world.spawnEnemyAt(kind, x, y);
  });
}

/**
 * Stage the named scene on a fresh world and return the screen to draw over it.
 * Scenes: title (the menu over a live fight), play (wave 1, well in), siege (a later
 * wave at full pressure) and over (a finished run, stats and all).
 */
export function stageShot(world, name) {
  world.reset();
  if (name === 'play') {
    simulate(world, 11, autopilotControl);
    if (world.enemies.length < 6) stageRing(world, ['mote', 'lancer', 'mote', 'orbiter']);
    simulate(world, 0.35, autopilotControl);
    return SCREEN_PLAY;
  }
  if (name === 'siege') {
    simulate(world, 52, autopilotControl);
    if (world.enemies.length < 8) stageRing(world, ['bulwark', 'orbiter', 'lancer', 'mote', 'mote']);
    simulate(world, 0.3, autopilotControl);
    return SCREEN_PLAY;
  }
  if (name === 'over') {
    simulate(world, 20, autopilotControl); // a real run first: score, kills, a wave or two
    let guard = 0;
    while (world.phase !== 'over' && guard < 75 / STEP) {
      world.step(STEP, recklessControl(world));
      world.events.length = 0;
      guard += 1;
    }
    simulate(world, 0.7, recklessControl);
    return SCREEN_OVER;
  }
  simulate(world, 6, autopilotControl);
  return SCREEN_TITLE;
}
