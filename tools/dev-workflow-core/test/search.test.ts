import { describe, it, expect } from 'vitest';
import { searchFeatures } from '../src/search.js';
import type { Project, Feature } from '../src/types.js';

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    name: 'test-feature',
    status: 'active',
    progress: { done: 2, total: 5, percent: 40 },
    currentPhase: { number: 1, total: 3, title: 'Setup' },
    lastCheckpoint: '2025-01-01T00:00:00Z',
    created: '2025-01-01',
    lastUpdated: '2025-01-02',
    nextAction: null,
    branch: null,
    summary: null,
    ...overrides,
  };
}

function makeProjects(...args: { name: string; features: Partial<Feature>[] }[]): Project[] {
  return args.map((p) => ({
    name: p.name,
    path: `/fake/${p.name}`,
    features: p.features.map((f) => makeFeature(f)),
  }));
}

describe('searchFeatures', () => {
  const projects = makeProjects(
    {
      name: 'api-server',
      features: [
        {
          name: 'auth-oauth',
          summary: 'OAuth2 authentication with Google and GitHub providers',
          branch: 'feature/auth-oauth',
          currentPhase: { number: 2, total: 3, title: 'Token Management' },
          nextAction: 'Implement refresh token rotation',
        },
        {
          name: 'rate-limiting',
          summary: 'Add rate limiting middleware for API endpoints',
          branch: 'feature/rate-limiting',
          currentPhase: { number: 1, total: 2, title: 'Core Limiter' },
        },
      ],
    },
    {
      name: 'dashboard',
      features: [
        {
          name: 'search-panel',
          summary: 'Full-text search across all projects',
          branch: 'feature/dashboard-search',
          currentPhase: { number: 1, total: 5, title: 'Core Search Function' },
          nextAction: 'Add search types to core',
        },
        {
          name: 'dark-theme',
          summary: 'Dark theme support for the dashboard UI',
          currentPhase: { number: 1, total: 1, title: 'Theme Implementation' },
        },
      ],
    },
  );

  it('returns empty array for empty query', () => {
    expect(searchFeatures(projects, { query: '' })).toEqual([]);
    expect(searchFeatures(projects, { query: '   ' })).toEqual([]);
  });

  it('matches a single term in feature name', () => {
    const hits = searchFeatures(projects, { query: 'auth' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('auth-oauth');
    expect(hits[0].project).toBe('api-server');
  });

  it('matches across multiple fields', () => {
    const hits = searchFeatures(projects, { query: 'search' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('search-panel');
    expect(hits[0].matches.length).toBeGreaterThanOrEqual(2);
    const fields = hits[0].matches.map((m) => m.field);
    expect(fields).toContain('name');
    expect(fields).toContain('summary');
  });

  it('uses AND semantics for multi-word queries', () => {
    const hits = searchFeatures(projects, { query: 'oauth token' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('auth-oauth');
  });

  it('returns no results when AND fails', () => {
    const hits = searchFeatures(projects, { query: 'oauth dark' });
    expect(hits).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const hits = searchFeatures(projects, { query: 'OAUTH' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('auth-oauth');
  });

  it('matches in branch field', () => {
    const hits = searchFeatures(projects, { query: 'dashboard-search' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('search-panel');
  });

  it('matches in currentPhase title', () => {
    const hits = searchFeatures(projects, { query: 'limiter' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('rate-limiting');
  });

  it('matches in nextAction field', () => {
    const hits = searchFeatures(projects, { query: 'refresh rotation' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('auth-oauth');
  });

  it('ranks results with more field matches higher', () => {
    const hits = searchFeatures(projects, { query: 'search' });
    expect(hits).toHaveLength(1);
    expect(hits[0].matches.length).toBeGreaterThan(1);
  });

  it('respects maxResults', () => {
    const manyProjects = makeProjects({
      name: 'mono',
      features: Array.from({ length: 10 }, (_, i) => ({
        name: `feature-${i}`,
        summary: 'common keyword here',
      })),
    });
    const hits = searchFeatures(manyProjects, { query: 'common', maxResults: 3 });
    expect(hits).toHaveLength(3);
  });

  it('returns results from multiple projects', () => {
    const hits = searchFeatures(projects, { query: 'feature' });
    const projectNames = new Set(hits.map((h) => h.project));
    expect(projectNames.size).toBeGreaterThanOrEqual(2);
  });

  it('generates snippets with context window', () => {
    const long = makeProjects({
      name: 'proj',
      features: [
        {
          name: 'x',
          summary:
            'This is a very long summary that contains the word migration somewhere in the middle of a lot of other text that surrounds it on both sides',
        },
      ],
    });
    const hits = searchFeatures(long, { query: 'migration' });
    expect(hits).toHaveLength(1);
    const snippet = hits[0].matches.find((m) => m.field === 'summary')!.snippet;
    expect(snippet).toContain('migration');
    expect(snippet.length).toBeLessThan(200);
  });

  it('handles features with all null optional fields', () => {
    const sparse = makeProjects({
      name: 'sparse',
      features: [{ name: 'minimal-feature' }],
    });
    const hits = searchFeatures(sparse, { query: 'minimal' });
    expect(hits).toHaveLength(1);
    expect(hits[0].feature.name).toBe('minimal-feature');
  });
});
