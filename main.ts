// MERIDIAN RUN — hand-in program for the make.fun best-flight-game bounty.
//
// The game itself is the static site under game/ (three.js vendored as a
// *.min.js, every line of game code in game/src/). This program is the
// courier: it copies game/ and screenshots/ into the output directory and
// writes dossier.json there with make.fun's own dossier library, so the
// sealed scorer can rebuild the same bytes from the same files and compare.
//
// Run locally the same way the grader does, with MAKEFUN_OUTPUT_DIR
// standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored so a bad hand-in fails here first with a
// readable message instead of a silent zero at the gate.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function refuse(message: string): never {
  console.error(`meridian-run hand-in refused: ${message}`);
  process.exit(1);
}

function checkScreenshots(dir: string): string[] {
  if (!existsSync(dir)) refuse('screenshots/ is missing');
  const shots = readdirSync(dir).filter((name) => !name.startsWith('.')).sort();
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    refuse(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
  }
  for (const name of shots) {
    const bytes = statSync(join(dir, name)).size;
    if (bytes > CAPS.screenshots.max_bytes) {
      refuse(`${name} is ${bytes} bytes, over the ${CAPS.screenshots.max_bytes}-byte screenshot cap`);
    }
  }
  return shots;
}

function countGameFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    count += 1;
    if (entry.isDirectory()) count += countGameFiles(join(dir, entry.name));
  }
  return count;
}

const gameDir = join(repoRoot, 'game');
if (!existsSync(join(gameDir, 'index.html'))) refuse('game/index.html is missing');
const gameEntries = countGameFiles(gameDir);
if (gameEntries > CAPS.game_max_files) refuse(`game/ holds ${gameEntries} entries, over the ${CAPS.game_max_files} cap`);
const shots = checkScreenshots(join(repoRoot, 'screenshots'));

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(
  `meridian-run: handed in game/ (${gameEntries} entries) + ${shots.length} screenshots (${shots.join(', ')}) -> ${outputDir}`,
);
