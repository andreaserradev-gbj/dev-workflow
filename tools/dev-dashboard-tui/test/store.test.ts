import { describe, expect, it } from 'vitest';
import type { Feature, FeatureStatus, Project } from 'dev-workflow-core/types';
import { filterProjects, FILTER_KEYS } from '../src/hooks/useStore.js';

function feature(name: string, status: FeatureStatus): Feature {
  return {
    name,
    status,
    progress: null,
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

const projects: Project[] = [
  project('alpha', [feature('a1', 'active'), feature('a2', 'gate'), feature('a3', 'archived')]),
  project('beta', [feature('b1', 'complete'), feature('b2', 'archived')]),
  project('gamma', [feature('g1', 'stale')]),
];

describe('filterProjects', () => {
  it("'all' keeps every non-archived feature and drops projects left empty", () => {
    const result = filterProjects(projects, 'all');
    expect(result.map((p) => p.name)).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.flatMap((p) => p.features.map((f) => f.name))).toEqual(['a1', 'a2', 'b1', 'g1']);
    // No archived feature survives the 'all' view.
    expect(result.flatMap((p) => p.features).some((f) => f.status === 'archived')).toBe(false);
  });

  it("'archived' keeps only archived features, dropping projects with none", () => {
    const result = filterProjects(projects, 'archived');
    expect(result.map((p) => p.name)).toEqual(['alpha', 'beta']);
    expect(result.flatMap((p) => p.features.map((f) => f.name))).toEqual(['a3', 'b2']);
  });

  it('a status pill matches that status exactly and drops empty projects', () => {
    const result = filterProjects(projects, 'gate');
    expect(result.map((p) => p.name)).toEqual(['alpha']);
    expect(result[0].features.map((f) => f.name)).toEqual(['a2']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterProjects(projects, 'complete').map((p) => p.name)).toEqual(['beta']);
    expect(filterProjects([], 'all')).toEqual([]);
  });

  it('does not mutate the input projects', () => {
    const before = projects.map((p) => p.features.length);
    filterProjects(projects, 'gate');
    expect(projects.map((p) => p.features.length)).toEqual(before);
  });

  it('exposes the curated pill set', () => {
    expect(FILTER_KEYS).toEqual(['all', 'active', 'gate', 'stale', 'complete', 'archived']);
  });
});
