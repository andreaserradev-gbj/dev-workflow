import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { DashboardConfig, FeatureStatus } from '@shared/types.js';
import { ProjectCard } from './components/ProjectCard.js';
import { ProjectRail } from './components/ProjectRail.js';
import { ReportView } from './components/ReportView.js';
import { SessionBar } from './components/SessionBar.js';
import { ConnectionOverlay } from './components/ConnectionOverlay.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { BUILD_INFO } from './buildInfo.js';

const FILTER_PILLS: { key: FeatureStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'gate', label: 'Gate' },
  { key: 'stale', label: 'Stale' },
  { key: 'complete', label: 'Complete' },
  { key: 'archived', label: 'Archived' },
];

const SELECTED_PROJECT_KEY = 'dev-dashboard-selected-project';
const RAIL_COLLAPSED_KEY = 'dev-dashboard-rail-collapsed';
const ARCHIVED_PROJECTS_KEY = 'dev-dashboard-archived-projects-collapsed';
const PROJECT_VIEW_MODE_KEY = 'dev-dashboard-project-view-mode';

export type ActiveView = 'projects' | 'report';
export type ProjectViewMode = 'detailed' | 'compact';

function readSelectedProject(): string | null {
  try {
    return localStorage.getItem(SELECTED_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeSelectedProject(name: string | null): void {
  try {
    if (name) localStorage.setItem(SELECTED_PROJECT_KEY, name);
    else localStorage.removeItem(SELECTED_PROJECT_KEY);
  } catch {
    /* localStorage unavailable */
  }
}

function readRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeRailCollapsed(v: boolean): void {
  try {
    if (v) localStorage.setItem(RAIL_COLLAPSED_KEY, '1');
    else localStorage.removeItem(RAIL_COLLAPSED_KEY);
  } catch {
    /* */
  }
}

function readHashProject(): string | null {
  try {
    const hash = window.location.hash;
    if (hash.startsWith('#project=')) {
      const match = hash.match(/#project=([^&]+)/);
      if (match) return decodeURIComponent(match[1]) || null;
    }
  } catch {
    /* */
  }
  return null;
}

function readHashFeature(): string | null {
  try {
    if (!window.location.hash.startsWith('#project=')) return null;
    const match = window.location.hash.match(/[#&]feature=([^&]+)/);
    if (match) return decodeURIComponent(match[1]) || null;
  } catch {
    /* */
  }
  return null;
}

function readHashView(): ActiveView {
  try {
    if (window.location.hash.startsWith('#report')) return 'report';
  } catch {
    /* */
  }
  return 'projects';
}

function readInitialProject(): string | null {
  return readHashProject() ?? readSelectedProject();
}

function readProjectViewMode(): ProjectViewMode {
  try {
    return localStorage.getItem(PROJECT_VIEW_MODE_KEY) === 'compact' ? 'compact' : 'detailed';
  } catch {
    return 'detailed';
  }
}

function writeProjectViewMode(mode: ProjectViewMode): void {
  try {
    localStorage.setItem(PROJECT_VIEW_MODE_KEY, mode);
  } catch {
    /* */
  }
}

function splitScanDirs(value: string): string[] {
  const seen = new Set<string>();
  const dirs: string[] = [];

  for (const line of value.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    dirs.push(trimmed);
  }

  return dirs;
}

export function App() {
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(readInitialProject);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(readHashFeature);
  const [activeView, setActiveView] = useState<ActiveView>(readHashView);
  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>(readProjectViewMode);
  const [railCollapsed, setRailCollapsed] = useState(readRailCollapsed);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [scanDirsDraft, setScanDirsDraft] = useState('');
  const [savingScanDirs, setSavingScanDirs] = useState(false);
  const [saveScanDirsError, setSaveScanDirsError] = useState<string | null>(null);
  const [archivedProjectsCollapsed, setArchivedProjectsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(ARCHIVED_PROJECTS_KEY) !== '0';
    } catch {
      return true;
    }
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    writeProjectViewMode(projectViewMode);
  }, [projectViewMode]);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/config', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .catch(() => ({ error: `Failed to load config (${res.status})` }))
            .then((body) => {
              throw new Error(body.error ?? `Failed to load config (${res.status})`);
            });
        }
        return res.json();
      })
      .then((config: DashboardConfig) => {
        setDashboardConfig(config);
        setScanDirsDraft(config.scanDirs.join('\n'));
        setConfigLoading(false);
        setConfigError(null);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setConfigError(err.message);
        setConfigLoading(false);
      });

    return () => controller.abort();
  }, []);

  const { projects, connected, loading } = useWebSocket();

  // Clear selected project if it no longer exists (gate on !loading so we
  // don't evict a restored selection before WebSocket data arrives)
  useEffect(() => {
    if (!loading && selectedProject && !projects.find((p) => p.name === selectedProject)) {
      setSelectedProject(null);
      setSelectedFeature(null);
      writeSelectedProject(null);
      history.replaceState(null, '', window.location.pathname);
    }
  }, [projects, selectedProject, loading]);

  useEffect(() => {
    if (!selectedProject || !selectedFeature) return;
    const project = projects.find((p) => p.name === selectedProject);
    if (project && !project.features.find((f) => f.name === selectedFeature)) {
      setSelectedFeature(null);
      history.replaceState(null, '', `#project=${encodeURIComponent(selectedProject)}`);
    }
  }, [projects, selectedProject, selectedFeature]);

  const handleSelectProject = useCallback((name: string | null) => {
    setSelectedProject(name);
    setSelectedFeature(null);
    writeSelectedProject(name);
    setActiveView('projects');
    const url = name ? `#project=${encodeURIComponent(name)}` : window.location.pathname;
    history.pushState(null, '', url);
  }, []);

  const handleSelectFeature = useCallback((project: string, feature: string) => {
    setStatusFilter('all');
    setSearchInput('');
    setSearchQuery('');
    setSelectedProject(project);
    setSelectedFeature(feature);
    writeSelectedProject(project);
    setActiveView('projects');
    history.pushState(
      null,
      '',
      `#project=${encodeURIComponent(project)}&feature=${encodeURIComponent(feature)}`,
    );
  }, []);

  const handleSelectReport = useCallback((project?: string) => {
    setActiveView('report');
    const hash = project ? `#report&project=${encodeURIComponent(project)}` : '#report';
    history.pushState(null, '', hash);
  }, []);

  // Sync URL hash on initial load (when restored from localStorage)
  useEffect(() => {
    if (selectedProject && !window.location.hash) {
      history.replaceState(null, '', `#project=${encodeURIComponent(selectedProject)}`);
    }
  }, [selectedProject]);

  // Browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      setActiveView(readHashView());
      const name = readHashProject();
      const feature = readHashFeature();
      setSelectedProject(name);
      setSelectedFeature(feature);
      writeSelectedProject(name);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Escape key returns to all projects (or exits report view)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (activeView === 'report') {
        handleSelectProject(null);
      } else if (selectedProject) {
        handleSelectProject(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProject, activeView, handleSelectProject]);

  const handleToggleRail = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev;
      writeRailCollapsed(next);
      return next;
    });
  }, []);

  // Projects scoped to the selected project (used for status counts + session bar)
  const scopedProjects = useMemo(
    () => (selectedProject ? projects.filter((p) => p.name === selectedProject) : projects),
    [projects, selectedProject],
  );

  // Count features per status within the scoped projects
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<FeatureStatus, number>> = {};
    for (const p of scopedProjects) {
      for (const f of p.features) {
        counts[f.status] = (counts[f.status] ?? 0) + 1;
      }
    }
    return counts;
  }, [scopedProjects]);

  // "All" count excludes archived features
  const scopedTotalFeatures = scopedProjects.reduce(
    (sum, p) => sum + p.features.filter((f) => f.status !== 'archived').length,
    0,
  );

  // Filter projects by selected project, status, and search query
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return projects
      .filter((p) => !selectedProject || p.name === selectedProject)
      .map((p) => ({
        ...p,
        features: p.features.filter((f) => {
          if (statusFilter !== 'all' && f.status !== statusFilter) return false;
          if (q && !f.name.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q))
            return false;
          return true;
        }),
      }))
      .filter((p) => p.features.length > 0);
  }, [projects, statusFilter, searchQuery, selectedProject]);

  // Split into active projects and archive-only projects (only when "All" filter)
  const activeProjects = useMemo(
    () =>
      statusFilter === 'all'
        ? filteredProjects.filter((p) => p.features.some((f) => f.status !== 'archived'))
        : filteredProjects,
    [filteredProjects, statusFilter],
  );
  const archiveOnlyProjects = useMemo(
    () =>
      statusFilter === 'all'
        ? filteredProjects.filter((p) => p.features.every((f) => f.status === 'archived'))
        : [],
    [filteredProjects, statusFilter],
  );

  const handleToggleArchivedProjects = useCallback(() => {
    setArchivedProjectsCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.removeItem(ARCHIVED_PROJECTS_KEY);
        else localStorage.setItem(ARCHIVED_PROJECTS_KEY, '0');
      } catch {
        /* */
      }
      return next;
    });
  }, []);

  const handleSaveScanDirs = useCallback(
    async (e: Event) => {
      e.preventDefault();
      const scanDirs = splitScanDirs(scanDirsDraft);
      if (scanDirs.length === 0) {
        setSaveScanDirsError('Add at least one directory to scan.');
        return;
      }

      setSavingScanDirs(true);
      setSaveScanDirsError(null);
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanDirs }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Failed to save scan directories' }));
          throw new Error(body.error ?? 'Failed to save scan directories');
        }

        const config: DashboardConfig = await res.json();
        setDashboardConfig(config);
        setScanDirsDraft(config.scanDirs.join('\n'));
      } catch (err: unknown) {
        setSaveScanDirsError(
          err instanceof Error ? err.message : 'Failed to save scan directories',
        );
      } finally {
        setSavingScanDirs(false);
      }
    },
    [scanDirsDraft],
  );

  const needsScanDirOnboarding =
    !!dashboardConfig &&
    (!dashboardConfig.scanDirsConfigured || dashboardConfig.scanDirs.length === 0);

  return (
    <div class="flex h-screen overflow-hidden">
      <ConnectionOverlay connected={connected} loading={loading} />

      {/* Left Rail */}
      {!loading && projects.length > 0 && (
        <ProjectRail
          projects={projects}
          selectedProject={selectedProject}
          onSelect={handleSelectProject}
          collapsed={railCollapsed}
          onToggleCollapsed={handleToggleRail}
          activeView={activeView}
          onViewReport={handleSelectReport}
        />
      )}

      {/* Right Panel */}
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-7xl mx-auto px-6 lg:px-10 py-10">
          <header class="mb-10">
            <div class="flex items-center gap-3">
              <h1
                class={`text-3xl font-bold tracking-tight font-sans ${
                  selectedProject
                    ? 'text-white/70 hover:text-white cursor-pointer transition-colors'
                    : 'text-white'
                }`}
                onClick={selectedProject ? () => handleSelectProject(null) : undefined}
                title={selectedProject ? 'Back to all projects' : undefined}
              >
                Dev Dashboard
              </h1>
              <span
                class={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
                title={connected ? 'Connected' : 'Reconnecting...'}
              />
            </div>
            <p class="mt-1 text-sm text-slate-500 font-mono">
              {loading ? (
                'Connecting...'
              ) : activeView === 'report' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectProject(null)}
                    class="text-slate-500 hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    All Projects
                  </button>
                  <span class="mx-1.5 text-slate-700">›</span>
                  <span class="text-slate-400">Report</span>
                </>
              ) : selectedProject ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectProject(null)}
                    class="text-slate-500 hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    All Projects
                  </button>
                  <span class="mx-1.5 text-slate-700">›</span>
                  <span class="text-slate-400">{selectedProject}</span>
                </>
              ) : (
                `${filteredProjects.length} projects · ${filteredProjects.reduce((s, p) => s + p.features.filter((f) => f.status !== 'archived').length, 0)} features`
              )}
            </p>
          </header>

          {activeView === 'report' ? (
            <ReportView projects={projects} onGoToFeature={handleSelectFeature} />
          ) : (
            <>
              {!loading && projects.length === 0 && (
                <>
                  {needsScanDirOnboarding ? (
                    <div class="rounded-2xl border border-sky-500/20 bg-slate-900/80 p-8 shadow-[0_20px_80px_rgba(14,165,233,0.08)]">
                      <div class="max-w-3xl">
                        <p class="text-xs font-mono uppercase tracking-[0.28em] text-sky-400/80">
                          First-run setup
                        </p>
                        <h2 class="mt-3 text-2xl font-semibold text-white">
                          Choose the folders dev-dashboard should scan
                        </h2>
                        <p class="mt-3 text-sm leading-6 text-slate-400">
                          Add one or more parent directories that contain your projects. The
                          dashboard watches those roots for `.dev/` and `.dev-archive/` folders and
                          reuses the same saved config for both `/dev-dashboard` and
                          `dev-dashboard`.
                        </p>
                        <form class="mt-6 space-y-4" onSubmit={handleSaveScanDirs}>
                          <label class="block">
                            <span class="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-slate-500">
                              One path per line
                            </span>
                            <textarea
                              value={scanDirsDraft}
                              onInput={(e) =>
                                setScanDirsDraft((e.target as HTMLTextAreaElement).value)
                              }
                              rows={4}
                              placeholder={'~/code\n~/work'}
                              class="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
                            />
                          </label>
                          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <button
                              type="submit"
                              disabled={savingScanDirs}
                              class="inline-flex items-center rounded-lg bg-sky-500/15 px-4 py-2 font-mono text-sky-300 ring-1 ring-inset ring-sky-500/30 transition-colors hover:bg-sky-500/20 disabled:cursor-wait disabled:opacity-60"
                            >
                              {savingScanDirs ? 'Saving...' : 'Save scan directories'}
                            </button>
                            <span>
                              Saved to{' '}
                              <code class="font-mono text-slate-400">
                                ~/.config/dev-dashboard/config.json
                              </code>
                            </span>
                          </div>
                          {saveScanDirsError && (
                            <p class="text-sm text-rose-400">{saveScanDirsError}</p>
                          )}
                          {configError && <p class="text-sm text-rose-400">{configError}</p>}
                          {configLoading && (
                            <p class="text-sm text-slate-500">Loading dashboard config...</p>
                          )}
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div class="rounded-lg bg-slate-800/50 border border-slate-700/50 p-8 text-center text-slate-500">
                      <p class="text-lg font-medium">No projects found</p>
                      <p class="mt-1 text-sm">
                        Check your scan directories in ~/.config/dev-dashboard/config.json
                      </p>
                      {configError && <p class="mt-3 text-sm text-rose-400">{configError}</p>}
                      {dashboardConfig && dashboardConfig.scanDirs.length > 0 && (
                        <p class="mt-3 text-xs font-mono text-slate-600">
                          Watching {dashboardConfig.scanDirs.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {!loading && (
                <SessionBar
                  projects={scopedProjects}
                  statusFilter={statusFilter}
                  onSelectProject={handleSelectProject}
                />
              )}

              {!loading && scopedTotalFeatures > 0 && (
                <div class="mb-6 flex items-center gap-2 flex-wrap">
                  {FILTER_PILLS.map(({ key, label }) => {
                    const count = key === 'all' ? scopedTotalFeatures : (statusCounts[key] ?? 0);
                    const isActive = statusFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        class={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          isActive
                            ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30'
                            : 'bg-slate-800/40 text-slate-500 hover:text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        {label}
                        {count > 0 ? ` (${count})` : ''}
                      </button>
                    );
                  })}
                  <div class="relative ml-auto">
                    <div class="flex items-center gap-2">
                      <div class="inline-flex items-center rounded-lg bg-slate-900/70 ring-1 ring-inset ring-slate-700/50 p-1">
                        <button
                          type="button"
                          onClick={() => setProjectViewMode('detailed')}
                          title="Detailed view"
                          aria-label="Detailed view"
                          class={`p-1.5 rounded-md transition-colors ${
                            projectViewMode === 'detailed'
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
                          onClick={() => setProjectViewMode('compact')}
                          title="Compact view"
                          aria-label="Compact view"
                          class={`p-1.5 rounded-md transition-colors ${
                            projectViewMode === 'compact'
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
                      <div class="relative">
                        <input
                          type="text"
                          value={searchInput}
                          onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
                          placeholder="Search features..."
                          class="w-48 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800/40 text-slate-300
                                 placeholder:text-slate-600 border border-slate-700/50 focus:outline-none
                                 focus:ring-1 focus:ring-sky-500/30 focus:border-sky-500/30"
                        />
                        {searchInput && (
                          <button
                            type="button"
                            onClick={() => setSearchInput('')}
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              class="w-3 h-3"
                            >
                              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div class="space-y-6">
                {activeProjects.map((project, i) => (
                  <div class="card-enter" style={{ animationDelay: `${i * 80}ms` }}>
                    <ProjectCard
                      project={project}
                      singleProject={!!selectedProject}
                      archivedFilter={statusFilter === 'archived'}
                      targetFeature={selectedProject === project.name ? selectedFeature : null}
                      viewMode={projectViewMode}
                    />
                  </div>
                ))}
                {archiveOnlyProjects.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleArchivedProjects}
                      class="w-full px-4 py-2 flex items-center gap-2 text-xs text-slate-600 font-mono
                             hover:text-slate-500 transition-colors cursor-pointer"
                    >
                      <span class="text-[10px] w-3 select-none">
                        {archivedProjectsCollapsed ? '\u25b6' : '\u25bc'}
                      </span>
                      Archived Projects ({archiveOnlyProjects.length})
                    </button>
                    {!archivedProjectsCollapsed &&
                      archiveOnlyProjects.map((project, i) => (
                        <div class="card-enter" style={{ animationDelay: `${i * 80}ms` }}>
                          <ProjectCard
                            project={project}
                            singleProject={!!selectedProject}
                            archivedFilter={statusFilter === 'archived'}
                            targetFeature={
                              selectedProject === project.name ? selectedFeature : null
                            }
                            viewMode={projectViewMode}
                          />
                        </div>
                      ))}
                  </>
                )}
                {!loading &&
                  (statusFilter !== 'all' || searchQuery) &&
                  filteredProjects.length === 0 && (
                    <div class="rounded-lg bg-slate-800/50 border border-slate-700/50 p-6 text-center text-slate-500">
                      <p class="text-sm font-mono">No matching features</p>
                    </div>
                  )}
              </div>

              <div class="mt-8 pt-4 border-t border-slate-800/40 flex items-center justify-end gap-2 text-[11px] font-mono text-slate-600">
                <span class="rounded-full bg-slate-800/50 px-2 py-1 text-slate-500">
                  {BUILD_INFO.modeLabel}
                </span>
                <span>v{BUILD_INFO.version}</span>
                <span class="text-slate-700">•</span>
                <span>built {BUILD_INFO.buildDate}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
