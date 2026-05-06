import { describe, it, expect } from 'vitest';
import { getAfkRunnableInfo } from '../src/afk-runnable.js';
import type { Feature, FeatureStatus } from '../src/types.js';

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    name: 'test',
    status: 'active',
    progress: { done: 1, total: 4, percent: 25 },
    currentPhase: { number: 2, total: 4, title: 'Phase Two' },
    lastCheckpoint: '2026-05-04T10:00:00Z',
    created: '2026-04-01',
    lastUpdated: '2026-05-04',
    nextAction: null,
    branch: 'feature/test',
    summary: null,
    ...overrides,
  };
}

describe('getAfkRunnableInfo', () => {
  describe('runnable cases', () => {
    it('active feature with pending phase → runnable', () => {
      const info = getAfkRunnableInfo(makeFeature({ status: 'active' }));
      expect(info.state).toBe('runnable');
      expect(info.runnable).toBe(true);
      expect(info.reason).toBe('ready: next phase 2');
    });

    it('gate feature with pending phase → runnable', () => {
      const info = getAfkRunnableInfo(makeFeature({ status: 'gate' }));
      expect(info.state).toBe('runnable');
      expect(info.runnable).toBe(true);
      expect(info.reason).toBe('ready: next phase 2');
    });

    it('stale feature with pending phase → runnable', () => {
      const info = getAfkRunnableInfo(makeFeature({ status: 'stale' }));
      expect(info.state).toBe('runnable');
      expect(info.runnable).toBe(true);
      expect(info.reason).toBe('ready: next phase 2');
    });
  });

  describe('not-runnable feature states', () => {
    const cases: { status: FeatureStatus; reason: string }[] = [
      { status: 'complete', reason: 'complete' },
      { status: 'archived', reason: 'archived' },
      { status: 'no-prd', reason: 'missing master plan' },
      { status: 'empty', reason: 'empty feature directory' },
      { status: 'checkpoint-only', reason: 'checkpoint only' },
    ];

    for (const { status, reason } of cases) {
      it(`${status} → not-runnable (${reason})`, () => {
        const info = getAfkRunnableInfo(makeFeature({ status }));
        expect(info.state).toBe('not-runnable');
        expect(info.runnable).toBe(false);
        expect(info.reason).toBe(reason);
      });
    }

    it('active feature with no currentPhase → not-runnable', () => {
      const info = getAfkRunnableInfo(makeFeature({ currentPhase: null }));
      expect(info.state).toBe('not-runnable');
      expect(info.reason).toBe('no pending phase');
    });
  });
});
