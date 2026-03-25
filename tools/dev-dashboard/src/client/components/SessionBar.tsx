import { useState } from 'preact/hooks';
import type { FeatureStatus, Project } from '@shared/types.js';

interface Props {
  projects: Project[];
  statusFilter: FeatureStatus | 'all';
  onSelectProject?: (name: string | null) => void;
}

interface MatchedFeature {
  projectName: string;
  featureName: string;
  status: FeatureStatus;
}

const STATUS_STYLES: Record<
  FeatureStatus,
  { bg: string; text: string; ring: string; dot: string }
> = {
  active: { bg: 'bg-sky-500/10', text: 'text-sky-400', ring: 'ring-sky-500/20', dot: 'bg-sky-400' },
  gate: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-400',
  },
  stale: { bg: 'bg-red-500/10', text: 'text-red-400', ring: 'ring-red-500/20', dot: 'bg-red-400' },
  complete: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  'checkpoint-only': {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    ring: 'ring-violet-500/20',
    dot: 'bg-violet-400',
  },
  'no-prd': {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    ring: 'ring-slate-600/20',
    dot: 'bg-slate-500',
  },
  empty: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-600',
    ring: 'ring-slate-700/20',
    dot: 'bg-slate-600',
  },
};

const STATUS_LABELS: Partial<Record<FeatureStatus | 'all', string>> = {
  active: 'active',
  gate: 'at gate',
  stale: 'stale',
  complete: 'complete',
  'checkpoint-only': 'checkpoint-only',
  'no-prd': 'no PRD',
  empty: 'empty',
};

const STORAGE_KEY = 'dev-dashboard-session-bar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean): void {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}

export function SessionBar({ projects, statusFilter, onSelectProject }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const matched: MatchedFeature[] = [];
  const multiProject = projects.length > 1;

  for (const project of projects) {
    for (const feature of project.features) {
      if (statusFilter === 'all' || feature.status === statusFilter) {
        matched.push({
          projectName: project.name,
          featureName: feature.name,
          status: feature.status,
        });
      }
    }
  }

  const statusLabel =
    statusFilter === 'all' ? 'features' : (STATUS_LABELS[statusFilter] ?? statusFilter);

  if (matched.length === 0) {
    return (
      <div class="mb-6 px-4 py-2.5 rounded-lg bg-slate-800/30 border border-slate-800/40">
        <span class="text-xs text-slate-600 font-mono">No {statusLabel}</span>
      </div>
    );
  }

  const label =
    statusFilter === 'all' ? `${matched.length} features` : `${matched.length} ${statusLabel}`;

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }

  return (
    <div class="mb-6 px-4 py-2.5 rounded-lg bg-slate-800/30 border border-slate-800/40 flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={toggle}
        class="text-xs text-slate-500 font-mono flex-shrink-0 hover:text-slate-400 transition-colors flex items-center gap-1.5"
      >
        <span class="text-[10px] w-3 select-none">{collapsed ? '\u25b6' : '\u25bc'}</span>
        {label}
      </button>
      {!collapsed && (
        <div class="flex items-center gap-2 flex-wrap">
          {matched.map((mf) => {
            const style = STATUS_STYLES[mf.status];
            return (
              <button
                key={`${mf.projectName}-${mf.featureName}`}
                onClick={() => onSelectProject?.(mf.projectName)}
                class={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono
                       ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}
                       hover:brightness-125 transition-colors cursor-pointer`}
              >
                <span class={`w-1.5 h-1.5 rounded-full ${style.dot} flex-shrink-0`} />
                {multiProject ? `${mf.projectName}/${mf.featureName}` : mf.featureName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
