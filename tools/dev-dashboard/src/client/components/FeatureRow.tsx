import type { Feature } from '@shared/types.js';
import { getStatusConfig } from '../utils/statusConfig.js';

interface Props {
  feature: Feature;
  id?: string;
  expanded?: boolean;
  onClick?: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function FeatureRow({ feature, id, expanded, onClick }: Props) {
  const config = getStatusConfig(feature.status);

  return (
    <div
      id={id}
      class={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-slate-800/30 ${expanded ? 'bg-slate-800/20' : ''} ${feature.status === 'archived' ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      {/* Name + branch */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-100 truncate">{feature.name}</span>
          {feature.branch && (
            <span class="text-[13px] text-slate-500 font-mono truncate max-w-[180px]">
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
      <div class="w-32 flex-shrink-0">
        {feature.progress ? (
          <div>
            <div class="flex justify-between text-[13px] font-mono text-slate-500 mb-1">
              <span>
                {feature.progress.done}/{feature.progress.total}
              </span>
              <span>{feature.progress.percent}%</span>
            </div>
            <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                class={`h-full rounded-full ${config.bar} transition-all duration-500`}
                style={{ width: `${feature.progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <span class="text-[13px] text-slate-600 font-mono">—</span>
        )}
      </div>

      {/* Checkpoint time */}
      <div class="w-16 flex-shrink-0 text-right">
        {feature.lastCheckpoint ? (
          <span class="text-[13px] text-slate-500 font-mono">
            {formatTimeAgo(feature.lastCheckpoint)}
          </span>
        ) : (
          <span class="text-[13px] text-slate-600 font-mono">—</span>
        )}
      </div>

      {/* Status badge */}
      <span
        class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium font-mono flex-shrink-0 ${config.badge}`}
      >
        {config.label}
      </span>
    </div>
  );
}
