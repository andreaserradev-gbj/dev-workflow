import type { Project } from '@shared/types.js';
import { FeatureRow } from './FeatureRow.js';

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  const activeCount = project.features.filter(
    (f) => f.status === 'active' || f.status === 'gate'
  ).length;

  return (
    <div class="rounded-xl bg-[#0d1425] border border-slate-800/60 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-800/40 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 rounded-full bg-slate-600" />
          <h2 class="text-base font-semibold text-white font-sans tracking-tight">
            {project.name}
          </h2>
          <span class="text-xs text-slate-500 font-mono">
            {project.features.length} feature{project.features.length !== 1 ? 's' : ''}
          </span>
        </div>
        {activeCount > 0 && (
          <span class="text-xs font-mono text-sky-400/80">
            {activeCount} active
          </span>
        )}
      </div>

      <div class="divide-y divide-slate-800/30">
        {project.features.map((feature) => (
          <FeatureRow
            key={feature.name}
            feature={feature}
            id={`feature-${project.name}-${feature.name}`}
          />
        ))}
      </div>
    </div>
  );
}
