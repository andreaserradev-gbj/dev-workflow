import type { Project } from '@shared/types.js';

interface Props {
  projects: Project[];
  onSelectProject?: (name: string | null) => void;
}

interface ActiveFeature {
  projectName: string;
  featureName: string;
}

export function SessionBar({ projects, onSelectProject }: Props) {
  const activeFeatures: ActiveFeature[] = [];
  const multiProject = projects.length > 1;

  for (const project of projects) {
    for (const feature of project.features) {
      if (feature.status === 'active') {
        activeFeatures.push({
          projectName: project.name,
          featureName: feature.name,
        });
      }
    }
  }

  if (activeFeatures.length === 0) {
    return (
      <div class="mb-6 px-4 py-2.5 rounded-lg bg-slate-800/30 border border-slate-800/40">
        <span class="text-xs text-slate-600 font-mono">No active features</span>
      </div>
    );
  }

  return (
    <div class="mb-6 px-4 py-2.5 rounded-lg bg-slate-800/30 border border-slate-800/40 flex items-center gap-3 flex-wrap">
      <span class="text-xs text-slate-500 font-mono flex-shrink-0">
        {activeFeatures.length} active
      </span>
      <div class="flex items-center gap-2 flex-wrap">
        {activeFeatures.map((af) => (
          <button
            key={`${af.projectName}-${af.featureName}`}
            onClick={() => onSelectProject?.(af.projectName)}
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono
                   bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20
                   hover:bg-sky-500/20 transition-colors cursor-pointer"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
            {multiProject ? `${af.projectName}/${af.featureName}` : af.featureName}
          </button>
        ))}
      </div>
    </div>
  );
}
