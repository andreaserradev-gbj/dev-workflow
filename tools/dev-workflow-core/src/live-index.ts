// Live runtime layer — dashboard state, config I/O, and the .dev/ file watcher.
// Node-only: pulls in chokidar. Deliberately exposed via the `./live` subpath and
// intentionally NOT re-exported from the main `index.ts` barrel, so the agent CLI
// and the browser client bundles never resolve chokidar. Mirrors the node-free
// `./types` subpath: module resolution — not tree-shaking — is what keeps the
// heavyweight runtime out of the consumers that must stay light.
export * from './state.js';
export * from './config.js';
export * from './watcher.js';
