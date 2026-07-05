import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { Feature, FeatureStatus, Progress, Project } from 'dev-workflow-core/types';
import { ProgressBar } from '../src/components/ProgressBar.js';
import { FilterPills } from '../src/components/FilterPills.js';
import { ProjectRail } from '../src/components/ProjectRail.js';
import { FeatureList } from '../src/components/FeatureList.js';
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
  });
});
