// VOIDBLOOM's hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/ — plain files a desktop browser opens
// offline. This program delivers it: it copies game/ and screenshots/ from beside this
// file into the output directory and writes dossier.json there with buildDossier from
// the vendored make.fun library (vendor/makefun-game.ts, the kit's copy, unchanged).
// The grader's container mounts the output at /output; anywhere else, the
// MAKEFUN_OUTPUT_DIR environment variable names it instead:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Run it twice and the dossier bytes are the same: buildDossier reads only the two
// folders it is given, in a fixed order, and this program writes nothing else.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, passed through so the dossier this writes is the dossier the
// scorer rebuilds: at most 4 screenshots of 256 KiB, at most 993 game files and
// 48 MiB of game, no game path over 1,000 bytes, dossier text capped at 160 KiB.
const DOSSIER_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1_000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));
