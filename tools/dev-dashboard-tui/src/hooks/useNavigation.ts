import { useEffect, useState } from 'react';
import { useApp, useInput } from 'ink';
import { FILTER_KEYS, type FilterKey, type Store } from './useStore.js';

export type Pane = 'rail' | 'list' | 'detail';

// Left-to-right pane order — matches the on-screen layout, so h/l map to
// prev/next in this array.
export const PANES: readonly Pane[] = ['rail', 'list', 'detail'];

export interface NavState {
  focus: Pane;
  sessionExpanded: boolean;
  /** Whole-pane vertical scroll offset for the detail pane (rows). */
  detailScroll: number;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Move focus one pane left/right, clamped at the ends (h/l, ←/→). */
export function movePaneFocus(current: Pane, dir: 'left' | 'right'): Pane {
  const i = PANES.indexOf(current);
  return dir === 'right' ? PANES[Math.min(i + 1, PANES.length - 1)] : PANES[Math.max(i - 1, 0)];
}

/** Cycle the active filter forward/back with wrap-around (Tab / Shift+Tab). */
export function cycleFilter(current: FilterKey, dir: 1 | -1): FilterKey {
  const i = FILTER_KEYS.indexOf(current);
  return FILTER_KEYS[(i + dir + FILTER_KEYS.length) % FILTER_KEYS.length];
}

/**
 * Keyboard focus model (master-plan Phase 4). Horizontal keys (h/l, ←/→) move
 * focus between rail ↔ list ↔ detail; vertical keys (j/k, ↑/↓) move the selection
 * *within* the focused pane — project in the rail, feature in the list, session
 * scroll in the detail. Tab / Shift+Tab cycle the filter (arrows already own pane
 * focus); 1–6 jump straight to a filter; q / Ctrl+C quit.
 *
 * Owns the transient view state (focus + session expand + detail scroll) and
 * drives the store's selection setters; the store stays the sole data owner.
 *
 * `detailScrollMax` is measured by the detail pane (content height vs. viewport)
 * and threaded back in so j/k can't scroll past the end.
 */
export function useNavigation(store: Store, detailScrollMax = 0): NavState {
  const { exit } = useApp();
  const [focus, setFocus] = useState<Pane>('rail');
  const [sessionExpanded, setSessionExpanded] = useState(false);
  const [detailScroll, setDetailScroll] = useState(0);

  // Reset the detail scroll whenever the selected feature changes, so a fresh
  // detail never opens mid-scroll. Keyed on project+feature (names repeat).
  const featureKey = `${store.selectedProject?.name ?? ''}/${store.selectedFeature?.name ?? ''}`;
  useEffect(() => {
    setDetailScroll(0);
  }, [featureKey]);

  useInput((input, key) => {
    // Switching filters re-homes both cursors so the list + detail never point
    // at a stale index in the newly filtered set.
    const selectFilter = (filter: FilterKey) => {
      store.setFilter(filter);
      store.setSelectedProjectIndex(0);
      store.setSelectedFeatureIndex(0);
    };

    // ─── Global ───────────────────────────────────────────────
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }
    const n = Number.parseInt(input, 10);
    if (Number.isInteger(n) && n >= 1 && n <= FILTER_KEYS.length) {
      selectFilter(FILTER_KEYS[n - 1]);
      return;
    }

    // ─── Filter cycling (Tab / Shift+Tab) ─────────────────────
    if (key.tab) {
      selectFilter(cycleFilter(store.filter, key.shift ? -1 : 1));
      return;
    }

    // ─── Horizontal: focus across panes ───────────────────────
    if (input === 'l' || key.rightArrow) {
      setFocus((f) => movePaneFocus(f, 'right'));
      return;
    }
    if (input === 'h' || key.leftArrow) {
      setFocus((f) => movePaneFocus(f, 'left'));
      return;
    }

    // ─── Detail: toggle the session history ───────────────────
    if (focus === 'detail' && (key.return || input === ' ')) {
      setSessionExpanded((v) => !v);
      return;
    }

    // ─── Vertical: selection within the focused pane ──────────
    const down = key.downArrow || input === 'j';
    const up = key.upArrow || input === 'k';
    if (!down && !up) return;
    const delta = down ? 1 : -1;

    if (focus === 'rail') {
      // Moving projects re-homes the feature cursor to the first row so the
      // list + detail never point at a stale index.
      store.setSelectedProjectIndex(
        clamp(store.selectedProjectIndex + delta, 0, store.filteredProjects.length - 1),
      );
      store.setSelectedFeatureIndex(0);
    } else if (focus === 'list') {
      const count = store.selectedProject?.features.length ?? 0;
      store.setSelectedFeatureIndex(clamp(store.selectedFeatureIndex + delta, 0, count - 1));
    } else {
      // Detail pane focused: j/k scroll the whole pane, bounded by the range the
      // pane measured (0 when everything already fits).
      setDetailScroll((s) => clamp(s + delta, 0, detailScrollMax));
    }
  });

  return { focus, sessionExpanded, detailScroll };
}
