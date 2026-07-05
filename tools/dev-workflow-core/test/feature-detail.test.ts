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
});
