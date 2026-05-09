import { useState } from 'preact/hooks';
import type { Feature, Phase, SessionLogEntry, SubPrd } from '@shared/types.js';
import { useFeatureDetail } from '../hooks/useFeatureDetail.js';
import { PrimaryActionButton, executeOpenAction, type OpenMode } from './ActionButton.js';
import { render, renderInline } from '../lib/markdown.js';

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
  complete: {
    label: 'Complete',
    cls: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
  },
  'in-progress': {
    label: 'In Progress',
    cls: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
  },
  'not-started': {
    label: 'Not Started',
    cls: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
  },
};

// Lucide-style stroke icons (16px nominal, viewBox 24).
function IconShell({ children }: { children: preact.ComponentChildren }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {children}
    </svg>
  );
}

const FileTextIcon = () => (
  <IconShell>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </IconShell>
);

const FolderIcon = () => (
  <IconShell>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />
  </IconShell>
);

const TerminalIcon = () => (
  <IconShell>
    <path d="M4 17l5-5-5-5" />
    <path d="M11 19h9" />
  </IconShell>
);

interface OpenIconButtonProps {
  icon: () => preact.JSX.Element;
  label: string;
  mode: OpenMode;
  projectName: string;
  featureName: string;
}

function OpenIconButton({
  icon: Icon,
  label,
  mode,
  projectName,
  featureName,
}: OpenIconButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: Event) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await executeOpenAction(projectName, featureName, mode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={error ?? label}
      aria-label={label}
      class={`p-1.5 rounded transition-colors ${
        error
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800/50'
      } disabled:opacity-50`}
    >
      <Icon />
    </button>
  );
}

interface OpenToolbarProps {
  projectName: string;
  featureName: string;
}

function OpenToolbar({ projectName, featureName }: OpenToolbarProps) {
  return (
    <div class="flex items-center gap-0.5">
      <OpenIconButton
        icon={FileTextIcon}
        label="Open"
        mode="open"
        projectName={projectName}
        featureName={featureName}
      />
      <OpenIconButton
        icon={FolderIcon}
        label="Reveal in Finder"
        mode="reveal"
        projectName={projectName}
        featureName={featureName}
      />
      <OpenIconButton
        icon={TerminalIcon}
        label="Open in Terminal"
        mode="terminal"
        projectName={projectName}
        featureName={featureName}
      />
      <div class="w-px h-3.5 bg-slate-700/60 mx-2" />
      <span class="font-mono text-[10px] uppercase tracking-[0.20em] text-slate-500">
        checkpoint.md
      </span>
    </div>
  );
}

// ─── Session History ─────────────────────────────────────────────
// parseSessionLog returns entries in file order (Session 1 = oldest, last
// = newest). The detail panel reverses for display so the freshest session
// appears at the top with a sky border + LATEST pill, matching the mockup.

interface SessionEntryProps {
  entry: SessionLogEntry;
  isLatest: boolean;
  defaultExpanded: boolean;
}

function SessionEntry({ entry, isLatest, defaultExpanded }: SessionEntryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const ringCls = isLatest ? 'ring-sky-500/40' : 'ring-slate-600/30';
  const contextPrefix = entry.context
    ? entry.context
        .replace(/^##\s+\w+\s*\n+/, '')
        .slice(0, 80)
        .trim()
    : '';

  return (
    <div class={`rounded-lg ring-1 ring-inset ${ringCls} bg-slate-900/30 px-4 py-3`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        class="w-full flex items-center gap-3 text-left cursor-pointer"
      >
        <span class="text-[10px] text-slate-500 w-3 select-none flex-shrink-0">
          {expanded ? '▼' : '▶'}
        </span>
        <span class="font-mono text-[11px] text-slate-400 flex-shrink-0">
          Session {entry.session}
        </span>
        <span class="text-slate-600">&middot;</span>
        <span class="font-mono text-[11px] text-slate-500 flex-shrink-0">{entry.date}</span>
        {!expanded && contextPrefix && (
          <>
            <span class="text-slate-600">&middot;</span>
            <span class="text-xs text-slate-500 truncate flex-1">{contextPrefix}</span>
          </>
        )}
        {!expanded && (entry.decisions.length > 0 || entry.blockers.length > 0) && (
          <span class="font-mono text-[10px] text-slate-600 uppercase tracking-wider flex-shrink-0">
            {entry.decisions.length} decisions &middot; {entry.blockers.length} blockers
          </span>
        )}
        {isLatest && (
          <span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/30 flex-shrink-0">
            Latest
          </span>
        )}
      </button>
      {expanded && (
        <div class="mt-3 space-y-2.5 pl-6">
          {entry.context && (
            <div
              class="md text-xs text-slate-300"
              dangerouslySetInnerHTML={{ __html: render(entry.context) }}
            />
          )}
          {entry.decisions.length > 0 && (
            <div>
              <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Decisions
              </p>
              <ul class="space-y-1">
                {entry.decisions.map((d, i) => (
                  <li key={i} class="text-xs text-slate-400 flex gap-2">
                    <span class="text-slate-600 flex-shrink-0">&bull;</span>
                    <span class="md-inline" dangerouslySetInnerHTML={{ __html: renderInline(d) }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.blockers.length > 0 && (
            <div>
              <p class="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                Blockers
              </p>
              <ul class="space-y-1">
                {entry.blockers.map((b, i) => (
                  <li key={i} class="text-xs text-amber-300/80 flex gap-2">
                    <span class="text-amber-500/50 flex-shrink-0">&bull;</span>
                    <span class="md-inline" dangerouslySetInnerHTML={{ __html: renderInline(b) }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SessionHistoryProps {
  sessionLog: SessionLogEntry[];
}

function SessionHistory({ sessionLog }: SessionHistoryProps) {
  // Default-collapsed in production (mockup shows expanded for visibility only).
  const [open, setOpen] = useState(false);
  // Reverse to show newest first; the parser returns file order (oldest first).
  const newestFirst = [...sessionLog].slice().reverse();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        class="flex items-center gap-2 mb-2 text-left cursor-pointer group"
      >
        <span class="text-[10px] text-sky-300/70 group-hover:text-sky-300 w-3 select-none">
          {open ? '▼' : '▶'}
        </span>
        <span class="font-mono text-[10px] uppercase tracking-[0.20em] text-sky-300/70 group-hover:text-sky-300">
          Session History
        </span>
        <span class="font-mono text-[10px] text-slate-600">({sessionLog.length})</span>
      </button>
      {open && (
        <div class="space-y-2">
          {newestFirst.map((entry, i) => (
            <SessionEntry
              key={entry.session}
              entry={entry}
              isLatest={i === 0}
              defaultExpanded={i < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeaturePanel({ project, projectPath, featureName, feature }: Props) {
  const { data: detail, loading, error } = useFeatureDetail(project, featureName, feature);

  if (loading) {
    return (
      <div class="px-5 py-4 bg-[#080f1e]">
        <span class="text-xs text-slate-500 font-mono">Loading...</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div class="px-5 py-4 bg-[#080f1e]">
        <span class="text-xs text-red-400 font-mono">{error ?? 'No data'}</span>
      </div>
    );
  }

  const totalPhases = detail.phases.length;
  const currentPhaseNum = detail.currentPhase?.number ?? null;

  return (
    <div class="bg-[#080f1e] border-t border-slate-800/30">
      {/* Header bar — open-externally toolbar (left) + Archive/Restore (right) */}
      <div class="flex items-center justify-between px-5 py-2.5 border-b border-slate-800/60 bg-[#0a1426]">
        <OpenToolbar projectName={project} featureName={featureName} />
        {(detail.status === 'archived' || detail.status === 'complete') && (
          <PrimaryActionButton
            status={detail.status}
            context={{ projectPath, featureName, projectName: project }}
          />
        )}
      </div>

      <div class="px-5 py-4 space-y-4">
        {/* Status bar */}
        <div class="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span class="capitalize">{detail.status}</span>
          {currentPhaseNum !== null && totalPhases > 0 && (
            <>
              <span class="text-slate-600">&middot;</span>
              <span>
                Phase {currentPhaseNum} of {totalPhases}
              </span>
            </>
          )}
          {detail.progress && (
            <>
              <span class="text-slate-600">&middot;</span>
              <span>
                {detail.progress.done}/{detail.progress.total} steps
              </span>
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
          <div class="rounded-lg bg-sky-500/5 border border-sky-500/20 border-l-2 border-l-sky-500/30 px-4 py-3">
            <p class="text-[13px] font-semibold text-sky-400 uppercase tracking-wider mb-1">
              Next Action
            </p>
            <div
              class="md text-sm text-slate-200"
              dangerouslySetInnerHTML={{ __html: render(detail.checkpoint.nextAction) }}
            />
          </div>
        )}

        {/* Decisions */}
        {detail.checkpoint && detail.checkpoint.decisions.length > 0 && (
          <div>
            <p class="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Decisions
            </p>
            <ul class="space-y-1">
              {detail.checkpoint.decisions.map((d, i) => (
                <li key={i} class="text-xs text-slate-400 flex gap-2">
                  <span class="text-slate-600 flex-shrink-0">&bull;</span>
                  <span class="md-inline" dangerouslySetInnerHTML={{ __html: renderInline(d) }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Blockers */}
        {detail.checkpoint && detail.checkpoint.blockers.length > 0 && (
          <div class="rounded-lg border border-amber-500/30 border-l-2 border-l-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p class="text-[13px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
              Blockers
            </p>
            <ul class="space-y-1">
              {detail.checkpoint.blockers.map((b, i) => (
                <li key={i} class="text-xs text-amber-300/80 flex gap-2">
                  <span class="text-amber-500/50 flex-shrink-0">&bull;</span>
                  <span class="md-inline" dangerouslySetInnerHTML={{ __html: renderInline(b) }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Phases */}
        {detail.phases.length > 0 && (
          <div>
            <p class="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Phases
            </p>
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
            <p class="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Sub-PRDs
            </p>
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
                    <span
                      class={`inline-flex px-1.5 py-0.5 rounded text-[12px] font-medium flex-shrink-0 ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session History */}
        {detail.sessionLog && detail.sessionLog.length > 0 && (
          <div class="pt-2 border-t border-slate-800/60">
            <SessionHistory sessionLog={detail.sessionLog} />
          </div>
        )}
      </div>
    </div>
  );
}
