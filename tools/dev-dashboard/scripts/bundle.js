#!/usr/bin/env node
/**
 * Bundle the dev-dashboard server into a single CJS file and copy the
 * Vite-built client, producing a self-contained distribution under
 * plugins/dev-workflow/skills/dev-dashboard/dashboard/ so the skill
 * is fully self-contained and works across Claude Code, Codex, and Gemini.
 *
 * Usage: node scripts/bundle.js
 *   (run after `npm run build` so dist/client/ exists)
 */

import { build } from 'esbuild';
import { cp, mkdir, rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(ROOT, '../..');
const OUT_DIR = resolve(REPO_ROOT, 'plugins/dev-workflow/skills/dev-dashboard/dashboard');

async function bundle() {
  // Clean output directory
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(resolve(OUT_DIR, 'server'), { recursive: true });

  // Bundle server into a single CJS file
  // Structure: dashboard/server/index.cjs + dashboard/client/
  // so that resolve(__dirname, '../client') works in the bundled server
  await build({
    entryPoints: [resolve(ROOT, 'src/server/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    outfile: resolve(OUT_DIR, 'server/index.cjs'),
    minify: true,
    sourcemap: false,
    // Keep these external — they're Node.js builtins
    external: ['fs', 'path', 'os', 'url', 'http', 'https', 'net', 'stream',
      'events', 'util', 'crypto', 'buffer', 'child_process', 'worker_threads',
      'node:*'],
  });

  // Copy Vite-built client
  const clientSrc = resolve(ROOT, 'dist/client');
  const clientDst = resolve(OUT_DIR, 'client');
  await cp(clientSrc, clientDst, { recursive: true });

  // Report sizes
  const { statSync } = await import('fs');
  const serverSize = statSync(resolve(OUT_DIR, 'server/index.cjs')).size;
  console.log(`server/index.cjs  ${(serverSize / 1024).toFixed(0)} KB`);
  console.log(`client/           copied from dist/client/`);
  console.log(`\nBundle written to: ${OUT_DIR}`);
}

bundle().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
