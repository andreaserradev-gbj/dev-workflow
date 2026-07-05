#!/usr/bin/env node
import { render } from 'ink';
import { App } from './app.js';

// Walking-skeleton entry. Scan-directory resolution and the shared runtime
// (scanProjects / createWatcher from dev-workflow-core) are wired in Phase 3+;
// here we only need a render path that proves the bundle runs end to end.
render(<App />);
