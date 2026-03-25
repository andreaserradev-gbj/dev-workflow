import type { Feature, FeatureStatus, Project } from '@shared/types.js';

interface Props {
  projects: Project[];
  selectedProject: string | null;
  onSelect: (name: string | null) => void;
}

const BORDER_COLORS: Partial<Record<FeatureStatus, string>> = {
  gate: 'border-l-amber-500',
  active: 'border-l-sky-500',
  stale: 'border-l-red-500',
};

function getDominantStatus(features: Feature[]): FeatureStatus {
  const counts: Partial<Record<FeatureStatus, number>> = {};
  for (const f of features) {
    if (f.status !== 'complete') {
      counts[f.status] = (counts[f.status] ?? 0) + 1;
    }
  }
  let max = 0;
  let dominant: FeatureStatus = 'empty';
  for (const [status, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      dominant = status as FeatureStatus;
    }
  }
  return dominant;
}

export function ProjectRail({ projects, selectedProject, onSelect }: Props) {
  const totalFeatures = projects.reduce((s, p) => s + p.features.length, 0);
  const totalActive = projects.reduce(
    (s, p) => s + p.features.filter((f) => f.status === 'active').length,
    0,
  );

  return (
    <aside class="w-[280px] shrink-0 border-r border-slate-800/40 overflow-y-auto bg-[#080f1e]">
      {/* All Projects */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        class={`w-full text-left px-4 py-3 transition-colors ${
          selectedProject === null
            ? 'bg-sky-500/10 border-l-2 border-l-white'
            : 'border-l-2 border-l-transparent hover:bg-slate-800/20'
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

      {/* Divider */}
      <div class="border-b border-slate-800/40" />

      {/* Project rows */}
      {projects.map((project) => {
        const featureCount = project.features.length;
        const activeCount = project.features.filter((f) => f.status === 'active').length;
        const dominant = getDominantStatus(project.features);
        const borderColor = BORDER_COLORS[dominant] ?? 'border-l-slate-700';
        const isSelected = selectedProject === project.name;

        const totalDone = project.features.reduce((s, f) => s + (f.progress?.done ?? 0), 0);
        const totalSteps = project.features.reduce((s, f) => s + (f.progress?.total ?? 0), 0);
        const pct = totalSteps > 0 ? Math.round((totalDone / totalSteps) * 100) : 0;

        return (
          <button
            key={project.name}
            type="button"
            onClick={() => onSelect(isSelected ? null : project.name)}
            class={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
              isSelected ? 'bg-sky-500/10 border-l-white' : `${borderColor} hover:bg-slate-800/20`
            }`}
          >
            <span
              class={`text-sm font-semibold font-sans truncate block ${isSelected ? 'text-white' : 'text-slate-200'}`}
            >
              {project.name}
            </span>
            <span class="text-[13px] text-slate-500 font-mono mt-0.5 block">
              {featureCount} features · {activeCount} active
            </span>
            {/* Mini progress bar */}
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
      })}
    </aside>
  );
}
