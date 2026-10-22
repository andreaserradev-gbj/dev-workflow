/**
 * Horizontal layout resolver — the single source of truth for pane widths.
 *
 * The shell resolves the layout once per render from `stdout.columns` and hands
 * explicit widths down to each pane, so no pane leans on Yoga's implicit shrink
 * behaviour (which collapsed the elastic detail column to 0 columns on narrow
 * terminals, re-wrapping its prose one character per line).
 *
 * Breakpoints (border-box widths, i.e. including each pane's border + padding):
 *
 * | `columns`  | rail               | list                          | detail   |
 * |------------|--------------------|-------------------------------|----------|
 * | `>= 134`   | 28                 | `columns - 88` (46 at 134)    | 60       |
 * | `116…133`  | 16 (narrow strip)  | `columns - 76` (40…57)        | 60       |
 * | `94…115`   | hidden             | `columns - 60` (34…55)        | 60       |
 * | `76…93`    | hidden             | `columns - 60` (16…33), compact rows | 60 |
 * | `60…75`    | hidden             | hidden → feature strip        | 60       |
 * | `< 60`     | hidden             | hidden → feature strip        | `columns`|
 *
 * Priority: the detail column keeps its 60 columns and the list (then the rail)
 * gives way first. Below 60 columns no layout can hold a 60-column pane, so the
 * detail takes the viewport width rather than letting the terminal cut its
 * border.
 *
 * Pure and dependency-free so the breakpoints are unit-testable — the
 * `ink-testing-library` harness hard-codes 100 columns.
 */

/** Detail pane's outer width (border-box: 2 border + 2 padding + 56 content). */
export const DETAIL_PANE_WIDTH = 60;

/** Project rail's full width, at or above `FULL_LAYOUT_COLUMNS`. */
export const RAIL_WIDTH = 28;

/** Project rail's degraded width between `RAIL_NARROW_COLUMNS` and `FULL_LAYOUT_COLUMNS`. */
export const RAIL_NARROW_WIDTH = 16;

/** Feature list's width at `FULL_LAYOUT_COLUMNS`; it absorbs the surplus above that. */
export const LIST_WIDTH = 46;

/** Below this the list's fixed chrome leaves no room for the name — drop the list. */
const LIST_MIN_WIDTH = 16;

/** Below this the list's row chrome (bar + counts) crowds out the name — compact rows. */
const LIST_COMPACT_WIDTH = 34;

/** At or above this the rail is shown (at `RAIL_NARROW_WIDTH`). */
const RAIL_NARROW_COLUMNS = 116;

/** At or above this every pane gets its full width. */
const FULL_LAYOUT_COLUMNS = 134;

export interface Layout {
  /** Whether the project rail is rendered at all. */
  showRail: boolean;
  /** Outer rail width when shown (`RAIL_WIDTH` or `RAIL_NARROW_WIDTH`). */
  railWidth: number;
  /** Whether the feature list is rendered (else the feature strip replaces it). */
  showList: boolean;
  /** Outer list width when shown; 0 when hidden. */
  listWidth: number;
  /** Render the list's rows without the progress bar and counts. */
  listCompact: boolean;
  /** The one-line feature strip replaces the list below `LIST_MIN_WIDTH`+detail. */
  showFeatureStrip: boolean;
  /** Outer detail width: `DETAIL_PANE_WIDTH`, or the viewport width below it. */
  detailWidth: number;
  /** The help bar drops to its short variant instead of being clipped. */
  compactBars: boolean;
}

/** Turn a terminal width into the pane layout for that width. */
export function resolveLayout(columns: number): Layout {
  const showRail = columns >= RAIL_NARROW_COLUMNS;
  const railWidth = columns >= FULL_LAYOUT_COLUMNS ? RAIL_WIDTH : RAIL_NARROW_WIDTH;
  const detailWidth = columns >= DETAIL_PANE_WIDTH ? DETAIL_PANE_WIDTH : columns;
  const listWidth = Math.max(0, columns - (showRail ? railWidth : 0) - DETAIL_PANE_WIDTH);
  const showList = listWidth >= LIST_MIN_WIDTH;
  const listCompact = showList && listWidth < LIST_COMPACT_WIDTH;

  return {
    showRail,
    railWidth,
    showList,
    listWidth,
    listCompact,
    showFeatureStrip: !showList,
    detailWidth,
    compactBars: columns < 85,
  };
}
