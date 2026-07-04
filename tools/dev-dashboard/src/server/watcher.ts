// Re-export the .dev/ file watcher from the shared workflow core's live subpath.
// The core is the single owner of state/config/watcher semantics.
// Thin adapter: surfaces only what the dashboard server consumes, keeping the
// `./watcher.js` import path stable for index.ts.
export { createWatcher } from 'dev-workflow-core/live';
