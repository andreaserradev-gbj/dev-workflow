import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';

describe('App (portfolio)', () => {
  let scanDir: string;

  beforeEach(() => {
    // An empty dir with no .dev/ — the scan resolves fast to zero projects.
    scanDir = mkdtempSync(join(tmpdir(), 'tui-app-'));
  });

  afterEach(() => {
    rmSync(scanDir, { recursive: true, force: true });
  });

  it('shows the scanning frame on first render', () => {
    const { lastFrame, unmount } = render(<App scanDirs={[scanDir]} />);
    expect(lastFrame()).toContain('Scanning');
    unmount();
  });

  it('exits cleanly when q is pressed', () => {
    const { stdin, unmount } = render(<App scanDirs={[scanDir]} />);
    // Should not throw: useInput is wired and the q handler calls exit().
    stdin.write('q');
    unmount();
  });
});

// A feature whose only artifact is a checkpoint carrying a distinctive
// next-action token — the token appears solely in the detail pane, so it's a
// clean signal for which feature the detail is currently showing.
function checkpoint(token: string): string {
  return `<context>\n## Context\nctx\n</context>\n\n<next_action>\n## Next Steps\n${token}\n</next_action>\n`;
}

describe('App (keyboard navigation)', () => {
  let scanDir: string;

  beforeEach(() => {
    scanDir = mkdtempSync(join(tmpdir(), 'tui-nav-'));
    for (const [name, token] of [
      ['aaa-first', 'AAA_MARK'],
      ['bbb-second', 'BBB_MARK'],
    ]) {
      const featureDir = join(scanDir, 'proj', '.dev', name);
      mkdirSync(featureDir, { recursive: true });
      writeFileSync(join(featureDir, 'checkpoint.md'), checkpoint(token));
    }
  });

  afterEach(() => {
    rmSync(scanDir, { recursive: true, force: true });
  });

  // The detail pane's next-action token identifies the selected feature.
  const shownToken = (frame: string): 'AAA_MARK' | 'BBB_MARK' | null =>
    frame.includes('AAA_MARK') ? 'AAA_MARK' : frame.includes('BBB_MARK') ? 'BBB_MARK' : null;

  it('shows a feature in the detail pane after the scan settles', async () => {
    const { lastFrame, unmount } = render(<App scanDirs={[scanDir]} />);
    await vi.waitFor(() => {
      expect(shownToken(lastFrame() ?? '')).not.toBeNull();
    });
    unmount();
  });

  it('moves the feature selection with the list focused, updating the detail pane', async () => {
    const { stdin, lastFrame, unmount } = render(<App scanDirs={[scanDir]} />);

    await vi.waitFor(() => {
      expect(shownToken(lastFrame() ?? '')).not.toBeNull();
    });
    const before = shownToken(lastFrame() ?? '');

    // l → focus the feature list; j → next feature. The two keys must land in
    // separate render cycles: Ink re-subscribes useInput after each render, and
    // only then does the handler see focus === 'list' (real keypresses arrive in
    // separate ticks; back-to-back synchronous writes hit one stale closure).
    stdin.write('l');
    await new Promise((resolve) => setTimeout(resolve, 30));
    stdin.write('j');

    await vi.waitFor(() => {
      const now = shownToken(lastFrame() ?? '');
      expect(now).not.toBeNull();
      expect(now).not.toBe(before);
    });

    unmount();
  });
});
