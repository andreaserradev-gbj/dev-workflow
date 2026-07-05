#!/usr/bin/env node
import { render } from 'ink';
import { resolveScanDirs } from 'dev-workflow-core';
import { App } from './app.js';

// Resolve scan dirs with the same precedence as the CLI/dashboard: an explicit
// --scan flag wins, else the dashboard's stored config.json scanDirs, else cwd.
// (Live watching arrives in Phase 7; this is still a one-shot scan.)
const scanArgIndex = process.argv.indexOf('--scan');
const scanFlag = scanArgIndex !== -1 ? (process.argv[scanArgIndex + 1] ?? null) : null;
const scanDirs = await resolveScanDirs(scanFlag);

render(<App scanDirs={scanDirs} />);
