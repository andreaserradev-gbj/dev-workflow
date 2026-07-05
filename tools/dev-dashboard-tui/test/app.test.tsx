import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
