import { useState } from 'preact/hooks';
import type { Project } from '@shared/types.js';
import { buildStatusGradient } from '../utils/statusColors.js';

interface Props {
  projects: Project[];
  selectedProject: string | null;
  onSelect: (name: string | null) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const RAIL_ARCHIVE_KEY = 'dev-dashboard-rail-archive-collapsed';

export function ProjectRail({
  projects,
  selectedProject,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const [archiveSectionCollapsed, setArchiveSectionCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RAIL_ARCHIVE_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const totalFeatures = projects.reduce(
    (s, p) => s + p.features.filter((f) => f.status !== 'archived').length,
    0,
  );
  const totalActive = projects.reduce(
    (s, p) => s + p.features.filter((f) => f.status === 'active').length,
    0,
  );

  if (collapsed) {
    return (
      <aside class="w-14 shrink-0 border-r border-slate-800/40 bg-[#080f1e] flex flex-col items-center py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          class="text-slate-500 hover:text-slate-300 transition-colors p-1"
          title="Expand sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            class="w-4 h-4"
          >
            <path
              fill-rule="evenodd"
              d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        {/* Mini status bars for each project */}
        <div class="mt-3 flex flex-col gap-1">
          {projects.map((project) => {
            const gradient = buildStatusGradient(project.features);
            const isSelected = selectedProject === project.name;
            return (
              <button
                key={project.name}
                type="button"
                onClick={() => onSelect(isSelected ? null : project.name)}
                title={project.name}
                class={`w-3 h-6 rounded-sm transition-all hover:w-4 ${
                  isSelected ? 'ring-1 ring-white/60 ring-offset-1 ring-offset-[#080f1e]' : ''
                }`}
                style={{ background: gradient ?? '#334155' }}
              />
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside class="w-[280px] shrink-0 border-r border-slate-800/40 overflow-y-auto bg-[#080f1e]">
      {/* All Projects + collapse button */}
      <div class="flex items-center">
        <button
          type="button"
          onClick={() => onSelect(null)}
          class={`flex-1 text-left px-4 py-3 transition-colors border-l-2 border-l-transparent ${
            selectedProject === null ? 'bg-sky-500/15' : 'hover:bg-slate-800/20'
          }`}
        >
          <span
            class={`text-sm font-semibold font-sans ${selectedProject === null ? 'text-white' : 'text-slate-200'}`}
          >
            All Projects
          </span>
          <span class="block text-[13px] text-slate-500 font-mono mt-0.5">
            {totalFeatures} features · {totalActive} active
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          class="px-2 py-3 text-slate-500 hover:text-slate-300 transition-colors self-stretch"
          title="Collapse sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            class="w-4 h-4"
          >
            <path
              fill-rule="evenodd"
              d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div class="border-b border-slate-800/40" />

      {/* Project rows — active projects */}
      {projects
        .filter((p) => p.features.some((f) => f.status !== 'archived'))
        .map((project) => (
          <ProjectRailRow
            key={project.name}
            project={project}
            isSelected={selectedProject === project.name}
            onSelect={onSelect}
          />
        ))}

      {/* Archive-only projects */}
      {(() => {
        const archiveOnly = projects.filter((p) =>
          p.features.every((f) => f.status === 'archived'),
        );
        if (archiveOnly.length === 0) return null;
        return (
          <>
            <button
              type="button"
              onClick={() => {
                setArchiveSectionCollapsed((prev) => {
                  const next = !prev;
                  try {
                    if (next) localStorage.removeItem(RAIL_ARCHIVE_KEY);
                    else localStorage.setItem(RAIL_ARCHIVE_KEY, '0');
                  } catch {
                    /* */
                  }
                  return next;
                });
              }}
              class="w-full px-4 py-2 flex items-center gap-2 text-xs text-slate-600 font-mono
                     hover:text-slate-500 transition-colors cursor-pointer border-t border-slate-800/40"
            >
              <span class="text-[10px] w-3 select-none">
                {archiveSectionCollapsed ? '\u25b6' : '\u25bc'}
              </span>
              Archived ({archiveOnly.length})
            </button>
            {!archiveSectionCollapsed &&
              archiveOnly.map((project) => (
                <ProjectRailRow
                  key={project.name}
                  project={project}
                  isSelected={selectedProject === project.name}
                  onSelect={onSelect}
                />
              ))}
          </>
        );
      })()}
    </aside>
  );
}

function ProjectRailRow({
  project,
  isSelected,
  onSelect,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: (name: string | null) => void;
}) {
  const nonArchived = project.features.filter((f) => f.status !== 'archived');
  const archivedCount = project.features.length - nonArchived.length;
  const featureCount = nonArchived.length;
  const activeCount = nonArchived.filter((f) => f.status === 'active').length;

  const totalDone = nonArchived.reduce((s, f) => s + (f.progress?.done ?? 0), 0);
  const totalSteps = nonArchived.reduce((s, f) => s + (f.progress?.total ?? 0), 0);
  const pct = totalSteps > 0 ? Math.round((totalDone / totalSteps) * 100) : 0;

  const gradient = buildStatusGradient(project.features);

  return (
    <button
      type="button"
      onClick={() => onSelect(isSelected ? null : project.name)}
      class={`relative w-full text-left px-4 py-3 transition-colors ${
        isSelected ? 'bg-sky-500/15' : 'hover:bg-slate-800/20'
      }`}
    >
      <div
        class={`absolute left-0 top-0 bottom-0 rounded-r-sm ${isSelected ? 'w-[4px]' : 'w-[3px]'}`}
        style={{ background: gradient ?? '#334155' }}
      />
      <span
        class={`text-sm font-semibold font-sans truncate block ${isSelected ? 'text-white' : 'text-slate-200'}`}
      >
        {project.name}
      </span>
      <span class="text-[13px] text-slate-500 font-mono mt-0.5 block">
        {featureCount} features · {activeCount} active
        {archivedCount > 0 && ` · ${archivedCount} archived`}
      </span>
      {totalSteps > 0 && (
        <div class="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            class="h-full rounded-full bg-sky-500/70 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </button>
  );
}
