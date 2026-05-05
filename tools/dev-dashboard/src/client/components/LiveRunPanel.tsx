import type { RunStatus, RunStatusValue, Verdict } from '@shared/types.js';

interface Props {
  runStatus: RunStatus | null;
}

const STATUS_BADGE: Record<RunStatusValue, { label: string; cls: string }> = {
  planning: {
    label: 'Planning',
    cls: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
  },
  implementing: {
    label: 'Implementing',
    cls: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
  },
  judging: {
    label: 'Judging',
    cls: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
  },
  done: {
    label: 'Done',
    cls: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
  },
  escalated: {
    label: 'Escalated',
    cls: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20',
  },
  timeout: {
    label: 'Timeout',
    cls: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20',
  },
  idle: {
    label: 'Idle',
    cls: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
  },
};

const VERDICT_ICON: Record<Verdict, string> = {
  pass: '✅',
  revise: '🔄',
  escalate: '⚠️',
};

function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return iso;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function LiveRunPanel({ runStatus }: Props) {
  if (!runStatus) return null;

  const badge = STATUS_BADGE[runStatus.status];
  const isTerminal =
    runStatus.status === 'done' ||
    runStatus.status === 'escalated' ||
    runStatus.status === 'timeout';

  return (
    <div class="rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3 space-y-2">
      <div class="flex items-center gap-3 flex-wrap">
        <p class="text-[13px] font-semibold text-slate-300 uppercase tracking-wider">AFK Run</p>
        <span class={`inline-flex px-1.5 py-0.5 rounded text-[12px] font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        {runStatus.currentPhase !== null && (
          <span class="text-xs text-slate-400 font-mono">
            Phase {runStatus.currentPhase}
            {runStatus.attempt > 0 && (
              <span class="text-slate-500"> &middot; attempt {runStatus.attempt}</span>
            )}
          </span>
        )}
        <span class="text-xs text-slate-500 font-mono ml-auto">
          started {relativeTime(runStatus.startedAt)}
        </span>
      </div>

      {runStatus.lastVerdict && (
        <div class="flex items-center gap-2 text-xs">
          <span class="text-slate-500 uppercase tracking-wider">Last verdict</span>
          <span class="text-slate-300 font-mono">
            {VERDICT_ICON[runStatus.lastVerdict]} {runStatus.lastVerdict}
          </span>
        </div>
      )}

      {isTerminal && runStatus.exitReason && (
        <p class="text-xs text-slate-400">
          <span class="text-slate-500 uppercase tracking-wider mr-2">Reason</span>
          {runStatus.exitReason}
        </p>
      )}

      {runStatus.lastFeedback && (
        <details class="text-xs">
          <summary class="cursor-pointer text-slate-400 hover:text-slate-300 select-none">
            Last feedback
          </summary>
          <pre class="mt-2 whitespace-pre-wrap text-slate-300 bg-slate-950/40 rounded px-3 py-2 font-mono text-[11px] leading-relaxed">
            {runStatus.lastFeedback}
          </pre>
        </details>
      )}
    </div>
  );
}
