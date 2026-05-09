// Plugin version surfaced to the About tab via GET /api/config.
//
// At bundle time, scripts/bundle.js reads `.claude-plugin/marketplace.json`
// and substitutes `__VERSION__` via esbuild's `define` option. In dev mode
// (tsx watch) the symbol is undeclared — `typeof` on an undeclared variable
// is the one expression in JS that does NOT throw a ReferenceError, so the
// fallback to 'dev' is safe.
declare const __VERSION__: string;

export const VERSION: string = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
