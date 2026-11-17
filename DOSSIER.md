# VOIDBLOOM — Arena Survival

**Name:** VOIDBLOOM
**Genre:** 2D arena survival wave shooter (top-down, single player)
**Bounty:** make.fun `best-game-01` — "Make the best game"
**License:** MIT (see `LICENSE`)

## Concept

You pilot the last bloom-core ship in a neon void. Swarm-forms pour in from the arena
walls in growing waves; you hold the arena as long as you can. Every wave is faster,
denser and meaner than the one before, and the run ends when your hull does — the score
is how much of the swarm you took with you. The idea, name, art, enemies and sounds are
original to this entry: everything on screen is drawn in code and every sound is
synthesised, so the game ships as plain text files with no assets at all.

## How to play

**Goal:** survive the waves and score. There is no final wave — the game is lost when
your hull reaches zero, and won one wave at a time.

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left mouse / Space | Fire the bloom cannon |
| Shift / right click | Dash (brief invulnerable burst, 1.5 s cooldown) |
| E | Nova bomb (clears the field, limited charges) |
| P / Esc | Pause |
| M | Mute |
| Enter / click | Start, and restart after game over |

**Rules and scoring.** Kills pay points (Mote 50, Lancer 80, Orbiter 120, Bulwark 300).
Kills chained within 3 seconds build a combo that raises every payout. Clearing a wave
pays a bonus of 100 × the wave number and repairs 12 hull. A new nova charge arrives
every third wave. The best score is kept between visits.

**The swarm** (four kinds, each with one clear behaviour):

- **Mote** — a spiked seeker that hunts you with a weaving flight path.
- **Lancer** — a dart that pauses, telegraphs its line with a dashed warning, then
  charges at high speed for heavy damage.
- **Orbiter** — a ring that keeps its distance, strafes around you and fires bolts.
- **Bulwark** — a slow hexagon with deep health that splits into three Motes when it
  breaks.

**Pickups** drop from kills (13%): **Spread** (triple shot, 10 s), **Rapid** (fire rate
×1.8, 10 s), **Aegis** (a shield that absorbs one hit), **Hull +25** (repair) and
**Nova** (one bomb charge). Pickups drift, blink before they expire, and are pulled
toward a player who comes close — fetching one is a small deliberate risk.

## Features

- Endless escalating waves from a shuffled spawn director: new enemy kinds join on a
  learnable schedule (Lancers wave 2, Orbiters wave 3, Bulwarks wave 4), spawn pressure
  tightens inside each wave, and enemy speed/health scale gently with the wave number.
- A complete loop: animated title screen with a live attract-mode fight behind it,
  wave banners, HUD (hull, weapon timers, wave, hostiles left, score, best, combo,
  nova charges, dash cooldown), pause, and a game-over screen with run statistics
  (score, wave, kills, best combo, time survived) and one-key restart.
- Feel: particles for every hit and explosion, floating score text, screen shake,
  hit-stop, a hurt vignette, dash afterimages, engine trails and a nova shockwave.
- Sound: a full WebAudio synthesiser — cannon, hits, explosions, dash, nova, pickups,
  UI — plus a 132 bpm sequenced bass-and-arp music loop. No audio files.
- Deterministic scenes: the simulation runs on a fixed 60 Hz step from a seeded RNG,
  and `game/src/shots.js` replays it with an autopilot, which is how the screenshots
  were taken (`?shot=title|play|siege|over&seed=7`, see `shots.json`).

## Technology

Plain HTML5 canvas and ES modules — no engine, no libraries, no build step, no assets,
no network requests. The whole game is 13 text files under `game/` (77 KB).

| File | Job |
| --- | --- |
| `game/index.html` | The page: canvas, styles, screen-reader status line |
| `game/src/config.js` | Arena, palette and every balance number |
| `game/src/random.js` | Seeded RNG (mulberry32) |
| `game/src/input.js` | Keyboard/mouse state, read once a frame |
| `game/src/audio.js` | WebAudio sound effects and the music sequencer |
| `game/src/particles.js` | Sparks, rings, debris, trails, floating score text |
| `game/src/enemies.js` | The four enemy kinds: stats and behaviour |
| `game/src/pickups.js` | The five pickups: drops, magnetism, effects |
| `game/src/waves.js` | Wave rosters and the spawn director |
| `game/src/world.js` | The simulation: player, combat, collisions, scoring |
| `game/src/render.js` | All drawing: arena, entities, HUD, screens |
| `game/src/shots.js` | The autopilot and the deterministic screenshot scenes |
| `game/src/main.js` | Bootstrap, fixed-step loop, screen flow, sound wiring |

`main.ts` (Node 22, standard library only) is the hand-in program: it copies `game/`
and `screenshots/` to the output directory and writes `dossier.json` with
`buildDossier` from `vendor/makefun-game.ts` (the kit's library, byte for byte
unchanged; sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`).

## Run it

Play locally (any static server works):

```sh
node serve.ts            # then open the printed localhost address
```

Produce the hand-in output:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Retake the screenshots (needs a Chromium and the driver used in development):

```sh
# open game/index.html?shot=<scene>&seed=7 per shots.json, wait for
# window.__shotReady, capture a 1280x720 JPEG into screenshots/
```

## Verification performed

- Interactive play-test in headless Chromium (real keyboard/mouse): title → click to
  start → 16 s of aimed play (score 0 → 951+, 13+ kills, wave 2) → pause/resume →
  passive play until the game-over screen → Enter restarts with full hull and score 0.
  11/11 checks passed, zero console/page errors, zero requests beyond the local
  server (13 file requests, all under `game/`).
- `node main.ts` run twice: `dossier.json` byte-identical across runs (373,488 bytes),
  game tree identical.
- Screenshots: 4 JPEGs at 1280×720, 45–72 KB each (cap 256 KB); re-rendering the
  `play` scene produced byte-identical output, proving the scenes are deterministic.
