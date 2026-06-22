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

// esbuild plugin: neutralize the dynamic-code-execution primitives that skills.sh's static
// scanners (Gen REMOTE_CODE_EXECUTION, Socket usesEval) would flag in the emitted bundle.
// The dashboard server re-exports dev-workflow-core's parser/writer, which pull gray-matter
// (and its js-yaml dependency) in transitively. Two dependency-shipped primitives exist, both
// UNREACHABLE in dev-workflow's usage but visible to a scanner reading the artifact text:
//   1. gray-matter/lib/engines.js — `eval()` in its JavaScript frontmatter engine (we parse
//      YAML only, never `js`/`javascript`).
//   2. js-yaml/lib/js-yaml/type/js/function.js — `new Function()` in the `!!js/function` type
//      (gray-matter uses `safeLoad`, whose safe schema excludes this type).
// Stripping both is behavior-preserving (the safe YAML path is untouched). Each replace is
// GUARDED so a dependency bump that moves the pattern fails the build loudly instead of
// silently re-shipping the primitive. Mirror of the stub in dev-workflow-cli/scripts/bundle.js.
// NOTE: the dashboard server bundle also contains `new Function(` from ajv / fastify
// (fast-json-stringify, find-my-way) — that is their core schema/serializer codegen, is not
// removable, and is NOT a rating driver (the server bundle was never in any scanner report;
// the dev-dashboard MEDs are the install chain + SKILL.md). We intentionally do not touch it.
const stripDynamicCodeEval = {
  name: 'strip-dynamic-code-eval',
  setup(build) {
    build.onLoad({ filter: /gray-matter[\\/]lib[\\/]engines\.js$/ }, async (args) => {
      const original = await readFile(args.path, 'utf8');
      const patched = original.replace(
        /return eval\(str\) \|\| \{\};/,
        'return {}; // gray-matter JS frontmatter engine disabled by dev-workflow build (no eval)',
      );
      if (patched === original) {
        throw new Error(
          'strip-dynamic-code-eval: expected eval(str) pattern not found in gray-matter engines.js — ' +
            'internals changed; update this build stub before shipping.',
        );
      }
      return { contents: patched, loader: 'js' };
    });
    build.onLoad(
      { filter: /js-yaml[\\/]lib[\\/]js-yaml[\\/]type[\\/]js[\\/]function\.js$/ },
      async (args) => {
        const original = await readFile(args.path, 'utf8');
        const patched = original.replace(
          /new Function\(/g,
          '(function(){throw new Error("js-yaml js/function type disabled by dev-workflow build")})(',
        );
        if (patched === original) {
          throw new Error(
            'strip-dynamic-code-eval: expected new Function( pattern not found in js-yaml ' +
              'type/js/function.js — internals changed; update this build stub before shipping.',
          );
        }
        return { contents: patched, loader: 'js' };
      },
    );
  },
};

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
    plugins: [stripDynamicCodeEval],
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
