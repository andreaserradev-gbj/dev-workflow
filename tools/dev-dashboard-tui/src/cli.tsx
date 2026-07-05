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

// Fullscreen via the alternate screen buffer (lazygit-style): render on a
// separate buffer so the app fills the viewport, then restore the original
// terminal scrollback untouched on exit. Skipped when stdout isn't a TTY.
const ALT_ENTER = '\u001B[?1049h';
const ALT_LEAVE = '\u001B[?1049l';
const fullscreen = Boolean(process.stdout.isTTY);

const leaveFullscreen = () => {
  if (fullscreen) process.stdout.write(ALT_LEAVE);
};

if (fullscreen) process.stdout.write(ALT_ENTER);
// Safety net: never strand the user in the alt buffer if the process dies
// outside the normal exit path (the finally below handles the happy path).
process.on('exit', leaveFullscreen);

const { waitUntilExit } = render(<App scanDirs={scanDirs} />);
try {
  await waitUntilExit();
} finally {
  process.off('exit', leaveFullscreen);
  leaveFullscreen();
}
