import { describe, expect, it } from 'vitest';
import {
  DETAIL_PANE_WIDTH,
  LIST_WIDTH,
  RAIL_NARROW_WIDTH,
  RAIL_WIDTH,
  resolveLayout,
  type Layout,
} from '../src/layout.js';

/** Assert the fields of a resolved layout, leaving the rest unconstrained. */
function expectLayout(columns: number, expected: Partial<Layout>): void {
  expect(resolveLayout(columns)).toMatchObject(expected);
}

describe('width constants', () => {
  it('pins the exported widths', () => {
    expect(DETAIL_PANE_WIDTH).toBe(60);
    expect(RAIL_WIDTH).toBe(28);
    expect(RAIL_NARROW_WIDTH).toBe(16);
    expect(LIST_WIDTH).toBe(46);
  });
});

describe('resolveLayout breakpoints', () => {
  it('>= 134: full rail, list absorbs the surplus', () => {
    expectLayout(200, { showRail: true, railWidth: RAIL_WIDTH, listWidth: 112 });
    expectLayout(134, { showRail: true, railWidth: RAIL_WIDTH, listWidth: LIST_WIDTH });
  });

  it('116…133: rail narrows to 16 before it is hidden', () => {
    expectLayout(133, { showRail: true, railWidth: RAIL_NARROW_WIDTH, listWidth: 57 });
    expectLayout(116, { showRail: true, railWidth: RAIL_NARROW_WIDTH, listWidth: 40 });
  });

  it('94…115: rail hidden, list still full-width rows', () => {
    expectLayout(115, { showRail: false, listWidth: 55, showList: true, listCompact: false });
    expectLayout(100, { showRail: false, listWidth: 40, showList: true, listCompact: false });
  });

  it('76…93: list compacts below 34 columns', () => {
    expectLayout(94, { listWidth: 34, showList: true, listCompact: false });
    expectLayout(93, { listWidth: 33, showList: true, listCompact: true });
  });

  it('76 is the last width that keeps the list', () => {
    expectLayout(76, { showList: true, listWidth: 16, showFeatureStrip: false });
  });

  it('75 and below: the feature strip replaces the list', () => {
    expectLayout(75, { showList: false, showFeatureStrip: true, listWidth: 15 });
    expectLayout(40, { showList: false, showFeatureStrip: true });
  });

  it('detail is 60 down to 60 columns, then takes the viewport', () => {
    expectLayout(200, { detailWidth: DETAIL_PANE_WIDTH });
    expectLayout(60, { detailWidth: DETAIL_PANE_WIDTH });
    expectLayout(40, { detailWidth: 40 });
  });

  it('compact bars below 85 columns', () => {
    expectLayout(84, { compactBars: true });
    expectLayout(85, { compactBars: false });
  });
});

describe('resolveLayout invariants', () => {
  const WIDTHS = [200, 160, 134, 133, 116, 115, 100, 94, 76, 60, 40];

  it('never narrows the detail above 60 columns — the list shrinks first', () => {
    for (const columns of [200, 134, 133, 100, 76, 60]) {
      expect(resolveLayout(columns).detailWidth).toBe(DETAIL_PANE_WIDTH);
    }
  });

  it('never lays out panes wider than the terminal', () => {
    for (const columns of WIDTHS) {
      const layout = resolveLayout(columns);
      const total =
        (layout.showRail ? layout.railWidth : 0) +
        (layout.showList ? layout.listWidth : 0) +
        layout.detailWidth;
      expect(total).toBeLessThanOrEqual(columns);
    }
  });
});
