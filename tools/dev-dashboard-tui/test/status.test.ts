import { describe, expect, it } from 'vitest';
import type { FeatureStatus } from 'dev-workflow-core/types';
import { getStatusTheme } from '../src/theme/status.js';

// Mirrors the 8 keys of core's FeatureStatus union; a compile-time exhaustive
// list would drift silently, so we assert every known status resolves to a
// non-empty label + color and that unknown input falls back to 'no-prd'.
const ALL_STATUSES: FeatureStatus[] = [
  'gate',
  'active',
  'stale',
  'complete',
  'checkpoint-only',
  'no-prd',
  'empty',
  'archived',
];

describe('getStatusTheme', () => {
  it('returns a non-empty label and color for every FeatureStatus', () => {
    for (const status of ALL_STATUSES) {
      const theme = getStatusTheme(status);
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.color.length).toBeGreaterThan(0);
    }
  });

  it('maps known statuses to their expected labels', () => {
    expect(getStatusTheme('gate').label).toBe('Gate');
    expect(getStatusTheme('active').label).toBe('Active');
    expect(getStatusTheme('complete').label).toBe('Complete');
    expect(getStatusTheme('archived').label).toBe('Archived');
    expect(getStatusTheme('checkpoint-only').label).toBe('Checkpoint');
    expect(getStatusTheme('no-prd').label).toBe('No PRD');
  });

  it('falls back to the no-prd theme for an unknown status', () => {
    expect(getStatusTheme('totally-unknown')).toEqual(getStatusTheme('no-prd'));
  });
});
