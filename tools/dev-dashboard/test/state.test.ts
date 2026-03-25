import { describe, it, expect } from 'vitest';
import { sortProjects } from '../src/server/state.js';
import type { Feature, Project } from '../src/shared/types.js';

function feat(name: string, overrides: Partial<Feature> = {}): Feature {
  return {
    name,
    status: 'active',
    progress: null,
    currentPhase: null,
    lastCheckpoint: null,
    nextAction: null,
    branch: null,
    summary: null,
    ...overrides,
  };
}

function proj(name: string, features: Feature[]): Project {
  return { name, path: `/code/${name}`, features };
}

describe('sortProjects', () => {
  it('sorts features within a project by status priority', () => {
    const projects = [
      proj('app', [
        feat('f-complete', { status: 'complete' }),
        feat('f-active', { status: 'active' }),
        feat('f-gate', { status: 'gate' }),
        feat('f-stale', { status: 'stale' }),
      ]),
    ];

    const sorted = sortProjects(projects);
    const names = sorted[0].features.map((f) => f.name);

    expect(names).toEqual(['f-gate', 'f-active', 'f-stale', 'f-complete']);
  });

  it('sorts all status values in correct order', () => {
    const projects = [
      proj('app', [
        feat('f-complete', { status: 'complete' }),
        feat('f-empty', { status: 'empty' }),
        feat('f-no-prd', { status: 'no-prd' }),
        feat('f-stale', { status: 'stale' }),
        feat('f-checkpoint', { status: 'checkpoint-only' }),
        feat('f-active', { status: 'active' }),
        feat('f-gate', { status: 'gate' }),
        feat('f-archived', { status: 'archived' }),
      ]),
    ];

    const sorted = sortProjects(projects);
    const statuses = sorted[0].features.map((f) => f.status);

    expect(statuses).toEqual([
      'gate',
      'active',
      'checkpoint-only',
      'stale',
      'no-prd',
      'empty',
      'complete',
      'archived',
    ]);
  });

  it('sorts projects by most recently active (latest lastCheckpoint)', () => {
    const projects = [
      proj('old-project', [
        feat('f1', { lastCheckpoint: '2026-03-01T00:00:00Z' }),
      ]),
      proj('new-project', [
        feat('f1', { lastCheckpoint: '2026-03-20T00:00:00Z' }),
      ]),
      proj('mid-project', [
        feat('f1', { lastCheckpoint: '2026-03-10T00:00:00Z' }),
      ]),
    ];

    const sorted = sortProjects(projects);
    expect(sorted.map((p) => p.name)).toEqual(['new-project', 'mid-project', 'old-project']);
  });

  it('uses latest checkpoint across all features in a project', () => {
    const projects = [
      proj('proj-a', [
        feat('f1', { lastCheckpoint: '2026-03-01T00:00:00Z' }),
        feat('f2', { lastCheckpoint: '2026-03-20T00:00:00Z' }),
      ]),
      proj('proj-b', [
        feat('f1', { lastCheckpoint: '2026-03-15T00:00:00Z' }),
      ]),
    ];

    const sorted = sortProjects(projects);
    expect(sorted.map((p) => p.name)).toEqual(['proj-a', 'proj-b']);
  });

  it('puts projects with no checkpoint dates last', () => {
    const projects = [
      proj('no-dates', [feat('f1')]),
      proj('has-date', [feat('f1', { lastCheckpoint: '2026-03-10T00:00:00Z' })]),
    ];

    const sorted = sortProjects(projects);
    expect(sorted.map((p) => p.name)).toEqual(['has-date', 'no-dates']);
  });

  it('does not mutate input', () => {
    const original = [
      proj('app', [
        feat('f-complete', { status: 'complete' }),
        feat('f-gate', { status: 'gate' }),
      ]),
    ];
    const originalOrder = original[0].features.map((f) => f.name);

    sortProjects(original);

    expect(original[0].features.map((f) => f.name)).toEqual(originalOrder);
  });

  it('handles empty projects array', () => {
    expect(sortProjects([])).toEqual([]);
  });

  it('handles project with single feature', () => {
    const projects = [proj('solo', [feat('f1', { status: 'active' })])];
    const sorted = sortProjects(projects);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].features).toHaveLength(1);
  });
});
