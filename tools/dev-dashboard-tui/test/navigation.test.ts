import { describe, expect, it } from 'vitest';
import {
  clampFocus,
  cycleFilter,
  movePaneFocus,
  PANES,
  visiblePanes,
} from '../src/hooks/useNavigation.js';
import { FILTER_KEYS } from '../src/hooks/useStore.js';

describe('visiblePanes (focus follows the rendered panes)', () => {
  it('includes the rail only when it is shown', () => {
    expect(visiblePanes(true)).toEqual(['rail', 'list', 'detail']);
    expect(visiblePanes(false)).toEqual(['list', 'detail']);
  });
});

describe('clampFocus', () => {
  it('keeps a focus that is on a visible pane', () => {
    expect(clampFocus('detail', visiblePanes(false))).toBe('detail');
    expect(clampFocus('rail', visiblePanes(true))).toBe('rail');
  });

  it('re-homes a focus stranded on the hidden rail', () => {
    expect(clampFocus('rail', visiblePanes(false))).toBe('list');
  });
});

describe('movePaneFocus (h/l, ←/→ — clamped)', () => {
  it('moves one pane right/left', () => {
    expect(movePaneFocus('rail', 'right')).toBe('list');
    expect(movePaneFocus('list', 'right')).toBe('detail');
    expect(movePaneFocus('detail', 'left')).toBe('list');
    expect(movePaneFocus('list', 'left')).toBe('rail');
  });

  it('clamps at the ends (no wrap)', () => {
    expect(movePaneFocus('rail', 'left')).toBe('rail');
    expect(movePaneFocus('detail', 'right')).toBe('detail');
  });

  it('orders panes left-to-right to match the layout', () => {
    expect(PANES).toEqual(['rail', 'list', 'detail']);
  });

  it('never lands on the hidden rail', () => {
    const panes = visiblePanes(false);
    expect(movePaneFocus('list', 'left', panes)).toBe('list');
    expect(movePaneFocus('list', 'right', panes)).toBe('detail');
    expect(movePaneFocus('detail', 'left', panes)).toBe('list');
  });
});

describe('cycleFilter (Tab / Shift+Tab — wraps)', () => {
  it('cycles forward through the pills with wrap-around', () => {
    expect(cycleFilter('all', 1)).toBe('active');
    expect(cycleFilter(FILTER_KEYS[FILTER_KEYS.length - 1], 1)).toBe('all');
  });

  it('cycles backward with wrap-around', () => {
    expect(cycleFilter('all', -1)).toBe(FILTER_KEYS[FILTER_KEYS.length - 1]);
    expect(cycleFilter('active', -1)).toBe('all');
  });
});
