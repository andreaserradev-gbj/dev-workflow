#!/usr/bin/env node
/**
 * Bundle the dev-workflow CLI into a single CJS file at
 * plugins/dev-workflow/bin/dev-workflow.cjs so skills can
 * invoke it via `node <plugin-dir>/bin/dev-workflow.cjs`.
 *
 * Usage: node scripts/bundle.js
 */

import { build } from 'esbuild';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// esbuild plugin: neutralize the dynamic-code-execution primitives that skills.sh's
// scanners (Gen REMOTE_CODE_EXECUTION, Socket usesEval) flag in the emitted bundle. Two
// dependency-shipped primitives exist, both UNREACHABLE in dev-workflow's usage but visible
// to a scanner reading the artifact text:
//   1. gray-matter/lib/engines.js — its JavaScript frontmatter engine builds a function string
//      and `eval()`s it. We parse YAML frontmatter only (never `js`/`javascript`), so the whole
//      engine is dead. We remove the ENTIRE `engines.javascript` registration, not just the eval
//      call: Gen's REMOTE_CODE_EXECUTION read is an LLM judgment that cites the string-building
//      scaffolding around the eval, so neutralizing only the call leaves the sink visible. An
//      inert throwing stub leaves the scanner nothing to cite.
//   2. js-yaml/lib/js-yaml/type/js/function.js — `new Function()` in the `!!js/function` YAML
//      type. gray-matter parses via `safeLoad` (safe schema EXCLUDES this type), so it is dead
//      too — but Socket's usesEval alert also covers the Function constructor, so it must go.
// Stripping both is behavior-preserving for every .dev/ PRD shape (gray-matter's safe YAML
// path via js-yaml safeLoad/safeDump is untouched). Each replace is GUARDED: if a dependency
// bump changes the internals so a pattern no longer matches, the build fails loudly rather
// than silently shipping the primitive again.
const stripDynamicCodeEval = {
  name: 'strip-dynamic-code-eval',
  setup(build) {
    build.onLoad({ filter: /gray-matter[\\/]lib[\\/]engines\.js$/ }, async (args) => {
      const original = await readFile(args.path, 'utf8');
      // Replace the ENTIRE engines.javascript registration, not just its eval() call. Gen's
      // REMOTE_CODE_EXECUTION read is an LLM judgment that cites the surrounding string-building
      // scaffolding ('(function(){ return ' + str + '}())'), so neutralizing only the literal
      // eval leaves the sink visible. The javascript engine is dead in dev-workflow (YAML
      // frontmatter only), so an inert throwing stub is behavior-preserving and cite-proof.
      const patched = original.replace(
        /engines\.javascript = \{[\s\S]*?stringifying JavaScript is not supported[\s\S]*?\n\};/,
        [
          'engines.javascript = {',
          '  parse: function() {',
          "    throw new Error('gray-matter JavaScript frontmatter engine disabled by dev-workflow build');",
          '  },',
          '  stringify: function() {',
          "    throw new Error('stringifying JavaScript is not supported');",
          '  }',
          '};',
        ].join('\n'),
      );
      if (patched === original) {
        throw new Error(
          'strip-dynamic-code-eval: expected engines.javascript = { ... } block not found in ' +
            'gray-matter engines.js — internals changed; update this build stub before shipping.',
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
const OUT_DIR = resolve(REPO_ROOT, 'plugins/dev-workflow/bin');
const OUT_FILE = resolve(OUT_DIR, 'dev-workflow.cjs');

// Skill directories that need a copy of the bundle
const SKILL_DIRS = [
  'dev-checkpoint',
  'dev-plan',
  'dev-resume',
  'dev-review',
  'dev-wiki',
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
    plugins: [stripDynamicCodeEval],
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
