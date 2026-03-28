import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { FeatureStatus, Project, ReportFeature } from '@shared/types.js';
import { useReportData } from '../hooks/useReportData.js';
import { useClipboard } from '../hooks/useClipboard.js';
import { computeReportStats, getWorkedDays, sortReportProjects } from '../utils/reportStats.js';

interface Props {
  projects: Project[];
  onGoToFeature: (project: string, feature: string) => void;
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
const REPORT_VIEW_MODE_KEY = 'dev-dashboard-report-view-mode';

type PresetKey = '7d' | '30d' | 'month' | 'quarter';
type ReportViewMode = 'detailed' | 'compact';

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

function readSavedRange(): {
  from: string;
  to: string;
  project?: string;
  preset?: PresetKey | null;
} | null {
  try {
    const raw = localStorage.getItem(REPORT_DATE_RANGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSavedRange(
  from: string,
  to: string,
  project?: string,
  preset?: PresetKey | null,
): void {
  try {
    localStorage.setItem(REPORT_DATE_RANGE_KEY, JSON.stringify({ from, to, project, preset }));
  } catch {
    /* */
  }
}

function readSavedViewMode(): ReportViewMode {
  try {
    return localStorage.getItem(REPORT_VIEW_MODE_KEY) === 'compact' ? 'compact' : 'detailed';
  } catch {
    return 'detailed';
  }
}

function writeSavedViewMode(mode: ReportViewMode): void {
  try {
    localStorage.setItem(REPORT_VIEW_MODE_KEY, mode);
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

export function ReportView({ projects, onGoToFeature }: Props) {
  const saved = readSavedRange();
  const defaultRange = computePresetRange('30d');
  const hashProject = readHashReportProject();

  const [from, setFrom] = useState(saved?.from ?? defaultRange.from);
  const [to, setTo] = useState(saved?.to ?? defaultRange.to);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(
    hashProject ?? saved?.project,
  );
  const [activePreset, setActivePreset] = useState<PresetKey | null>(saved?.preset ?? '30d');
  const [viewMode, setViewMode] = useState<ReportViewMode>(readSavedViewMode);

  const params = useMemo(
    () => (from && to ? { from, to, project: selectedProject } : null),
    [from, to, selectedProject],
  );
  const { data, loading, error } = useReportData(params);
  const { copy, copied } = useClipboard();

  // Persist date range
  useEffect(() => {
    writeSavedRange(from, to, selectedProject, activePreset);
  }, [from, to, selectedProject, activePreset]);

  useEffect(() => {
    writeSavedViewMode(viewMode);
  }, [viewMode]);

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
    return sortReportProjects(
      Array.from(map.entries()).map(([project, features]) => ({ project, features })),
      from,
      to,
    );
  }, [data, from, to]);

  // Summary stats
  const stats = useMemo(() => {
    if (!data) return { total: 0, completed: 0, created: 0, avgProgress: 0 };
    return computeReportStats(data.features, from, to);
  }, [data, from, to]);

  // Copy as Markdown
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
          {copied ? 'Copied!' : 'Copy as Markdown'}
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
        <div class="ml-auto flex items-center gap-2">
          <div class="inline-flex items-center rounded-lg bg-slate-900/70 ring-1 ring-inset ring-slate-700/50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              title="Detailed view"
              aria-label="Detailed view"
              class={`p-1.5 rounded-md transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                class="w-4 h-4"
              >
                <path d="M2.5 3.25A1.25 1.25 0 0 1 3.75 2h8.5A1.25 1.25 0 0 1 13.5 3.25v1.5A1.25 1.25 0 0 1 12.25 6h-8.5A1.25 1.25 0 0 1 2.5 4.75v-1.5Zm0 4A1.25 1.25 0 0 1 3.75 6h8.5A1.25 1.25 0 0 1 13.5 7.25v1.5A1.25 1.25 0 0 1 12.25 10h-8.5A1.25 1.25 0 0 1 2.5 8.75v-1.5Zm1.25 2.75A1.25 1.25 0 0 0 2.5 11.25v1.5A1.25 1.25 0 0 0 3.75 14h8.5a1.25 1.25 0 0 0 1.25-1.25v-1.5A1.25 1.25 0 0 0 12.25 10h-8.5Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              title="Compact view"
              aria-label="Compact view"
              class={`p-1.5 rounded-md transition-colors ${
                viewMode === 'compact'
                  ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                class="w-4 h-4"
              >
                <path d="M2.5 4.25A1.75 1.75 0 0 1 4.25 2.5h7.5a1.75 1.75 0 1 1 0 3.5h-7.5A1.75 1.75 0 0 1 2.5 4.25Zm0 7.5A1.75 1.75 0 0 1 4.25 10h7.5a1.75 1.75 0 1 1 0 3.5h-7.5A1.75 1.75 0 0 1 2.5 11.75Z" />
              </svg>
            </button>
          </div>
          <select
            value={selectedProject ?? ''}
            onChange={(e) => {
              const val = (e.target as HTMLSelectElement).value || undefined;
              setSelectedProject(val);
            }}
            class="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800/40 text-slate-300
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
                      <ReportFeatureCard
                        feature={feature}
                        viewMode={viewMode}
                        onGoToFeature={onGoToFeature}
                      />
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

function ReportFeatureCard({
  feature,
  viewMode,
  onGoToFeature,
}: {
  feature: ReportFeature;
  viewMode: ReportViewMode;
  onGoToFeature: (project: string, feature: string) => void;
}) {
  const config = STATUS_CONFIG[feature.status] ?? STATUS_CONFIG['no-prd'];
  const pct = feature.progress?.percent ?? 0;
  const workedDays = getWorkedDays(feature);
  const isCompact = viewMode === 'compact';

  return (
    <div class="group relative bg-[#0d1425] border border-slate-800/60 rounded-xl px-5 py-4 shadow-md hover:bg-[#0f1830] transition-colors">
      <button
        type="button"
        onClick={() => onGoToFeature(feature.project, feature.name)}
        class="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
               text-[11px] font-mono text-sky-400 bg-sky-500/10 ring-1 ring-inset ring-sky-500/25
               opacity-0 pointer-events-none transition-all duration-150
               group-hover:opacity-100 group-hover:pointer-events-auto
               hover:bg-sky-500/20 hover:text-sky-300"
      >
        Go to feature
      </button>

      {/* Top row: badge + name + progress */}
      <div class="flex items-center gap-2.5 mb-2 pr-28">
        <span
          class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium font-mono flex-shrink-0 ${config.badge}`}
        >
          {config.label}
        </span>
        <span class="text-sm font-semibold font-sans text-slate-100 truncate">{feature.name}</span>
        <div class="flex-1" />
        {feature.progress && feature.progress.total > 0 && (
          <div class="flex items-center gap-3 min-w-[120px]">
            {workedDays && (
              <span class="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                {workedDays} day{workedDays !== 1 ? 's' : ''}
              </span>
            )}
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
      {!isCompact && feature.summary && (
        <p class="text-xs text-slate-400 leading-relaxed mb-2.5">{feature.summary}</p>
      )}

      {/* Date meta */}
      {!isCompact && (
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
      )}
    </div>
  );
}
