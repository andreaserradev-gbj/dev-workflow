import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type {
  Feature,
  FeatureDetail,
  FeatureStatus,
  Progress,
  Project,
} from 'dev-workflow-core/types';
import { ProgressBar } from '../src/components/ProgressBar.js';
import { FilterPills } from '../src/components/FilterPills.js';
import { ProjectRail } from '../src/components/ProjectRail.js';
import { FeatureList } from '../src/components/FeatureList.js';
import { DetailPane } from '../src/components/DetailPane.js';
import type { FilterKey } from '../src/hooks/useStore.js';

function feature(name: string, status: FeatureStatus, progress: Progress | null = null): Feature {
  return {
    name,
    status,
    progress,
    currentPhase: null,
    lastCheckpoint: null,
    created: null,
    lastUpdated: null,
    nextAction: null,
    branch: null,
    summary: null,
    tags: [],
  };
}

function project(name: string, features: Feature[]): Project {
  return { name, path: `/repos/${name}`, features };
}

describe('ProgressBar', () => {
  it('renders filled and empty cells proportional to percent', () => {
    const { lastFrame } = render(<ProgressBar percent={50} color="green" width={10} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('█████'); // 50% of 10 → 5 filled
    expect(frame).toContain('░░░░░'); // 5 empty
  });

  it('clamps out-of-range percents', () => {
    expect(render(<ProgressBar percent={150} color="green" width={4} />).lastFrame()).toContain(
      '████',
    );
    expect(render(<ProgressBar percent={-20} color="green" width={4} />).lastFrame()).toContain(
      '░░░░',
    );
  });
});

describe('FilterPills', () => {
  it('renders every pill with its hotkey number and count', () => {
    const counts: Record<FilterKey, number> = {
      all: 4,
      active: 1,
      gate: 1,
      stale: 1,
      complete: 1,
      archived: 2,
    };
    const frame = render(<FilterPills filter="gate" counts={counts} />).lastFrame() ?? '';
    expect(frame).toContain('1:All 4');
    expect(frame).toContain('3:Gate 1');
    expect(frame).toContain('6:Archived 2');
  });
});

describe('ProjectRail', () => {
  it('lists project names with feature counts and marks the selection', () => {
    const projects = [
      project('alpha', [feature('a1', 'active'), feature('a2', 'gate')]),
      project('beta', [feature('b1', 'complete')]),
    ];
    const frame = render(<ProjectRail projects={projects} selectedIndex={0} />).lastFrame() ?? '';
    expect(frame).toContain('Projects');
    expect(frame).toContain('alpha');
    expect(frame).toContain('beta');
    expect(frame).toContain('›'); // selection marker on the highlighted row
  });

  it('renders an empty-state when there are no projects', () => {
    expect(render(<ProjectRail projects={[]} selectedIndex={0} />).lastFrame()).toContain('None.');
  });
});

describe('FeatureList', () => {
  it('renders the title, feature names, status labels, and progress', () => {
    const features = [
      feature('a1', 'gate', { done: 8, total: 23, percent: 35 }),
      feature('a2', 'active', null),
    ];
    const frame =
      render(<FeatureList title="alpha" features={features} selectedIndex={0} />).lastFrame() ?? '';
    expect(frame).toContain('alpha');
    expect(frame).toContain('a1');
    expect(frame).toContain('Gate');
    expect(frame).toContain('Active');
    expect(frame).toContain('8/23');
    // The selection marker keeps a gap before the status label (regression:
    // a bare trailing-space marker gets trimmed under Yoga width pressure).
    expect(frame).toMatch(/›\s+Gate/);
  });
});

function detail(overrides: Partial<FeatureDetail> = {}): FeatureDetail {
  return {
    ...feature('demo', 'gate', { done: 8, total: 23, percent: 35 }),
    currentPhase: { number: 2, total: 2, title: 'Detail pane' },
    branch: 'feature/demo',
    project: 'my-project',
    checkpoint: {
      nextAction: '## Next Steps\n\nWire the detail pane into the app.',
      decisions: ['Ink over blessed'],
      blockers: ['Manual TTY verification pending'],
      notes: [],
    },
    phases: [
      { number: 1, title: 'Core hoist', done: 4, total: 4, status: 'complete' },
      { number: 2, title: 'Detail pane', done: 2, total: 4, status: 'in-progress' },
    ],
    subPrds: [{ id: '02', title: 'TUI package', done: 5, total: 7, status: 'in-progress', steps: [] }],
    sessionLog: [
      { session: 1, date: '2026-07-04', context: '## Context\n\nPlanning only.', decisions: [], blockers: [], notes: [] },
      { session: 2, date: '2026-07-05', context: '## Context\n\nBuilt portfolio.', decisions: [], blockers: [], notes: [] },
    ],
    ...overrides,
  };
}

describe('DetailPane', () => {
  it('renders the header, status line, next action, decisions, and blockers', () => {
    const frame =
      render(<DetailPane detail={detail()} loading={false} error={null} />).lastFrame() ?? '';
    expect(frame).toContain('demo'); // feature name header
    expect(frame).toContain('Gate'); // status label
    expect(frame).toContain('8/23'); // progress
    expect(frame).toContain('feature/demo'); // branch
    expect(frame).toContain('Next Action');
    expect(frame).toContain('Wire the detail pane'); // nextAction body, leading ## heading stripped
    expect(frame).not.toContain('Next Steps'); // the ## heading is stripped
    expect(frame).toContain('Decisions');
    expect(frame).toContain('Ink over blessed');
    expect(frame).toContain('Blockers');
    expect(frame).toContain('Manual TTY verification pending');
  });

  it('renders phases with status icons and sub-PRDs', () => {
    const frame =
      render(<DetailPane detail={detail()} loading={false} error={null} />).lastFrame() ?? '';
    expect(frame).toContain('Phases');
    expect(frame).toContain('Core hoist');
    expect(frame).toContain('✅'); // complete phase icon
    expect(frame).toContain('🔶'); // in-progress phase icon
    expect(frame).toContain('Sub-PRDs');
    expect(frame).toContain('TUI package');
  });

  it('collapses session history to a count by default', () => {
    const frame =
      render(<DetailPane detail={detail()} loading={false} error={null} />).lastFrame() ?? '';
    expect(frame).toContain('Session History (2)');
    expect(frame).toContain('▶'); // collapsed marker
    expect(frame).not.toContain('Session 1');
  });

  it('lists newest-first session entries when expanded, flagging the latest', () => {
    const frame =
      render(
        <DetailPane detail={detail()} loading={false} error={null} sessionExpanded />,
      ).lastFrame() ?? '';
    expect(frame).toContain('Session 1');
    expect(frame).toContain('Session 2');
    expect(frame).toContain('LATEST');
    // Newest first: Session 2 precedes Session 1 in the frame.
    expect(frame.indexOf('Session 2')).toBeLessThan(frame.indexOf('Session 1'));
  });

  it('shows a scroll indicator when sessions overflow the window', () => {
    const many: FeatureDetail['sessionLog'] = Array.from({ length: 8 }, (_, i) => ({
      session: i + 1,
      date: '2026-07-05',
      context: null,
      decisions: [],
      blockers: [],
      notes: [],
    }));
    const frame =
      render(
        <DetailPane detail={detail({ sessionLog: many })} loading={false} error={null} sessionExpanded />,
      ).lastFrame() ?? '';
    // 8 sessions, window of 4 → "older" indicator present below the fold.
    expect(frame).toContain('older');
  });

  it('renders loading and empty states', () => {
    expect(
      render(<DetailPane detail={null} loading error={null} />).lastFrame(),
    ).toContain('Loading');
    expect(
      render(<DetailPane detail={null} loading={false} error={null} />).lastFrame(),
    ).toContain('Select a feature');
    expect(
      render(<DetailPane detail={null} loading={false} error="boom" />).lastFrame(),
    ).toContain('boom');
  });
});
