import type { Feature, FeatureStatus } from '@shared/types.js';

interface Props {
  feature: Feature;
}

const STATUS_CONFIG: Record<FeatureStatus, { label: string; badge: string; bar: string }> = {
  active: {
    label: 'Active',
    badge: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
    bar: 'bg-sky-500',
  },
  complete: {
    label: 'Complete',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
    bar: 'bg-emerald-500',
  },
  stale: {
    label: 'Stale',
    badge: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20',
    bar: 'bg-amber-500',
  },
  'checkpoint-only': {
    label: 'Checkpoint',
    badge: 'bg-violet-500/10 text-violet-400 ring-1 ring-inset ring-violet-500/20',
    bar: 'bg-violet-500',
  },
  'no-prd': {
    label: 'No PRD',
    badge: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
    bar: 'bg-slate-600',
  },
  empty: {
    label: 'Empty',
    badge: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
    bar: 'bg-slate-700',
  },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function FeatureRow({ feature }: Props) {
  const config = STATUS_CONFIG[feature.status] ?? STATUS_CONFIG['no-prd'];

  return (
    <div class="px-5 py-3.5 flex items-center gap-4">
      {/* Name + branch */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-100 truncate">
            {feature.name}
          </span>
          {feature.branch && (
            <span class="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">
              {feature.branch}
            </span>
          )}
        </div>

        {/* Phase info or next action */}
        {feature.currentPhase && (
          <p class="mt-0.5 text-xs text-slate-500">
            Phase {feature.currentPhase.number}/{feature.currentPhase.total}
            {' — '}
            {feature.currentPhase.title}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div class="w-28 flex-shrink-0">
        {feature.progress ? (
          <div>
            <div class="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
              <span>{feature.progress.done}/{feature.progress.total}</span>
              <span>{feature.progress.percent}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                class={`h-full rounded-full ${config.bar} transition-all duration-500`}
                style={{ width: `${feature.progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <span class="text-[11px] text-slate-600 font-mono">—</span>
        )}
      </div>

      {/* Checkpoint time */}
      <div class="w-16 flex-shrink-0 text-right">
        {feature.lastCheckpoint ? (
          <span class="text-[11px] text-slate-500 font-mono">
            {formatTimeAgo(feature.lastCheckpoint)}
          </span>
        ) : (
          <span class="text-[11px] text-slate-600 font-mono">—</span>
        )}
      </div>

      {/* Status badge */}
      <span
        class={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium font-mono flex-shrink-0 ${config.badge}`}
      >
        {config.label}
      </span>
    </div>
  );
}
