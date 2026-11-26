// Merpati Nusantara — entrypoint (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ beside this file
// into the output directory, then writes /output/dossier.json with
// buildDossier from ./vendor/makefun-game.ts.
//
// Run it from the entry directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Where the entry lives (the directory holding this file).
const entryDir = dirname(fileURLToPath(import.meta.url));

// Where the handed-in files go: the environment's override, else /output.
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The dossier caps are the bounty's own (gate.json): text up to 160 KiB,
// at most 4 screenshots of at most 256 KiB each, game/ at most 993
// entries and 48 MiB, every game path at most 1000 bytes.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  // Start from a clean output directory so a stale file can never
  // ride along with the entry.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // Copy the playable game and its screenshots in as-is.
  for (const name of ['game', 'screenshots']) {
    const source = join(entryDir, name);
    if (!existsSync(source)) throw new Error(`missing ${name}/ beside main.ts`);
    cpSync(source, join(outputDir, name), { recursive: true });
  }

  // The dossier is written from the copied files, exactly as the
  // scorer will write it again when it grades the entry.
  const dossier = buildDossier(outputDir, dossierCaps);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  // Confirm the hand-in is whole before reporting it: the game must
  // be playable from the output directory alone.
  const indexHtml = join(outputDir, 'game', 'index.html');
  if (!existsSync(indexHtml)) throw new Error('game/index.html missing from the hand-in');
  const shots = readdirSync(join(outputDir, 'screenshots')).filter((f) => !f.startsWith('.'));
  console.log(`handed in ${outputDir}: game/index.html, ${shots.length} screenshot(s), dossier ${dossier.length} bytes`);
}

handIn();
