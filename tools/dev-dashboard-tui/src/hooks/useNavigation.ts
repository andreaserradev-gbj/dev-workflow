import { useEffect, useRef, useState } from 'react';
import { useApp, useInput } from 'ink';
import { FILTER_KEYS, type FilterKey, type Store } from './useStore.js';

export type Pane = 'rail' | 'list' | 'detail';

// Left-to-right pane order — matches the on-screen layout, so h/l map to
// prev/next in this array.
export const PANES: readonly Pane[] = ['rail', 'list', 'detail'];

/**
 * The panes actually rendered at this layout. Hiding the rail must remove it
 * from the focus cycle too, or h/l would stop on an invisible pane and swallow
 * j/k.
 */
export function visiblePanes(showRail: boolean): readonly Pane[] {
  return showRail ? PANES : PANES.filter((pane) => pane !== 'rail');
}

/** The focus if it is on a visible pane, else the first visible pane. */
export function clampFocus(focus: Pane, panes: readonly Pane[]): Pane {
  return panes.includes(focus) ? focus : (panes[0] ?? 'detail');
}

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
export function movePaneFocus(
  current: Pane,
  dir: 'left' | 'right',
  panes: readonly Pane[] = PANES,
): Pane {
  const i = Math.max(0, panes.indexOf(current));
  return dir === 'right' ? panes[Math.min(i + 1, panes.length - 1)] : panes[Math.max(i - 1, 0)];
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
 *
 * `showRail` mirrors the layout: when the rail is hidden it leaves the focus
 * cycle entirely, so h/l never land on an unrendered pane. Every key handler
 * branches on the clamped `active` focus, not the raw state — a stale `'rail'`
 * focus would otherwise swallow j/k after a resize.
 */
export function useNavigation(store: Store, detailScrollMax = 0, showRail = true): NavState {
  const { exit } = useApp();
  const panes = visiblePanes(showRail);
  const [focus, setFocus] = useState<Pane>(showRail ? 'rail' : 'list');
  const [sessionExpanded, setSessionExpanded] = useState(false);
  const [detailScroll, setDetailScroll] = useState(0);

  // Re-clamp on layout changes so a resize that hides the focused pane moves
  // the focus to the first visible one instead of stranding it. Keyed on the
  // pane set's string identity: `visiblePanes` returns a fresh array each render.
  const paneKey = panes.join(',');
  const panesRef = useRef(panes);
  panesRef.current = panes;
  useEffect(() => {
    setFocus((f) => clampFocus(f, panesRef.current));
  }, [paneKey]);

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
      setFocus((f) => movePaneFocus(clampFocus(f, panes), 'right', panes));
      return;
    }
    if (input === 'h' || key.leftArrow) {
      setFocus((f) => movePaneFocus(clampFocus(f, panes), 'left', panes));
      return;
    }

    // Branch on the clamped focus, never the raw state: a hidden pane keeps its
    // stale `focus` until the next render, and acting on it would drop the key.
    const active = clampFocus(focus, panes);

    // ─── Detail: toggle the session history ───────────────────
    if (active === 'detail' && (key.return || input === ' ')) {
      setSessionExpanded((v) => !v);
      return;
    }

    // ─── Vertical: selection within the focused pane ──────────
    const down = key.downArrow || input === 'j';
    const up = key.upArrow || input === 'k';
    if (!down && !up) return;
    const delta = down ? 1 : -1;

    if (active === 'rail') {
      // Moving projects re-homes the feature cursor to the first row so the
      // list + detail never point at a stale index.
      store.setSelectedProjectIndex(
        clamp(store.selectedProjectIndex + delta, 0, store.filteredProjects.length - 1),
      );
      store.setSelectedFeatureIndex(0);
    } else if (active === 'list') {
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
