// Everything VOIDBLOOM looks like: a deep-space neon arena drawn fresh each frame from
// the world's state. The nebula and starfield are pre-rendered once to an offscreen
// canvas; ships, enemies, bullets and pickups are vector shapes with glow; the HUD and
// the title, pause and game-over screens are drawn here too, so a screenshot of the
// canvas is a screenshot of the whole game, chrome and all.

import { ARENA_MARGIN, COLORS, VIEW } from './config.js';
import { KIND_BULWARK, KIND_LANCER, KIND_MOTE } from './enemies.js';
import { PICKUP_KINDS } from './pickups.js';
import { createRng } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_PAUSE = 'paused';
export const SCREEN_OVER = 'over';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.background = this.#paintBackground();
  }

  /** The static sky: gradient, nebula clouds and two star layers, painted once. */
  #paintBackground() {
    const off = document.createElement('canvas');
    off.width = VIEW.width;
    off.height = VIEW.height;
    const ctx = off.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, COLORS.spaceTop);
    gradient.addColorStop(1, COLORS.spaceBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const rng = createRng(20261115);
    const clouds = [
      [240, 150, 340, COLORS.nebulaViolet], [1050, 120, 300, COLORS.nebulaTeal],
      [700, 560, 380, COLORS.nebulaViolet], [180, 600, 260, COLORS.nebulaRose],
      [1150, 580, 300, COLORS.nebulaRose], [620, 260, 260, COLORS.nebulaTeal],
    ];
    for (const [x, y, r, color] of clouds) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let layer = 0; layer < 2; layer += 1) {
      const count = layer === 0 ? 150 : 70;
      for (let i = 0; i < count; i += 1) {
        const x = rng.range(0, VIEW.width);
        const y = rng.range(0, VIEW.height);
        const size = layer === 0 ? rng.range(0.6, 1.4) : rng.range(1.4, 2.4);
        ctx.globalAlpha = layer === 0 ? rng.range(0.25, 0.6) : rng.range(0.5, 0.95);
        ctx.fillStyle = layer === 0 ? COLORS.starDim : COLORS.starBright;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return off;
  }

  /** Draw one frame: world first, then the HUD, then whichever screen covers it. */
  draw(world, ui) {
    const ctx = this.ctx;
    ctx.save();
    if (world.shake > 0.2) {
      const t = world.time * 91;
      ctx.translate(Math.sin(t * 1.3) * world.shake * 0.5, Math.cos(t * 1.7) * world.shake * 0.5);
    }
    ctx.drawImage(this.background, 0, 0);
    this.#drawArena(ctx);
    for (const pickup of world.pickups) this.#drawPickup(ctx, pickup, world.time);
    for (const bolt of world.bolts) this.#drawBolt(ctx, bolt);
    for (const bullet of world.bullets) this.#drawBullet(ctx, bullet);
    for (const enemy of world.enemies) this.#drawEnemy(ctx, enemy, world.time);
    if (!world.player.dead) this.#drawPlayer(ctx, world);
    this.#drawParticles(ctx, world.particles);
    ctx.restore();

    if (world.novaFlash > 0) {
      ctx.fillStyle = `rgba(247, 143, 179, ${(world.novaFlash * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (world.hurtFlash > 0) {
      const grad = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
      grad.addColorStop(0, 'rgba(255,40,60,0)');
      grad.addColorStop(1, `rgba(255,40,60, ${(world.hurtFlash * 0.8).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (ui.screen === SCREEN_PLAY || ui.screen === SCREEN_PAUSE) {
      this.#drawHud(ctx, world, ui);
      this.#drawReticle(ctx, ui);
      if (world.bannerTimer > 0 && ui.screen === SCREEN_PLAY) this.#drawBanner(ctx, world);
    }
    if (ui.screen === SCREEN_TITLE) this.#drawTitle(ctx, world, ui);
    if (ui.screen === SCREEN_PAUSE) this.#drawPause(ctx);
    if (ui.screen === SCREEN_OVER) this.#drawGameOver(ctx, world, ui);
  }

  #drawArena(ctx) {
    const m = ARENA_MARGIN;
    ctx.strokeStyle = COLORS.arenaLine;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 12;
    roundRect(ctx, m, m, VIEW.width - 2 * m, VIEW.height - 2 * m, 18);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  #drawPlayer(ctx, world) {
    const player = world.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invulnTimer > 0 && player.dashTimer <= 0 && Math.sin(world.time * 34) > 0.2) ctx.globalAlpha = 0.35;
    // Engine flame, behind the hull, flickering with the clock.
    const moving = Math.hypot(player.vx, player.vy) > 40;
    if (moving) {
      const flame = 13 + Math.sin(world.time * 47) * 4 + (player.dashTimer > 0 ? 16 : 0);
      ctx.fillStyle = COLORS.playerFlame;
      ctx.beginPath();
      ctx.moveTo(-player.radius - flame, 0);
      ctx.lineTo(-player.radius + 3, -5);
      ctx.lineTo(-player.radius + 3, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.rotate(player.angle);
    // Bloom-petal wings and a sleek dart hull.
    ctx.fillStyle = '#0e5f73';
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-8, -16, -16, -19);
    ctx.quadraticCurveTo(-10, -4, -13, 0);
    ctx.quadraticCurveTo(-10, 4, -16, 19);
    ctx.quadraticCurveTo(-8, 16, 2, 0);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(21, 0);
    ctx.lineTo(-9, -8);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(3, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.shield) {
      ctx.strokeStyle = `rgba(77, 201, 255, ${0.55 + Math.sin(world.time * 6) * 0.25})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = COLORS.shield;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  #drawEnemy(ctx, enemy, time) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const color = enemy.flash > 0 ? '#ffffff' : enemy.stats.color;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = enemy.stats.color;
    ctx.shadowBlur = 13;
    if (enemy.kind === KIND_MOTE) {
      ctx.rotate(time * 2.4 + enemy.wobble);
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? enemy.radius + 4 : enemy.radius - 3;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b0a24';
      ctx.beginPath();
      ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === KIND_LANCER) {
      if (enemy.state === 'aim') {
        // The telegraph: a dashed line to the player, flashing faster as it fires.
        ctx.rotate(enemy.angle);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 154, 61, ${0.35 + (Math.sin(time * 26) > 0 ? 0.3 : 0)})`;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(300, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = Math.sin(time * 26) > 0 ? '#ffffff' : color;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-12, -9);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, 9);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.rotate(enemy.angle);
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-12, -9);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, 9);
        ctx.closePath();
        ctx.fill();
      }
    } else if (enemy.kind === 'orbiter') {
      ctx.rotate(time * 1.8);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius - 2, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (enemy.radius - 2), Math.sin(a) * (enemy.radius - 2), 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === KIND_BULWARK) {
      ctx.rotate(time * 0.7);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * enemy.radius, Math.sin(a) * enemy.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-time * 1.9);
      ctx.fillStyle = '#3d0a10';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#ffd9de';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      ctx.fillStyle = 'rgba(10, 8, 24, 0.7)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 13, w, 4);
      ctx.fillStyle = enemy.stats.color;
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 13, (w * enemy.hp) / enemy.maxHp, 4);
    }
  }

  #drawBullet(ctx, bullet) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    ctx.fillStyle = COLORS.bullet;
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 10;
    roundRect(ctx, -8, -2.6, 16, 5.2, 2.6);
    ctx.fill();
    ctx.restore();
  }

  #drawBolt(ctx, bolt) {
    ctx.fillStyle = COLORS.bolt;
    ctx.shadowColor = COLORS.bolt;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe3ea';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  #drawPickup(ctx, pickup, time) {
    const def = PICKUP_KINDS[pickup.kind];
    const fading = pickup.age > 6.5 && Math.sin(time * 14) > 0;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + Math.sin(time * 3 + pickup.x) * 3);
    ctx.globalAlpha = fading ? 0.25 : 1;
    ctx.rotate(time * 1.4);
    ctx.fillStyle = 'rgba(8, 10, 26, 0.85)';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * pickup.radius, Math.sin(a) * pickup.radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = def.color;
    ctx.font = `800 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.glyph, pickup.x, pickup.y + Math.sin(time * 3 + pickup.x) * 3 + 0.5);
    ctx.font = `700 9px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(def.label, pickup.x, pickup.y + pickup.radius + 10);
  }

  #drawParticles(ctx, particles) {
    for (const p of particles.list) {
      const fade = 1 - p.age / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade + 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'glow') {
        ctx.globalAlpha = fade * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + fade * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        const reach = p.size * (1 - (1 - p.age / p.life) ** 3);
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = (p.width ?? 4) * fade + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, reach, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    for (const t of particles.texts) {
      ctx.globalAlpha = 1 - t.age / t.life;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  #drawHud(ctx, world, ui) {
    const player = world.player;
    ctx.textBaseline = 'alphabetic';
    // Hull, top left.
    ctx.textAlign = 'left';
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('HULL', 44, 52);
    ctx.fillStyle = 'rgba(10, 12, 30, 0.75)';
    roundRect(ctx, 44, 58, 230, 15, 7);
    ctx.fill();
    const hullFrac = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hullFrac > 0.3 ? '#39e6a3' : COLORS.danger;
    if (hullFrac > 0) {
      roundRect(ctx, 44, 58, 230 * hullFrac, 15, 7);
      ctx.fill();
    }
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 282, 70);
    let rowY = 92;
    if (player.spreadTimer > 0) {
      this.#timerBar(ctx, 44, rowY, 'SPREAD', player.spreadTimer / 10, COLORS.spread);
      rowY += 17;
    }
    if (player.rapidTimer > 0) {
      this.#timerBar(ctx, 44, rowY, 'RAPID', player.rapidTimer / 10, COLORS.rapid);
      rowY += 17;
    }
    if (player.shield) {
      ctx.font = `800 12px ${FONT}`;
      ctx.fillStyle = COLORS.shield;
      ctx.fillText('AEGIS SHIELD UP', 44, rowY + 4);
    }
    // Wave and hostiles, top centre.
    ctx.textAlign = 'center';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`WAVE ${world.wave}`, VIEW.width / 2, 58);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(world.phase === 'intermission' ? 'WAVE CLEAR' : `${world.enemiesLeft} HOSTILES LEFT`, VIEW.width / 2, 79);
    // Score, top right.
    ctx.textAlign = 'right';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(String(world.score).padStart(7, '0'), VIEW.width - 44, 58);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`BEST ${Math.max(ui.best, world.score)}`, VIEW.width - 44, 79);
    if (world.combo >= 3) {
      ctx.font = `800 17px ${FONT}`;
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(`COMBO x${world.combo}`, VIEW.width - 44, 103);
    }
    // Nova charges and dash, bottom left.
    ctx.textAlign = 'left';
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('NOVA [E]', 44, VIEW.height - 52);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(52 + i * 22, VIEW.height - 34, 7, 0, Math.PI * 2);
      if (i < player.novaCharges) {
        ctx.fillStyle = COLORS.novaPickup;
        ctx.shadowColor = COLORS.novaPickup;
        ctx.shadowBlur = 9;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(143, 163, 200, 0.5)';
        ctx.stroke();
      }
    }
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('DASH [SHIFT]', 130, VIEW.height - 52);
    ctx.fillStyle = 'rgba(10, 12, 30, 0.75)';
    roundRect(ctx, 130, VIEW.height - 44, 110, 9, 4);
    ctx.fill();
    const dashFrac = 1 - Math.max(0, player.dashCooldown - 0.16) / (1.5 - 0.16);
    ctx.fillStyle = COLORS.player;
    if (dashFrac > 0) {
      roundRect(ctx, 130, VIEW.height - 44, 110 * Math.min(1, dashFrac), 9, 4);
      ctx.fill();
    }
    // Controls reminder, bottom right.
    ctx.textAlign = 'right';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(143, 163, 200, 0.75)';
    ctx.fillText(
      `WASD move · mouse aim · hold to fire · P pause · M ${ui.muted ? 'unmute' : 'mute'}`,
      VIEW.width - 44, VIEW.height - 30,
    );
  }

  #timerBar(ctx, x, y, label, frac, color) {
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 4);
    ctx.fillStyle = 'rgba(10, 12, 30, 0.75)';
    roundRect(ctx, x + 52, y - 4, 110, 8, 4);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x + 52, y - 4, 110 * Math.max(0, frac), 8, 4);
    ctx.fill();
  }

  #drawBanner(ctx, world) {
    const alpha = Math.min(1, world.bannerTimer / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `800 54px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 26;
    ctx.fillText(world.bannerText, VIEW.width / 2, 210);
    ctx.restore();
  }

  #drawReticle(ctx, ui) {
    ctx.strokeStyle = 'rgba(63, 242, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ui.mouseX, ui.mouseY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (const [dx, dy] of [[0, -15], [0, 15], [-15, 0], [15, 0]]) {
      ctx.moveTo(ui.mouseX + dx * 0.66, ui.mouseY + dy * 0.66);
      ctx.lineTo(ui.mouseX + dx, ui.mouseY + dy);
    }
    ctx.stroke();
  }

  #drawTitle(ctx, world, ui) {
    const ctx2 = ctx;
    ctx2.fillStyle = 'rgba(4, 2, 14, 0.58)';
    ctx2.fillRect(0, 0, VIEW.width, VIEW.height);
    // Bloom sigil: three rotating petal rings above the name.
    const cx = VIEW.width / 2;
    const cy = 218;
    ctx2.save();
    ctx2.translate(cx, cy);
    for (let ring = 0; ring < 3; ring += 1) {
      ctx2.save();
      ctx2.rotate(world.time * (0.25 + ring * 0.17) * (ring % 2 === 0 ? 1 : -1));
      ctx2.strokeStyle = [COLORS.player, COLORS.mote, COLORS.spread][ring];
      ctx2.globalAlpha = 0.8 - ring * 0.18;
      ctx2.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        ctx2.rotate(Math.PI / 3);
        ctx2.beginPath();
        ctx2.ellipse(26 + ring * 13, 0, 17 + ring * 6, 8 + ring * 3, 0, 0, Math.PI * 2);
        ctx2.stroke();
      }
      ctx2.restore();
    }
    ctx2.restore();
    ctx2.globalAlpha = 1;
    ctx2.textAlign = 'center';
    ctx2.font = `800 96px ${FONT}`;
    ctx2.fillStyle = COLORS.text;
    ctx2.shadowColor = COLORS.player;
    ctx2.shadowBlur = 34;
    ctx2.fillText('VOIDBLOOM', cx, 392);
    ctx2.shadowBlur = 0;
    ctx2.font = `700 21px ${FONT}`;
    ctx2.fillStyle = COLORS.spread;
    ctx2.fillText('A R E N A   S U R V I V A L', cx, 428);
    ctx2.font = `600 17px ${FONT}`;
    ctx2.fillStyle = COLORS.text;
    ctx2.fillText('Hold the bloom. Break the swarm. Every wave hits harder than the last.', cx, 472);
    ctx2.font = `600 15px ${FONT}`;
    ctx2.fillStyle = COLORS.textDim;
    ctx2.fillText('WASD / arrows — move        Mouse — aim        Hold click / Space — fire', cx, 516);
    ctx2.fillText('Shift / right click — dash        E — nova bomb        P — pause        M — mute', cx, 542);
    if (ui.best > 0) {
      ctx2.font = `700 16px ${FONT}`;
      ctx2.fillStyle = COLORS.gold;
      ctx2.fillText(`BEST SCORE ${ui.best}`, cx, 580);
    }
    const pulse = 0.65 + Math.sin(world.time * 4.2) * 0.35;
    ctx2.globalAlpha = pulse;
    ctx2.font = `800 24px ${FONT}`;
    ctx2.fillStyle = COLORS.player;
    ctx2.fillText('CLICK OR PRESS ENTER TO LAUNCH', cx, 636);
    ctx2.globalAlpha = 1;
  }

  #drawPause(ctx) {
    ctx.fillStyle = 'rgba(4, 2, 14, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `800 52px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText('PAUSED', VIEW.width / 2, 350);
    ctx.font = `600 17px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Press P to resume', VIEW.width / 2, 388);
  }

  #drawGameOver(ctx, world, ui) {
    ctx.fillStyle = 'rgba(6, 2, 10, 0.68)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `800 72px ${FONT}`;
    ctx.fillStyle = COLORS.danger;
    ctx.shadowColor = COLORS.danger;
    ctx.shadowBlur = 28;
    ctx.fillText('SHIP LOST', VIEW.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText('The swarm takes the bloom — this time.', VIEW.width / 2, 258);
    const rows = [
      ['SCORE', String(world.score)],
      ['WAVE REACHED', String(world.wave)],
      ['KILLS', String(world.kills)],
      ['BEST COMBO', `x${world.bestCombo}`],
      ['TIME SURVIVED', `${Math.floor(world.timeAlive / 60)}:${String(Math.floor(world.timeAlive % 60)).padStart(2, '0')}`],
    ];
    ctx.font = `700 19px ${FONT}`;
    rows.forEach(([label, value], i) => {
      const y = 318 + i * 36;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(label, VIEW.width / 2 - 18, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(value, VIEW.width / 2 + 18, y);
    });
    ctx.textAlign = 'center';
    ctx.font = `800 21px ${FONT}`;
    ctx.fillStyle = ui.newBest ? COLORS.gold : COLORS.textDim;
    ctx.fillText(ui.newBest ? `NEW BEST — ${world.score}` : `BEST ${ui.best}`, VIEW.width / 2, 318 + rows.length * 36 + 14);
    const pulse = 0.65 + Math.sin(world.time * 4.2) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillStyle = COLORS.player;
    ctx.fillText('PRESS ENTER OR CLICK TO FLY AGAIN', VIEW.width / 2, 640);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
