import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { buildFeatureDetail } from '../src/feature-detail.js';
import { parseFeature } from '../src/parser.js';

const FIXTURES = resolve(__dirname, 'fixtures');

describe('buildFeatureDetail', () => {
  it('assembles checkpoint, phases, and sub-PRDs on top of the scanned Feature', async () => {
    const dir = resolve(FIXTURES, 'full-feature');
    const feature = await parseFeature(dir, 'full-feature');

    const detail = await buildFeatureDetail(dir, feature, 'my-project');

    // Carries the base Feature fields through unchanged…
    expect(detail.name).toBe('full-feature');
    expect(detail.branch).toBe('feature/auth-system');
    // …annotated with the owning project.
    expect(detail.project).toBe('my-project');

    // Checkpoint fields lifted from checkpoint.md.
    expect(detail.checkpoint).not.toBeNull();
    expect(detail.checkpoint?.nextAction).toContain('refresh token rotation');

    // Master-plan phases + the NN-sub-prd-*.md files.
    expect(detail.phases.length).toBeGreaterThan(0);
    expect(detail.subPrds.map((s) => s.title)).toContain('Token Management');
  });

  it('populates sessionLog when session-log.md is present', async () => {
    const dir = resolve(FIXTURES, 'full-with-sessions');
    const feature = await parseFeature(dir, 'full-with-sessions');

    const detail = await buildFeatureDetail(dir, feature, 'proj');

    expect(detail.sessionLog).not.toBeNull();
    expect(detail.sessionLog).toHaveLength(3);
  });

  it('degrades gracefully for a feature with no PRD files', async () => {
    const dir = resolve(FIXTURES, 'empty-dev');
    const feature = await parseFeature(dir, 'empty-dev');

    const detail = await buildFeatureDetail(dir, feature, 'proj');

    // No master plan → no phases; no sub-PRDs; missing/empty session log → null.
    expect(detail.phases).toEqual([]);
    expect(detail.subPrds).toEqual([]);
    expect(detail.sessionLog).toBeNull();
    expect(detail.project).toBe('proj');
  });

  it('marks sub-PRD counts non-authoritative in the redundant-hybrid shape', async () => {
    // Master plan owns the phases (2 phases, 2 sub-PRDs → not authoritative) and
    // carries its own inline-step progress, while the sub-PRDs redundantly keep
    // their own (never-updated) step tables. The counters are dead — hide them
    // and defer to each sub-PRD's `**Status**` header.
    const dir = resolve(FIXTURES, 'master-hybrid-redundant');
    const feature = await parseFeature(dir, 'master-hybrid-redundant');
    const detail = await buildFeatureDetail(dir, feature, 'proj');

    // Phase list stays the master plan's (its phases carry the real progress).
    expect(detail.phases.map((p) => p.number)).toEqual([0, 1]);

    const foundation = detail.subPrds.find((s) => s.id === '01-sub-prd-foundation');
    const core = detail.subPrds.find((s) => s.id === '02-sub-prd-core');

    // Both sub-PRDs have step tables, so both are flagged non-authoritative…
    expect(foundation?.countsAuthoritative).toBe(false);
    expect(core?.countsAuthoritative).toBe(false);
    // …the raw counts are retained (renderers just hide them)…
    expect(foundation?.total).toBe(3);
    // …and status now comes from the `**Status**` header, not the all-⬜ table.
    expect(foundation?.status).toBe('complete');
    expect(core?.status).toBe('not-started');
  });

  it('leaves sub-PRD counts authoritative in the ranged shape', async () => {
    // Sub-PRDs outnumber the parsed master phases → they ARE the progress source,
    // so their counts must stay live (no countsAuthoritative flag).
    const dir = resolve(FIXTURES, 'master-range-subprds');
    const feature = await parseFeature(dir, 'master-range-subprds');
    const detail = await buildFeatureDetail(dir, feature, 'proj');

    expect(detail.subPrds.length).toBeGreaterThan(0);
    expect(detail.subPrds.every((s) => s.countsAuthoritative === undefined)).toBe(true);
  });
});
