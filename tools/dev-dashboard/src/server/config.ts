// Re-export config loading/watching from the shared workflow core's live subpath.
// The core is the single owner of state/config/watcher semantics.
// Thin adapter: surfaces only what the dashboard server consumes, keeping the
// `./config.js` import path stable for index.ts/api.ts.
export {
  loadConfig,
  parseCliArgs,
  watchConfig,
  ConfigReadError,
  expandHome,
  getConfigPath,
  readStoredConfig,
  updateConfig,
} from 'dev-workflow-core/live';
