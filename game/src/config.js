// VOIDBLOOM tuning: the arena, the palette and every number the rest of the game reads.
// One place for balance, so world.js, waves.js and render.js never disagree about a value.

/** The play field, in world units; the canvas is exactly this size and CSS scales it. */
export const VIEW = { width: 1280, height: 720 };

/** Fixed simulation step: the world advances in 60 Hz slices whatever the display does. */
export const STEP = 1 / 60;

/** Walls keep every entity this far inside the view. */
export const ARENA_MARGIN = 26;

/** The whole palette, named once: deep space blues, the player's cyan bloom, enemy hues. */
export const COLORS = {
  spaceTop: '#0a0620',
  spaceBottom: '#05030f',
  nebulaViolet: 'rgba(109, 59, 214, 0.20)',
  nebulaTeal: 'rgba(20, 184, 196, 0.13)',
  nebulaRose: 'rgba(214, 59, 132, 0.10)',
  starDim: '#5d6b9e',
  starBright: '#cfe6ff',
  arenaLine: 'rgba(64, 224, 255, 0.35)',
  player: '#3ff2ff',
  playerCore: '#eaffff',
  playerFlame: '#ffb03a',
  bullet: '#8ff7ff',
  bolt: '#ff5d7a',
  mote: '#ff4fd8',
  lancer: '#ff9a3d',
  orbiter: '#a78bfa',
  bulwark: '#ff4757',
  heart: '#ff6b81',
  spread: '#ffd93d',
  rapid: '#6bf178',
  shield: '#4dc9ff',
  novaPickup: '#f78fb3',
  text: '#eaf6ff',
  textDim: '#8fa3c8',
  danger: '#ff4757',
  gold: '#ffd93d',
};

/** The player's ship: size, speed, hull and the dash that keeps it alive. */
export const PLAYER = {
  radius: 14,
  speed: 305,
  hull: 100,
  dashSpeed: 940,
  dashSeconds: 0.16,
  dashCooldown: 1.5,
  hurtInvulnSeconds: 0.9,
};

/** The bloom cannon: base rate and bullet behaviour, before pickups bend them. */
export const CANNON = {
  shotsPerSecond: 6.5,
  bulletSpeed: 760,
  bulletRadius: 5,
  bulletLife: 0.9,
  spreadPellets: 3,
  spreadAngle: 0.17,
  rapidFactor: 1.8,
  pickupSeconds: 10,
};

/** Contact and bolt damage per enemy kind lives in enemies.js; this is the nova bomb. */
export const NOVA = {
  startCharges: 1,
  maxCharges: 3,
  wavesPerCharge: 3,
  scoreFactor: 0.5,
};

/** Scoring: a kill chain inside the window raises the combo and the points with it. */
export const SCORE = {
  comboWindow: 3,
  comboStep: 0.05,
  comboCap: 20,
  waveClearPerWave: 100,
  betweenWaveHeal: 12,
};

/** localStorage key for the best score; guarded, the game runs without it. */
export const BEST_KEY = 'voidbloom.bestScore';
