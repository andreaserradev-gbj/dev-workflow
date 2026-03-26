import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { FeatureStatus } from '@shared/types.js';
import { ProjectCard } from './components/ProjectCard.js';
import { ProjectRail } from './components/ProjectRail.js';
import { SessionBar } from './components/SessionBar.js';
import { ConnectionOverlay } from './components/ConnectionOverlay.js';
import { useWebSocket } from './hooks/useWebSocket.js';

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

export function App() {
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(readSelectedProject);
  const [railCollapsed, setRailCollapsed] = useState(readRailCollapsed);
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

  const { projects, connected, loading } = useWebSocket();

  // Clear selected project if it no longer exists
  useEffect(() => {
    if (selectedProject && !projects.find((p) => p.name === selectedProject)) {
      setSelectedProject(null);
      writeSelectedProject(null);
    }
  }, [projects, selectedProject]);

  const handleSelectProject = useCallback((name: string | null) => {
    setSelectedProject(name);
    writeSelectedProject(name);
  }, []);

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
        />
      )}

      {/* Right Panel */}
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-7xl mx-auto px-6 lg:px-10 py-10">
          <header class="mb-10">
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-bold tracking-tight text-white font-sans">Dev Dashboard</h1>
              <span
                class={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
                title={connected ? 'Connected' : 'Reconnecting...'}
              />
            </div>
            <p class="mt-1 text-sm text-slate-500 font-mono">
              {loading
                ? 'Connecting...'
                : `${filteredProjects.length} projects · ${filteredProjects.reduce((s, p) => s + p.features.filter((f) => f.status !== 'archived').length, 0)} features`}
            </p>
          </header>

          {!loading && projects.length === 0 && (
            <div class="rounded-lg bg-slate-800/50 border border-slate-700/50 p-8 text-center text-slate-500">
              <p class="text-lg font-medium">No projects found</p>
              <p class="mt-1 text-sm">
                Check your scan directories in ~/.config/dev-dashboard/config.json
              </p>
            </div>
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
          )}

          <div class="space-y-6">
            {activeProjects.map((project, i) => (
              <div class="card-enter" style={{ animationDelay: `${i * 80}ms` }}>
                <ProjectCard
                  project={project}
                  singleProject={!!selectedProject}
                  archivedFilter={statusFilter === 'archived'}
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
        </div>
      </div>
    </div>
  );
}
