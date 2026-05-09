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
import { cp, mkdir, rm, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(ROOT, '../..');
const OUT_DIR = resolve(REPO_ROOT, 'plugins/dev-workflow/skills/dev-dashboard/dashboard');

// Read the user-facing plugin version from marketplace.json. The dashboard's
// own package.json tracks an unrelated 0.x version, so reading from
// marketplace.json keeps the About tab aligned with what users install.
async function readPluginVersion() {
  const raw = await readFile(resolve(REPO_ROOT, '.claude-plugin/marketplace.json'), 'utf-8');
  const marketplace = JSON.parse(raw);
  const plugin = (marketplace.plugins ?? []).find((p) => p.name === 'dev-workflow');
  return plugin?.version ?? 'dev';
}

async function bundle() {
  // Clean output directory
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(resolve(OUT_DIR, 'server'), { recursive: true });

  const pluginVersion = await readPluginVersion();

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
    define: {
      // Substituted into src/server/version.ts at bundle time.
      __VERSION__: JSON.stringify(pluginVersion),
    },
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
  console.log(`__VERSION__       ${pluginVersion}`);
  console.log(`\nBundle written to: ${OUT_DIR}`);
}

bundle().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
