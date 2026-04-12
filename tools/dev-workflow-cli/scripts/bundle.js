#!/usr/bin/env node
/**
 * Bundle the dev-workflow CLI into a single CJS file at
 * plugins/dev-workflow/bin/dev-workflow.cjs so skills can
 * invoke it via `node <plugin-dir>/bin/dev-workflow.cjs`.
 *
 * Usage: node scripts/bundle.js
 */

import { build } from 'esbuild';
import { mkdir, rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(ROOT, '../..');
const OUT_DIR = resolve(REPO_ROOT, 'plugins/dev-workflow/bin');
const OUT_FILE = resolve(OUT_DIR, 'dev-workflow.cjs');

// Skill directories that need a copy of the bundle
const SKILL_DIRS = [
  'dev-checkpoint',
  'dev-plan',
  'dev-resume',
];
const SKILL_COPY_DIR = resolve(REPO_ROOT, 'plugins/dev-workflow/skills');

async function bundle() {
  await mkdir(OUT_DIR, { recursive: true });

  await build({
    entryPoints: [resolve(ROOT, 'src/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    outfile: OUT_FILE,
    minify: true,
    sourcemap: false,
    external: [
      'fs', 'path', 'os', 'url', 'http', 'https', 'net', 'stream',
      'events', 'util', 'crypto', 'buffer', 'child_process', 'worker_threads',
      'node:*',
    ],
  });

  const { statSync, copyFileSync } = await import('fs');
  const size = statSync(OUT_FILE).size;
  console.log(`dev-workflow.cjs  ${(size / 1024).toFixed(0)} KB`);
  console.log(`\nBundle written to: ${OUT_FILE}`);

  // Sync bundle to skill directories
  for (const skill of SKILL_DIRS) {
    const dest = resolve(SKILL_COPY_DIR, skill, 'scripts', 'dev-workflow.cjs');
    copyFileSync(OUT_FILE, dest);
    console.log(`Synced to: ${dest}`);
  }
}

bundle().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
