// VOIDBLOOM's bootstrap and screen flow. It owns the canvas, the clock and the four
// screens (title, playing, paused, game over); the world owns the game. A fixed 60 Hz
// step keeps the simulation identical at any refresh rate, input is gathered once a
// frame into a plain control object, and the world's event list is drained into the
// sound engine after each batch of steps. With ?shot=<scene>&seed=<n> in the URL it
// instead stages one deterministic scene, renders it and raises window.__shotReady,
// which is how the screenshots in screenshots/ were taken.

import { BEST_KEY, STEP } from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Renderer, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { World } from './world.js';
import { autopilotControl, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = new Input(canvas);
const sound = new SoundEngine();
const renderer = new Renderer(canvas);

let best = loadBest();
let screen = SCREEN_TITLE;
let world = new World((Date.now() % 2147483647) || 1);
let overScreenAt = -1;
let newBest = false;
let lastTime = -1;
let accumulator = 0;
let wasRightDown = false;

const EVENT_SOUNDS = {
  shoot: () => sound.shoot(),
  hit: () => sound.enemyHit(),
  explosion: () => sound.explosion(false),
  bigExplosion: () => sound.explosion(true),
  hurt: () => sound.playerHurt(),
  shield: () => sound.shieldBreak(),
  pickup: () => sound.pickup(),
  dash: () => sound.dash(),
  nova: () => sound.nova(),
  wave: () => sound.waveStart(),
  over: () => sound.gameOver(),
};

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Private modes and file contexts may refuse storage; the game plays on.
  }
}

function startRun() {
  world = new World((Date.now() % 2147483647) || 1);
  screen = SCREEN_PLAY;
  newBest = false;
  overScreenAt = -1;
  sound.unlock();
  sound.uiClick();
  sound.startMusic();
  announce('VOIDBLOOM started. Wave 1.');
}

function announce(text) {
  if (status) status.textContent = text;
}

function drainEvents() {
  for (const event of world.events) {
    const play = EVENT_SOUNDS[event];
    if (play) play();
  }
  world.events.length = 0;
}

/** The control object for one step, from live input or from the attract-mode pilot. */
function buildControl(firstStep) {
  if (screen !== SCREEN_PLAY) return autopilotControl(world);
  const axis = input.moveAxis();
  const rightEdge = input.mouse.rightDown && !wasRightDown;
  return {
    moveX: axis.x,
    moveY: axis.y,
    aimX: input.mouse.x,
    aimY: input.mouse.y,
    firing: input.mouse.down || input.isHeld('Space'),
    dashPressed: firstStep && (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight') || rightEdge),
    novaPressed: firstStep && input.wasPressed('KeyE'),
  };
}

function handleScreenKeys() {
  if (input.wasPressed('KeyM')) {
    sound.unlock();
    sound.setMuted(!sound.muted);
  }
  if (screen === SCREEN_TITLE && (input.wasPressed('Enter') || input.clicked)) {
    startRun();
    return;
  }
  if (screen === SCREEN_OVER && overScreenAt > 0 && performance.now() - overScreenAt > 450
    && (input.wasPressed('Enter') || input.clicked)) {
    startRun();
    return;
  }
  if (screen === SCREEN_PLAY && (input.wasPressed('KeyP') || input.wasPressed('Escape'))) {
    screen = SCREEN_PAUSE;
    sound.stopMusic();
    announce('Paused.');
    return;
  }
  if (screen === SCREEN_PAUSE && (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter'))) {
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.startMusic();
    announce('Resumed.');
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (lastTime < 0) lastTime = now;
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  handleScreenKeys();
  if (screen !== SCREEN_PAUSE) {
    accumulator += dt;
    let firstStep = true;
    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      world.step(STEP, buildControl(firstStep));
      firstStep = false;
      steps += 1;
      accumulator -= STEP;
    }
    if (steps === 6) accumulator = 0; // a long stall: drop the debt, never spiral
    drainEvents();
    if (screen === SCREEN_PLAY && world.phase === 'over') {
      screen = SCREEN_OVER;
      overScreenAt = now;
      newBest = world.score > best;
      if (newBest) {
        best = world.score;
        saveBest();
      }
      sound.stopMusic();
      announce(`Game over. Score ${world.score}, wave ${world.wave}. Press Enter to fly again.`);
    }
  }
  wasRightDown = input.mouse.rightDown;
  renderer.draw(world, {
    screen,
    best,
    newBest,
    muted: sound.muted,
    mouseX: input.mouse.x,
    mouseY: input.mouse.y,
  });
  input.endFrame();
}

// Screenshot mode: stage one scene, draw it, and say so. No loop, no sound.
const params = new URLSearchParams(location.search);
if (params.has('shot')) {
  const seed = Number(params.get('seed')) || 1;
  world = new World(seed);
  screen = stageShot(world, params.get('shot') ?? 'title');
  newBest = false;
  best = Math.max(best, world.score);
  renderer.draw(world, {
    screen, best, newBest, muted: true, mouseX: 900, mouseY: 240,
  });
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}

// A handle for screenshot tooling and curious players: the live world, nothing more.
window.__voidbloom = { world: () => world, screen: () => screen };
