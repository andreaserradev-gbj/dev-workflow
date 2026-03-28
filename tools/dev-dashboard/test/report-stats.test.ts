import { describe, expect, it } from 'vitest';
import type { ReportFeature } from '../src/shared/types.js';
import {
  computeReportStats,
  getWorkedDays,
  isCompletedFeature,
  sortReportProjects,
} from '../src/client/utils/reportStats.js';

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

describe('getWorkedDays', () => {
  it('returns an inclusive day span for features with progress', () => {
    expect(
      getWorkedDays({
        progress: { done: 2, total: 4, percent: 50 },
        created: '2026-03-10',
        lastCheckpoint: '2026-03-12T09:00:00Z',
        lastUpdated: '2026-03-14',
      }),
    ).toBe(5);
  });

  it('returns null when there is no measurable progress', () => {
    expect(
      getWorkedDays({
        progress: { done: 0, total: 4, percent: 0 },
        created: '2026-03-10',
        lastCheckpoint: '2026-03-12T09:00:00Z',
        lastUpdated: '2026-03-14',
      }),
    ).toBeNull();
  });

  it('falls back to the earliest available activity date when created is missing', () => {
    expect(
      getWorkedDays({
        progress: { done: 2, total: 4, percent: 50 },
        created: null,
        lastCheckpoint: '2026-03-14T09:00:00Z',
        lastUpdated: '2026-03-12',
      }),
    ).toBe(3);
  });
});

describe('sortReportProjects', () => {
  it('orders active or stale projects first, then other non-archived, then archived-only', () => {
    const groups = [
      {
        project: 'archived-only',
        features: [
          {
            project: 'archived-only',
            name: 'done',
            status: 'archived',
            progress: { done: 4, total: 4, percent: 100 },
            currentPhase: null,
            lastCheckpoint: '2026-03-05T10:00:00Z',
            created: '2026-03-01',
            lastUpdated: '2026-03-05',
            nextAction: null,
            branch: null,
            summary: null,
          },
        ],
      },
      {
        project: 'complete-project',
        features: [
          {
            project: 'complete-project',
            name: 'done',
            status: 'complete',
            progress: { done: 3, total: 3, percent: 100 },
            currentPhase: null,
            lastCheckpoint: '2026-03-10T10:00:00Z',
            created: '2026-03-02',
            lastUpdated: '2026-03-10',
            nextAction: null,
            branch: null,
            summary: null,
          },
        ],
      },
      {
        project: 'active-project',
        features: [
          {
            project: 'active-project',
            name: 'in-progress',
            status: 'active',
            progress: { done: 1, total: 3, percent: 33 },
            currentPhase: null,
            lastCheckpoint: '2026-03-12T10:00:00Z',
            created: '2026-03-03',
            lastUpdated: '2026-03-12',
            nextAction: null,
            branch: null,
            summary: null,
          },
        ],
      },
    ];

    expect(sortReportProjects(groups, '2026-03-01', '2026-03-31').map((group) => group.project)).toEqual([
      'active-project',
      'complete-project',
      'archived-only',
    ]);
  });

  it('orders projects inside the same bucket by latest activity in range', () => {
    const groups = [
      {
        project: 'older-active',
        features: [
          {
            project: 'older-active',
            name: 'feature',
            status: 'active',
            progress: { done: 1, total: 2, percent: 50 },
            currentPhase: null,
            lastCheckpoint: '2026-03-07T10:00:00Z',
            created: '2026-03-01',
            lastUpdated: '2026-03-07',
            nextAction: null,
            branch: null,
            summary: null,
          },
        ],
      },
      {
        project: 'newer-stale',
        features: [
          {
            project: 'newer-stale',
            name: 'feature',
            status: 'stale',
            progress: { done: 1, total: 2, percent: 50 },
            currentPhase: null,
            lastCheckpoint: '2026-03-14T10:00:00Z',
            created: '2026-03-02',
            lastUpdated: '2026-03-14',
            nextAction: null,
            branch: null,
            summary: null,
          },
        ],
      },
    ];

    expect(sortReportProjects(groups, '2026-03-01', '2026-03-31').map((group) => group.project)).toEqual([
      'newer-stale',
      'older-active',
    ]);
  });
});
