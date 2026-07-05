import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';

// A checkpoint whose next-action token surfaces only in the detail pane, so the
// token in the rendered frame tells us exactly which content the pane is showing.
function checkpoint(token: string): string {
  return `<context>\n## Context\nctx\n</context>\n\n<next_action>\n## Next Steps\n${token}\n</next_action>\n`;
}

// End-to-end live refresh over the real chokidar watcher + real fs (matching the
// real-fs style of app.test.tsx). Deterministic timing lives in
// store-watcher.test.tsx (mocked watcher + fake timers).
describe('App (live refresh)', () => {
  let scanDir: string;
  let checkpointPath: string;

  beforeEach(() => {
    scanDir = mkdtempSync(join(tmpdir(), 'tui-live-'));
    const featureDir = join(scanDir, 'proj', '.dev', 'live-feat');
    mkdirSync(featureDir, { recursive: true });
    checkpointPath = join(featureDir, 'checkpoint.md');
    writeFileSync(checkpointPath, checkpoint('OLD_MARK'));
  });

  afterEach(() => {
    rmSync(scanDir, { recursive: true, force: true });
  });

  it('rebuilds the open detail pane when the feature checkpoint changes on disk', async () => {
    const { lastFrame, unmount } = render(<App scanDirs={[scanDir]} />);

    // First render settles: the auto-selected feature's detail shows OLD_MARK.
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('OLD_MARK'), { timeout: 5000 });

    // Let the watcher finish reaching 'ready' before mutating, so the change
    // event is actually observed (readiness races the initial scan).
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Edit the open feature's checkpoint. Status is unchanged (still
    // checkpoint-only), so the detail pane only refreshes via the revision bump.
    writeFileSync(checkpointPath, checkpoint('NEW_MARK'));

    await vi.waitFor(
      () => {
        const frame = lastFrame() ?? '';
        expect(frame).toContain('NEW_MARK');
        expect(frame).not.toContain('OLD_MARK');
      },
      { timeout: 5000, interval: 100 },
    );

    unmount();
  });
});
