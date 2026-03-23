import type { Feature, Phase, SubPrd } from '@shared/types.js';
import { useFeatureDetail } from '../hooks/useFeatureDetail.js';
import { PanelCommands } from './ActionButton.js';

interface Props {
  project: string;
  projectPath: string;
  featureName: string;
  feature: Feature; // from list state — changes on WebSocket update, used as invalidation signal
}

const PHASE_ICON: Record<Phase['status'], string> = {
  complete: '\u2705',
  'in-progress': '\uD83D\uDD36',
  'not-started': '\u2B1C',
};

const SUB_PRD_BADGE: Record<SubPrd['status'], { label: string; cls: string }> = {
  complete: { label: 'Complete', cls: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20' },
  'in-progress': { label: 'In Progress', cls: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20' },
  'not-started': { label: 'Not Started', cls: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20' },
};

export function FeaturePanel({ project, projectPath, featureName, feature }: Props) {
  const { data: detail, loading, error } = useFeatureDetail(project, featureName, feature);

  if (loading) {
    return (
      <div class="px-5 py-4 bg-slate-900/50">
        <span class="text-xs text-slate-500 font-mono">Loading...</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div class="px-5 py-4 bg-slate-900/50">
        <span class="text-xs text-red-400 font-mono">{error ?? 'No data'}</span>
      </div>
    );
  }

  const totalPhases = detail.phases.length;
  const currentPhaseNum = detail.currentPhase?.number ?? null;

  return (
    <div class="px-5 py-4 bg-slate-900/50 border-t border-slate-800/30 space-y-4">
      {/* Status bar */}
      <div class="flex items-center gap-3 text-xs font-mono text-slate-400">
        <span class="capitalize">{detail.status}</span>
        {currentPhaseNum !== null && totalPhases > 0 && (
          <>
            <span class="text-slate-600">&middot;</span>
            <span>Phase {currentPhaseNum} of {totalPhases}</span>
          </>
        )}
        {detail.progress && (
          <>
            <span class="text-slate-600">&middot;</span>
            <span>{detail.progress.done}/{detail.progress.total} steps</span>
          </>
        )}
        {detail.branch && (
          <>
            <span class="text-slate-600">&middot;</span>
            <span class="text-slate-500">{detail.branch}</span>
          </>
        )}
      </div>

      {/* Next Action */}
      {detail.checkpoint?.nextAction && (
        <div class="rounded-lg bg-sky-500/5 border border-sky-500/20 px-4 py-3">
          <p class="text-[11px] font-semibold text-sky-400 uppercase tracking-wider mb-1">Next Action</p>
          <p class="text-sm text-slate-200 whitespace-pre-line">{detail.checkpoint.nextAction}</p>
        </div>
      )}

      {/* Decisions */}
      {detail.checkpoint && detail.checkpoint.decisions.length > 0 && (
        <div>
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Decisions</p>
          <ul class="space-y-1">
            {detail.checkpoint.decisions.map((d, i) => (
              <li key={i} class="text-xs text-slate-400 flex gap-2">
                <span class="text-slate-600 flex-shrink-0">&bull;</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blockers */}
      {detail.checkpoint && detail.checkpoint.blockers.length > 0 && (
        <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p class="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">Blockers</p>
          <ul class="space-y-1">
            {detail.checkpoint.blockers.map((b, i) => (
              <li key={i} class="text-xs text-amber-300/80 flex gap-2">
                <span class="text-amber-500/50 flex-shrink-0">&bull;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Phases */}
      {detail.phases.length > 0 && (
        <div>
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phases</p>
          <div class="space-y-1">
            {detail.phases.map((phase) => (
              <div key={phase.number} class="flex items-center gap-2 text-xs">
                <span class="flex-shrink-0 w-4 text-center">{PHASE_ICON[phase.status]}</span>
                <span class="text-slate-400 font-mono w-4 flex-shrink-0">{phase.number}</span>
                <span class="text-slate-300 flex-1 truncate">{phase.title}</span>
                {phase.total > 0 && (
                  <span class="text-slate-500 font-mono flex-shrink-0">
                    {phase.done}/{phase.total}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-PRDs */}
      {detail.subPrds.length > 0 && (
        <div>
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sub-PRDs</p>
          <div class="space-y-1">
            {detail.subPrds.map((sub) => {
              const badge = SUB_PRD_BADGE[sub.status];
              return (
                <div key={sub.id} class="flex items-center gap-2 text-xs">
                  <span class="text-slate-300 flex-1 truncate">{sub.title}</span>
                  {sub.total > 0 && (
                    <span class="text-slate-500 font-mono flex-shrink-0">
                      {sub.done}/{sub.total}
                    </span>
                  )}
                  <span class={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commands */}
      <PanelCommands context={{ projectPath, featureName }} />
    </div>
  );
}
