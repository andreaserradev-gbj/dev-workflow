import type { Feature } from './types.js';

// AFK-runnable classification — pure helper that consumes the parsed Feature
// shape produced by `parseFeature` / `scanProjects`. Does not read the
// filesystem so dashboard, CLI, and tests can share it.

export type AfkRunnableState = 'runnable' | 'not-runnable';

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

  if (!feature.currentPhase) {
    return { state: 'not-runnable', runnable: false, reason: 'no pending phase' };
  }

  return {
    state: 'runnable',
    runnable: true,
    reason: `ready: next phase ${feature.currentPhase.number}`,
  };
}
