import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { FeatureStatus, Project, ReportFeature } from '@shared/types.js';
import { useReportData } from '../hooks/useReportData.js';
import { useClipboard } from '../hooks/useClipboard.js';

interface Props {
  projects: Project[];
}

const STATUS_CONFIG: Record<FeatureStatus, { label: string; badge: string; bar: string }> = {
  gate: {
    label: 'Gate',
    badge: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20',
    bar: 'bg-amber-500',
  },
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
    badge: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20',
    bar: 'bg-red-500',
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
  archived: {
    label: 'Archived',
    badge: 'bg-slate-600/10 text-slate-500 ring-1 ring-inset ring-slate-600/20',
    bar: 'bg-slate-700',
  },
};

const REPORT_DATE_RANGE_KEY = 'dev-dashboard-report-date-range';

type PresetKey = '7d' | '30d' | 'month' | 'quarter';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last quarter' },
];

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computePresetRange(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  const to = fmt(today);
  let from: Date;
  switch (key) {
    case '7d':
      from = new Date(today);
      from.setDate(from.getDate() - 6);
      break;
    case '30d':
      from = new Date(today);
      from.setDate(from.getDate() - 29);
      break;
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'quarter':
      from = new Date(today);
      from.setMonth(from.getMonth() - 3);
      from.setDate(from.getDate() + 1);
      break;
  }
  return { from: fmt(from), to };
}

function readSavedRange(): { from: string; to: string; project?: string } | null {
  try {
    const raw = localStorage.getItem(REPORT_DATE_RANGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSavedRange(from: string, to: string, project?: string): void {
  try {
    localStorage.setItem(REPORT_DATE_RANGE_KEY, JSON.stringify({ from, to, project }));
  } catch {
    /* */
  }
}

function formatDateDisplay(isoStr: string): string {
  const d = new Date(isoStr + 'T00:00:00');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function readHashReportProject(): string | undefined {
  try {
    const hash = window.location.hash;
    const match = hash.match(/[#&]project=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    /* */
  }
  return undefined;
}

export function ReportView({ projects }: Props) {
  const saved = readSavedRange();
  const defaultRange = computePresetRange('30d');
  const hashProject = readHashReportProject();

  const [from, setFrom] = useState(saved?.from ?? defaultRange.from);
  const [to, setTo] = useState(saved?.to ?? defaultRange.to);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(
    hashProject ?? saved?.project,
  );
  const [activePreset, setActivePreset] = useState<PresetKey | null>(() => {
    if (saved) return null;
    return '30d';
  });

  const params = useMemo(
    () => (from && to ? { from, to, project: selectedProject } : null),
    [from, to, selectedProject],
  );
  const { data, loading, error } = useReportData(params);
  const { copy, copied } = useClipboard();

  // Persist date range
  useEffect(() => {
    writeSavedRange(from, to, selectedProject);
  }, [from, to, selectedProject]);

  const handlePreset = useCallback((key: PresetKey) => {
    const range = computePresetRange(key);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(key);
  }, []);

  const handleFromChange = useCallback((value: string) => {
    setFrom(value);
    setActivePreset(null);
  }, []);

  const handleToChange = useCallback((value: string) => {
    setTo(value);
    setActivePreset(null);
  }, []);

  // Group features by project
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, ReportFeature[]>();
    for (const f of data.features) {
      const list = map.get(f.project) ?? [];
      list.push(f);
      map.set(f.project, list);
    }
    return Array.from(map.entries()).map(([project, features]) => ({ project, features }));
  }, [data]);

  // Summary stats
  const stats = useMemo(() => {
    if (!data) return { total: 0, completed: 0, created: 0, avgProgress: 0 };
    const total = data.features.length;
    const completed = data.features.filter((f) => f.status === 'complete').length;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const created = data.features.filter((f) => {
      if (!f.created) return false;
      const d = new Date(f.created);
      return !isNaN(d.getTime()) && d >= fromDate && d <= toDate;
    }).length;
    let avgProgress = 0;
    const withProgress = data.features.filter((f) => f.progress && f.progress.total > 0);
    if (withProgress.length > 0) {
      const sum = withProgress.reduce((s, f) => s + f.progress!.done / f.progress!.total, 0);
      avgProgress = Math.round((sum / withProgress.length) * 100);
    }
    return { total, completed, created, avgProgress };
  }, [data, from, to]);

  // Copy for Jira
  const handleCopy = useCallback(() => {
    if (!data) return;
    const fromDisplay = formatDateDisplay(from);
    const toDisplay = formatDateDisplay(to);
    let md = `## Activity Report: ${fromDisplay} - ${toDisplay}\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Features Worked On | ${stats.total} |\n`;
    md += `| Completed | ${stats.completed} |\n`;
    md += `| Newly Created | ${stats.created} |\n`;
    md += `| Avg Progress | ${stats.avgProgress}% |\n\n`;
    for (const group of grouped) {
      md += `### ${group.project}\n\n`;
      md += `| Feature | Status | Progress | Summary |\n`;
      md += `|---|---|---|---|\n`;
      for (const f of group.features) {
        const config = STATUS_CONFIG[f.status] ?? STATUS_CONFIG['no-prd'];
        const pct = f.progress ? `${f.progress.percent}%` : '-';
        md += `| ${f.name} | ${config.label} | ${pct} | ${f.summary ?? ''} |\n`;
      }
      md += '\n';
    }
    copy(md);
  }, [data, from, to, stats, grouped, copy]);

  let cardIndex = 0;

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold tracking-tight font-sans text-white">Activity Report</h2>
          <p class="mt-1 text-sm text-slate-500 font-mono">
            {selectedProject
              ? `Feature activity for ${selectedProject}`
              : 'Feature activity across all projects'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!data || data.features.length === 0}
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-medium
                 bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30
                 hover:bg-sky-500/25 hover:text-sky-300 transition-colors
                 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="w-3.5 h-3.5"
          >
            <path
              fill-rule="evenodd"
              d="M15.988 3.012A2.25 2.25 0 0 1 18 5.25v6.5A2.25 2.25 0 0 1 15.75 14H13.5v-3.379a3 3 0 0 0-.879-2.121l-3.12-3.121a3 3 0 0 0-1.402-.791 2.252 2.252 0 0 1 2.151-1.588h2.5a2.25 2.25 0 0 1 2.238 2.012ZM11.5 3.374a.75.75 0 0 0-.53-.22H7.25A2.25 2.25 0 0 0 5 5.25v9.5A2.25 2.25 0 0 0 7.25 17h5.5A2.25 2.25 0 0 0 15 14.75V8.379a.75.75 0 0 0-.22-.53l-3.28-3.275Z"
              clip-rule="evenodd"
            />
          </svg>
          {copied ? 'Copied!' : 'Copy for Jira'}
        </button>
      </div>

      {/* Date range picker */}
      <div class="flex items-center gap-2.5 flex-wrap">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-mono text-slate-500">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => handleFromChange((e.target as HTMLInputElement).value)}
            class="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800/40 text-slate-200
                   border border-slate-700/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30
                   focus:border-sky-500/30 [color-scheme:dark]"
          />
        </div>
        <span class="text-xs text-slate-600">&ndash;</span>
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-mono text-slate-500">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => handleToChange((e.target as HTMLInputElement).value)}
            class="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800/40 text-slate-200
                   border border-slate-700/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30
                   focus:border-sky-500/30 [color-scheme:dark]"
          />
        </div>
        <div class="flex gap-1.5 ml-2 flex-wrap">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePreset(key)}
              class={`px-3 py-1.5 rounded-full text-[11px] font-mono transition-colors ${
                activePreset === key
                  ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30'
                  : 'bg-slate-800/40 text-slate-500 hover:text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Project filter */}
        <select
          value={selectedProject ?? ''}
          onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value || undefined;
            setSelectedProject(val);
          }}
          class="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800/40 text-slate-300
                 border border-slate-700/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30
                 focus:border-sky-500/30 [color-scheme:dark]"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading / error */}
      {loading && (
        <div class="text-center py-8 text-slate-500 text-sm font-mono">Loading report...</div>
      )}
      {error && (
        <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 font-mono">
          {error}
        </div>
      )}

      {/* Stats bar */}
      {data && !loading && (
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Features Worked On" value={stats.total} color="text-sky-400" delay={0} />
          <StatCard label="Completed" value={stats.completed} color="text-emerald-400" delay={60} />
          <StatCard
            label="Newly Created"
            value={stats.created}
            color="text-violet-400"
            delay={120}
          />
          <StatCard
            label="Avg Progress"
            value={`${stats.avgProgress}%`}
            color="text-amber-400"
            delay={180}
          />
        </div>
      )}

      {/* Feature groups */}
      {data && !loading && grouped.length > 0 && (
        <div class="space-y-6">
          {grouped.map((group) => (
            <div key={group.project}>
              <div class="flex items-center gap-2 mb-2.5 pl-1">
                <span class="text-sm font-semibold font-sans text-slate-200">{group.project}</span>
                <span class="text-xs text-slate-500 font-mono">
                  {group.features.length} feature{group.features.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div class="space-y-2">
                {group.features.map((feature) => {
                  const i = cardIndex++;
                  return (
                    <div
                      key={feature.name}
                      class="card-enter"
                      style={{ animationDelay: `${240 + i * 60}ms` }}
                    >
                      <ReportFeatureCard feature={feature} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {data && !loading && data.features.length === 0 && (
        <div class="rounded-lg bg-slate-800/50 border border-slate-700/50 p-8 text-center text-slate-500">
          <p class="text-sm font-mono">No features found in this date range</p>
        </div>
      )}

      {/* Footer */}
      {data && !loading && data.features.length > 0 && (
        <div class="pt-5 border-t border-slate-800/40 text-center text-xs font-mono text-slate-600">
          Showing {data.features.length} feature{data.features.length !== 1 ? 's' : ''} across{' '}
          {grouped.length} project{grouped.length !== 1 ? 's' : ''} &mdash;{' '}
          {formatDateDisplay(from)} to {formatDateDisplay(to)}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  delay,
}: {
  label: string;
  value: number | string;
  color: string;
  delay: number;
}) {
  return (
    <div
      class="bg-[#0d1425] border border-slate-800/60 rounded-xl p-4 shadow-md card-enter"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div class="text-[11px] font-mono text-slate-500 uppercase tracking-wider">{label}</div>
      <div class={`text-2xl font-bold font-sans mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function ReportFeatureCard({ feature }: { feature: ReportFeature }) {
  const config = STATUS_CONFIG[feature.status] ?? STATUS_CONFIG['no-prd'];
  const pct = feature.progress?.percent ?? 0;

  return (
    <div class="bg-[#0d1425] border border-slate-800/60 rounded-xl px-5 py-4 shadow-md hover:bg-[#0f1830] transition-colors">
      {/* Top row: badge + name + progress */}
      <div class="flex items-center gap-2.5 mb-2">
        <span
          class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium font-mono flex-shrink-0 ${config.badge}`}
        >
          {config.label}
        </span>
        <span class="text-sm font-semibold font-sans text-slate-100 truncate">{feature.name}</span>
        <div class="flex-1" />
        {feature.progress && feature.progress.total > 0 && (
          <div class="flex items-center gap-2 min-w-[120px]">
            <div class="flex-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
              <div
                class={`h-full rounded-full ${config.bar} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span class="text-xs font-mono text-slate-400 min-w-[32px] text-right">{pct}%</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {feature.summary && (
        <p class="text-xs text-slate-400 leading-relaxed mb-2.5">{feature.summary}</p>
      )}

      {/* Date meta */}
      <div class="flex items-center gap-4 flex-wrap">
        {feature.created && (
          <span class="text-[11px] font-mono text-slate-500">
            <span class="text-slate-600">Created</span> {feature.created}
          </span>
        )}
        {feature.lastCheckpoint && (
          <span class="text-[11px] font-mono text-slate-500">
            <span class="text-slate-600">Checkpoint</span> {feature.lastCheckpoint.slice(0, 10)}
          </span>
        )}
        {feature.lastUpdated && (
          <span class="text-[11px] font-mono text-slate-500">
            <span class="text-slate-600">Updated</span> {feature.lastUpdated}
          </span>
        )}
      </div>
    </div>
  );
}
