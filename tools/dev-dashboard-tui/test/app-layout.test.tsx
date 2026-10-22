import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app.js';
import { DETAIL_PANE_WIDTH } from '../src/layout.js';
import { renderAtWidth, type RenderAtWidth } from './helpers/renderAtWidth.js';

// A checkpoint-only feature whose next-action carries a distinctive token, so
// the detail pane's content is identifiable in the rendered frame.
function checkpoint(token: string): string {
  return `<context>\n## Context\nctx\n</context>\n\n<next_action>\n## Next Steps\n${token}\n</next_action>\n`;
}

/**
 * Outer widths of the bordered panes, read off the frame's first border row.
 * Each pane contributes `╭…╮`; splitting on `╮` and re-adding that separator
 * column yields the border-box width the resolver asked for.
 */
function paneWidths(frame: string): number[] {
  const borderRow = frame.split('\n').find((line) => line.includes('╭')) ?? '';
  return borderRow
    .split('╮')
    .filter((part) => part.length > 0)
    .map((part) => part.length + 1);
}

describe('App responsive layout', () => {
  let scanDir: string;

  beforeEach(() => {
    scanDir = mkdtempSync(join(tmpdir(), 'tui-layout-'));
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

  /** Mount at `columns` and wait for the scan to settle. */
  async function mountAt(columns: number): Promise<RenderAtWidth> {
    const view = renderAtWidth(<App scanDirs={[scanDir]} />, columns);
    await vi.waitFor(() => {
      expect(view.lastFrame()).toMatch(/_MARK/);
    });
    return view;
  }

  const shownToken = (frame: string): 'AAA_MARK' | 'BBB_MARK' | null =>
    frame.includes('AAA_MARK') ? 'AAA_MARK' : frame.includes('BBB_MARK') ? 'BBB_MARK' : null;

  it('narrows the rail to 16 before hiding it', async () => {
    const wide = await mountAt(160);
    expect(paneWidths(wide.lastFrame())).toEqual([28, 72, 60]);
    wide.unmount();

    const mid = await mountAt(133);
    expect(paneWidths(mid.lastFrame())).toEqual([16, 57, 60]);
    mid.unmount();

    const narrow = await mountAt(115);
    const frame = narrow.lastFrame();
    expect(paneWidths(frame)).toEqual([55, 60]);
    expect(frame).not.toContain('Projects');
    expect(frame).toContain('aaa-first');
    expect(frame).toMatch(/_MARK/);
    narrow.unmount();
  });

  it('keeps the detail at 60 columns down to 60, then takes the viewport', async () => {
    for (const columns of [200, 160, 134, 133, 100, 80, 76, 60]) {
      const view = await mountAt(columns);
      expect(paneWidths(view.lastFrame()).at(-1)).toBe(DETAIL_PANE_WIDTH);
      expect(view.lastFrame()).toMatch(/_MARK/);
      view.unmount();
    }

    const tiny = await mountAt(40);
    expect(paneWidths(tiny.lastFrame())).toEqual([40]);
    tiny.unmount();
  });

  it('shrinks the list, not the detail, as the terminal narrows', async () => {
    const at100 = await mountAt(100);
    expect(paneWidths(at100.lastFrame())).toEqual([40, 60]);
    at100.unmount();

    const at133 = await mountAt(133);
    expect(paneWidths(at133.lastFrame())).toEqual([16, 57, 60]);
    at133.unmount();

    const at76 = await mountAt(76);
    expect(paneWidths(at76.lastFrame())).toEqual([16, 60]);
    at76.unmount();
  });

  it('gives the list the focus when the rail is hidden', async () => {
    const view = await mountAt(100);
    const before = shownToken(view.lastFrame());

    // No 'l' needed: with the rail hidden the list already holds the focus.
    view.stdin.write('j');
    await vi.waitFor(() => {
      expect(shownToken(view.lastFrame())).not.toBe(before);
    });

    view.unmount();
  });

  it('re-clamps the focus onto a visible pane when the rail disappears', async () => {
    const view = await mountAt(160);
    const before = shownToken(view.lastFrame());

    // Shrinking past 116 hides the rail; the stranded 'rail' focus must land on
    // the list, so a bare j moves the feature selection rather than the project.
    view.setColumns(100);
    await vi.waitFor(() => {
      expect(paneWidths(view.lastFrame())).toEqual([40, 60]);
    });
    view.stdin.write('j');
    await vi.waitFor(() => {
      expect(shownToken(view.lastFrame())).not.toBe(before);
    });

    view.unmount();
  });

  it('replaces the list with a one-line feature strip below 76 columns', async () => {
    const view = await mountAt(70);
    const frame = view.lastFrame();

    // No list pane: the detail is the only bordered box, and the strip above it
    // names the selected feature plus its neighbour.
    expect(paneWidths(frame)).toEqual([60]);
    expect(frame.split('\n').some((line) => line.includes('╭'))).toBe(true);
    expect(frame).not.toContain('proj');
    expect(frame).toMatch(/aaa-first/);
    expect(frame).toMatch(/bbb-second/);
    expect(frame).toMatch(/_MARK/);

    // The strip is not a dead label: j still moves the selection.
    const before = shownToken(frame);
    view.stdin.write('j');
    await vi.waitFor(() => {
      expect(shownToken(view.lastFrame())).not.toBe(before);
    });
    expect(view.lastFrame()).toMatch(/‹\s*aaa-first\s*›\s*bbb-second/);

    view.unmount();
  });

  it('clips the bars instead of wrapping them, keeping the frame height', async () => {
    const view = await mountAt(50);
    const frame = view.lastFrame();
    const lines = frame.split('\n');

    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(50);
    expect(lines).toHaveLength(24);
    expect(frame).toContain('j/k move · h/l pane · 1-6 filter · q quit');

    view.unmount();
  });
});
