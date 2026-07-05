// Re-export the dashboard state runtime from the shared workflow core.
// The core is the single owner of state/config/watcher semantics (see its `./live` subpath).
// Thin adapter: surfaces only what the dashboard server consumes, keeping the
// `./state.js` import path stable for index.ts/api.ts/ws.ts.
export { DashboardState } from 'dev-workflow-core/live';
