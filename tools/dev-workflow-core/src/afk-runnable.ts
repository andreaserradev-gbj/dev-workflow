import type { Feature } from './types.js';

// AFK-runnable classification — pure helper that consumes the parsed Feature
// shape produced by `parseFeature` / `scanProjects`. Does not read the
// filesystem so dashboard, CLI, and tests can share it.
//
// See `.dev/afk-orchestrator/07-sub-prd-cli-afk-list.md` for the full spec.

export type AfkRunnableState = 'runnable' | 'running' | 'needs-attention' | 'not-runnable';

export interface AfkRunnableInfo {
  state: AfkRunnableState;
  runnable: boolean;
  reason: string;
}

export function getAfkRunnableInfo(feature: Feature): AfkRunnableInfo {
  switch (feature.status) {
    case 'archived':
      return { state: 'not-runnable', runnable: false, reason: 'archived' };
    case 'complete':
      return { state: 'not-runnable', runnable: false, reason: 'complete' };
    case 'no-prd':
      return { state: 'not-runnable', runnable: false, reason: 'missing master plan' };
    case 'empty':
      return { state: 'not-runnable', runnable: false, reason: 'empty feature directory' };
    case 'checkpoint-only':
      return { state: 'not-runnable', runnable: false, reason: 'checkpoint only' };
  }

  const runStatus = feature.runStatus;
  if (runStatus) {
    if (
      runStatus.status === 'planning' ||
      runStatus.status === 'implementing' ||
      runStatus.status === 'judging'
    ) {
      return {
        state: 'running',
        runnable: false,
        reason: `already running: ${runStatus.status}`,
      };
    }
    if (runStatus.status === 'escalated' || runStatus.status === 'timeout') {
      const tail = runStatus.exitReason ? `: ${runStatus.exitReason}` : '';
      return {
        state: 'needs-attention',
        runnable: false,
        reason: `needs attention${tail}`,
      };
    }
  }

  if (!feature.currentPhase) {
    return { state: 'not-runnable', runnable: false, reason: 'no pending phase' };
  }

  const phaseNum = feature.currentPhase.number;
  const lastRunDone = runStatus?.status === 'done' ? '; last run done' : '';
  return {
    state: 'runnable',
    runnable: true,
    reason: `ready: next phase ${phaseNum}${lastRunDone}`,
  };
}
