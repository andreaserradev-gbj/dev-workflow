import { describe, expect, it } from 'vitest';
import type { ReportFeature } from '../src/shared/types.js';
import { computeReportStats, isCompletedFeature } from '../src/client/utils/reportStats.js';

describe('isCompletedFeature', () => {
  it('treats fully completed archived features as completed', () => {
    expect(
      isCompletedFeature({
        status: 'archived',
        progress: { done: 5, total: 5, percent: 100 },
      }),
    ).toBe(true);
  });

  it('does not treat partial progress as completed', () => {
    expect(
      isCompletedFeature({
        status: 'active',
        progress: { done: 3, total: 5, percent: 60 },
      }),
    ).toBe(false);
  });
});

describe('computeReportStats', () => {
  it('counts completed features from progress, not only status', () => {
    const features: ReportFeature[] = [
      {
        project: 'api-server',
        name: 'done-and-archived',
        status: 'archived',
        progress: { done: 4, total: 4, percent: 100 },
        currentPhase: null,
        lastCheckpoint: '2026-03-20T10:00:00Z',
        created: '2026-03-18',
        lastUpdated: '2026-03-20',
        nextAction: null,
        branch: null,
        summary: null,
      },
      {
        project: 'api-server',
        name: 'in-progress',
        status: 'active',
        progress: { done: 2, total: 4, percent: 50 },
        currentPhase: { number: 1, total: 2, title: 'Core' },
        lastCheckpoint: '2026-03-19T10:00:00Z',
        created: '2026-03-17',
        lastUpdated: '2026-03-19',
        nextAction: null,
        branch: null,
        summary: null,
      },
    ];

    expect(computeReportStats(features, '2026-03-01', '2026-03-31')).toEqual({
      total: 2,
      completed: 1,
      created: 2,
      avgProgress: 75,
    });
  });
});
