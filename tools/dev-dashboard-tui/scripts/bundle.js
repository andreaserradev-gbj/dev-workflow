#!/usr/bin/env node
/**
 * Bundle the dev-dashboard-tui into a single self-contained artifact under
 * plugins/dev-workflow/skills/dev-dashboard-tui/tui/ so the launch skill can
 * run it via `node <plugin-dir>/tui/cli.mjs`.
 *
 * The TUI collapses the web dashboard's client/server split into one foreground
 * Ink process (scan → state → watcher → render). It pulls dev-workflow-core, so
 * it inherits gray-matter/js-yaml transitively — hence the shared
 * `stripDynamicCodeEval` plugin below (identical to the CLI + dashboard bundlers).
 *
 * OUTPUT FORMAT — ESM (.mjs), NOT CJS. Ink 7 + yoga-layout 3.2.1 emit four
 * top-level awaits that the `cjs` output format cannot represent: yoga's
 * unconditional WASM init (yoga-layout/index.js), and ink's reconciler
 * devtools/package-json probes (reconciler.js, DEV-gated). A CJS bundle would
 * require brittle multi-point source patches across ink's internals; ESM
 * supports TLA natively. Unlike the agent CLI (which skills invoke as
 * `node dev-workflow.cjs`, forcing CJS), the TUI is user-launched via
 * `node cli.mjs`, so there is no CJS constraint here. This is the ESM path the
 * TUI PRD documented as the fallback for exactly this bundling risk.
 *
 * Usage: node scripts/bundle.js
 */

import { build } from 'esbuild';
import { mkdir, readFile } from 'fs/promises';
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

// esbuild plugin: resolve ink's optional dev-only `react-devtools-core` dep to an
// inert empty stub. Ink only wires up devtools when process.env.DEV === 'true' (an
// opt-in), and the package is intentionally not installed. But esbuild hoists the
// never-executed `import devtools from 'react-devtools-core'` to the TOP of the ESM
// bundle, where it would throw ERR_MODULE_NOT_FOUND on load. Stubbing it keeps the
// import resolvable and harmless; ink's runtime DEV guard keeps the path dead.
const stubReactDevtools = {
  name: 'stub-react-devtools',
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: 'react-devtools-core',
      namespace: 'stub-react-devtools',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub-react-devtools' }, () => ({
      contents: 'export default {};',
      loader: 'js',
    }));
  },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(ROOT, '../..');
const OUT_DIR = resolve(REPO_ROOT, 'plugins/dev-workflow/skills/dev-dashboard-tui/tui');
const OUT_FILE = resolve(OUT_DIR, 'cli.mjs');

async function bundle() {
  await mkdir(OUT_DIR, { recursive: true });

  await build({
    entryPoints: [resolve(ROOT, 'src/cli.tsx')],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    outfile: OUT_FILE,
    minify: true,
    sourcemap: false,
    jsx: 'automatic',
    jsxImportSource: 'react',
    // Ink's CJS deps (e.g. signal-exit) call `require('assert')` etc. at runtime.
    // ESM module scope has no `require`, so esbuild's fallback shim throws
    // "Dynamic require of X is not supported". Inject a real require built from
    // this module's URL so those builtin requires resolve. (esbuild keeps the
    // entry shebang above this banner.)
    banner: {
      js: [
        "import { createRequire as __createRequire } from 'module';",
        'const require = __createRequire(import.meta.url);',
      ].join('\n'),
    },
    // NODE_ENV=production → React's production build (no dev warnings).
    // DEV=false → dead-code-eliminate Ink's DEV-gated reconciler branches
    // (react-devtools-core probe + package.json load), so the dev-only
    // react-devtools-core dynamic import never ships in the artifact.
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.DEV': '"false"',
    },
    plugins: [stripDynamicCodeEval, stubReactDevtools],
    external: [
      'fs', 'path', 'os', 'url', 'http', 'https', 'net', 'stream',
      'events', 'util', 'crypto', 'buffer', 'child_process', 'worker_threads',
      'tty', 'readline', 'node:*',
    ],
  });

  const { statSync } = await import('fs');
  const size = statSync(OUT_FILE).size;
  console.log(`cli.mjs  ${(size / 1024).toFixed(0)} KB`);
  console.log(`\nBundle written to: ${OUT_FILE}`);
}

bundle().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
