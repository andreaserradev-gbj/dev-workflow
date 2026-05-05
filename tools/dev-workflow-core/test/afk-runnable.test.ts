import { describe, it, expect } from 'vitest';
import { getAfkRunnableInfo } from '../src/afk-runnable.js';
import type { Feature, FeatureStatus, RunStatus, RunStatusValue } from '../src/types.js';

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
    runStatus: null,
    ...overrides,
  };
}

function makeRunStatus(status: RunStatusValue, overrides: Partial<RunStatus> = {}): RunStatus {
  return {
    runId: 'run-1',
    status,
    currentPhase: '2',
    attempt: 1,
    startedAt: '2026-05-04T09:00:00Z',
    updatedAt: '2026-05-04T09:30:00Z',
    lastVerdict: null,
    lastFeedback: null,
    exitReason: null,
    phaseHistory: [],
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

    it('idle run state with pending phase → runnable', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ runStatus: makeRunStatus('idle') }),
      );
      expect(info.state).toBe('runnable');
      expect(info.runnable).toBe(true);
      expect(info.reason).toBe('ready: next phase 2');
    });

    it('done run state with pending phases → runnable, qualifies last run done', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ runStatus: makeRunStatus('done') }),
      );
      expect(info.state).toBe('runnable');
      expect(info.runnable).toBe(true);
      expect(info.reason).toBe('ready: next phase 2; last run done');
    });
  });

  describe('running cases', () => {
    it('planning → running, not runnable', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ runStatus: makeRunStatus('planning') }),
      );
      expect(info.state).toBe('running');
      expect(info.runnable).toBe(false);
      expect(info.reason).toBe('already running: planning');
    });

    it('implementing → running, not runnable', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ runStatus: makeRunStatus('implementing') }),
      );
      expect(info.state).toBe('running');
      expect(info.runnable).toBe(false);
      expect(info.reason).toBe('already running: implementing');
    });

    it('judging → running, not runnable', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ runStatus: makeRunStatus('judging') }),
      );
      expect(info.state).toBe('running');
      expect(info.runnable).toBe(false);
      expect(info.reason).toBe('already running: judging');
    });
  });

  describe('needs-attention cases', () => {
    it('escalated with exitReason → needs-attention with reason text', () => {
      const info = getAfkRunnableInfo(
        makeFeature({
          runStatus: makeRunStatus('escalated', {
            exitReason: 'retry cap (2) exceeded',
          }),
        }),
      );
      expect(info.state).toBe('needs-attention');
      expect(info.runnable).toBe(false);
      expect(info.reason).toBe('needs attention: retry cap (2) exceeded');
    });

    it('timeout with exitReason → needs-attention', () => {
      const info = getAfkRunnableInfo(
        makeFeature({
          runStatus: makeRunStatus('timeout', {
            exitReason: 'phase 2 attempt 1 timed out after 1800000ms',
          }),
        }),
      );
      expect(info.state).toBe('needs-attention');
      expect(info.runnable).toBe(false);
      expect(info.reason).toBe(
        'needs attention: phase 2 attempt 1 timed out after 1800000ms',
      );
    });

    it('escalated without exitReason → needs-attention with bare reason', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ runStatus: makeRunStatus('escalated') }),
      );
      expect(info.state).toBe('needs-attention');
      expect(info.runnable).toBe(false);
      expect(info.reason).toBe('needs attention');
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
  });

  describe('precedence', () => {
    it('archived beats active runStatus', () => {
      const info = getAfkRunnableInfo(
        makeFeature({
          status: 'archived',
          runStatus: makeRunStatus('implementing'),
        }),
      );
      expect(info.state).toBe('not-runnable');
      expect(info.reason).toBe('archived');
    });

    it('running beats no currentPhase', () => {
      const info = getAfkRunnableInfo(
        makeFeature({
          currentPhase: null,
          runStatus: makeRunStatus('implementing'),
        }),
      );
      expect(info.state).toBe('running');
    });

    it('active feature with no currentPhase and no runStatus → not-runnable', () => {
      const info = getAfkRunnableInfo(
        makeFeature({ currentPhase: null, runStatus: null }),
      );
      expect(info.state).toBe('not-runnable');
      expect(info.reason).toBe('no pending phase');
    });
  });
});
