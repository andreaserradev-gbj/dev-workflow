import type { FeatureStatus } from '@shared/types.js';
import { useClipboard } from '../hooks/useClipboard.js';

interface ActionConfig {
  label: string;
  copiedLabel: string;
  payload: (ctx: ActionContext) => string;
  cls: string;
  warn?: boolean;
}

export interface ActionContext {
  projectPath: string;
  featureName: string;
}

const ACTION_BY_STATUS: Record<FeatureStatus, ActionConfig> = {
  gate: {
    label: 'Resume',
    copiedLabel: 'Copied!',
    payload: (ctx) => `cd ${ctx.projectPath} && claude\n/dev-resume ${ctx.featureName}`,
    cls: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 ring-1 ring-inset ring-amber-500/20',
  },
  active: {
    label: 'Resume',
    copiedLabel: 'Copied!',
    payload: (ctx) => `cd ${ctx.projectPath} && claude\n/dev-resume ${ctx.featureName}`,
    cls: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 ring-1 ring-inset ring-sky-500/20',
  },
  stale: {
    label: 'Resume',
    copiedLabel: 'Copied!',
    payload: (ctx) => `cd ${ctx.projectPath} && claude\n/dev-resume ${ctx.featureName}`,
    cls: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 ring-1 ring-inset ring-red-500/20',
    warn: true,
  },
  complete: {
    label: 'Archive',
    copiedLabel: 'Copied!',
    payload: (ctx) =>
      `mv ${ctx.projectPath}/.dev/${ctx.featureName} ${ctx.projectPath}/.dev-archive/`,
    cls: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/20',
  },
  'checkpoint-only': {
    label: 'Resume',
    copiedLabel: 'Copied!',
    payload: (ctx) => `cd ${ctx.projectPath} && claude\n/dev-resume ${ctx.featureName}`,
    cls: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 ring-1 ring-inset ring-violet-500/20',
  },
  'no-prd': {
    label: 'Plan',
    copiedLabel: 'Copied!',
    payload: (ctx) => `cd ${ctx.projectPath} && claude\n/dev-plan`,
    cls: 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 ring-1 ring-inset ring-slate-500/20',
  },
  empty: {
    label: 'Plan',
    copiedLabel: 'Copied!',
    payload: (ctx) => `cd ${ctx.projectPath} && claude\n/dev-plan`,
    cls: 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 ring-1 ring-inset ring-slate-500/20',
  },
};

// ─── Primary action button (shown in FeatureRow) ────────────────

interface PrimaryProps {
  status: FeatureStatus;
  context: ActionContext;
}

export function PrimaryActionButton({ status, context }: PrimaryProps) {
  const { copy, copied } = useClipboard();
  const config = ACTION_BY_STATUS[status];

  return (
    <button
      type="button"
      class={`inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-medium font-mono transition-colors flex-shrink-0 ${config.cls}`}
      onClick={(e) => {
        e.stopPropagation();
        copy(config.payload(context));
      }}
      title={copied ? config.copiedLabel : `Copy "${config.label}" command`}
    >
      {copied ? config.copiedLabel : config.label}
    </button>
  );
}

// ─── Panel command buttons (shown in expanded FeaturePanel) ─────

interface PanelCommandsProps {
  context: ActionContext;
}

export function PanelCommands({ context }: PanelCommandsProps) {
  const resume = useClipboard();
  const board = useClipboard();

  const resumePayload = `cd ${context.projectPath} && claude\n/dev-resume ${context.featureName}`;
  const boardPayload = `/dev-board`;

  return (
    <div class="flex items-center gap-2 flex-wrap">
      <PanelButton
        label="Resume"
        copied={resume.copied}
        onClick={() => resume.copy(resumePayload)}
      />
      <PanelButton label="Board" copied={board.copied} onClick={() => board.copy(boardPayload)} />
    </div>
  );
}

function PanelButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-medium font-mono bg-slate-900/80 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300 transition-colors ring-1 ring-inset ring-slate-700/30"
      onClick={onClick}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
