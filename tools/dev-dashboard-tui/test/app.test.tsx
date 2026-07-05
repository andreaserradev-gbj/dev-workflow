import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app.js';

describe('App (walking skeleton)', () => {
  it('renders the hello frame', () => {
    const { lastFrame, unmount } = render(<App />);
    expect(lastFrame()).toContain('Hello from dev-dashboard-tui');
    unmount();
  });

  it('exits cleanly when q is pressed', () => {
    const { stdin, unmount } = render(<App />);
    // Should not throw: useInput is wired and the q handler calls exit().
    stdin.write('q');
    unmount();
  });
});
