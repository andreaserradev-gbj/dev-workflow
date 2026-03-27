import type { FeatureStatus } from '@shared/types.js';
import { useState } from 'preact/hooks';

export interface ActionContext {
  projectPath: string;
  featureName: string;
  projectName: string;
}

type ActionType = 'archive' | 'restore';

interface ActionConfig {
  label: string;
  action: ActionType;
  cls: string;
  confirmCls: string;
}

const ARCHIVABLE: Partial<Record<FeatureStatus, ActionConfig>> = {
  complete: {
    label: 'Archive',
    action: 'archive',
    cls: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/20',
    confirmCls:
      'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 ring-1 ring-inset ring-emerald-500/40',
  },
  archived: {
    label: 'Restore',
    action: 'restore',
    cls: 'bg-slate-600/10 text-slate-500 hover:bg-slate-600/20 ring-1 ring-inset ring-slate-600/20',
    confirmCls:
      'bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 ring-1 ring-inset ring-slate-600/40',
  },
};

async function executeAction(
  action: ActionType,
  projectName: string,
  featureName: string,
): Promise<void> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectName)}/features/${encodeURIComponent(featureName)}/${action}`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error ?? `${action} failed`);
  }
}

// ─── Primary action button (shown in FeatureRow) ────────────────

interface PrimaryProps {
  status: FeatureStatus;
  context: ActionContext;
}

export function PrimaryActionButton({ status, context }: PrimaryProps) {
  const config = ARCHIVABLE[status];
  if (!config) return null;

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: Event) => {
    e.stopPropagation();
    if (busy) return;

    if (!confirming) {
      setConfirming(true);
      setError(null);
      return;
    }

    setBusy(true);
    try {
      await executeAction(config.action, context.projectName, context.featureName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const handleCancel = (e: Event) => {
    e.stopPropagation();
    setConfirming(false);
    setError(null);
  };

  if (confirming) {
    return (
      <span class="inline-flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          class={`inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-medium font-mono transition-colors ${config.confirmCls}`}
          onClick={handleClick}
          disabled={busy}
        >
          {busy ? '...' : `${config.label}?`}
        </button>
        <button
          type="button"
          class="inline-flex items-center px-1.5 py-1 rounded-md text-[13px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span class="inline-flex items-center gap-1.5 flex-shrink-0">
      <button
        type="button"
        class={`inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-medium font-mono transition-colors ${config.cls}`}
        onClick={handleClick}
        title={`${config.label} this feature`}
      >
        {config.label}
      </button>
      {error && <span class="text-[12px] text-red-400">{error}</span>}
    </span>
  );
}
