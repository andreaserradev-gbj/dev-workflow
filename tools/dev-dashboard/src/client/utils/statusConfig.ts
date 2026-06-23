import type { FeatureStatus } from '@shared/types.js';

// Per-status display config (badge label + Tailwind classes) shared by the
// feature row, report view, and search panel. Single source of truth so all
// three render a given status identically.
const STATUS_CONFIG: Record<FeatureStatus, { label: string; badge: string; bar: string }> = {
  gate: {
    label: 'Gate',
    badge: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20',
    bar: 'bg-amber-500',
  },
  active: {
    label: 'Active',
    badge: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
    bar: 'bg-sky-500',
  },
  complete: {
    label: 'Complete',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
    bar: 'bg-emerald-500',
  },
  stale: {
    label: 'Stale',
    badge: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20',
    bar: 'bg-red-500',
  },
  'checkpoint-only': {
    label: 'Checkpoint',
    badge: 'bg-violet-500/10 text-violet-400 ring-1 ring-inset ring-violet-500/20',
    bar: 'bg-violet-500',
  },
  'no-prd': {
    label: 'No PRD',
    badge: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
    bar: 'bg-slate-600',
  },
  empty: {
    label: 'Empty',
    badge: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
    bar: 'bg-slate-700',
  },
  archived: {
    label: 'Archived',
    badge: 'bg-slate-600/10 text-slate-500 ring-1 ring-inset ring-slate-600/20',
    bar: 'bg-slate-700',
  },
};

/** Display config for a status, falling back to 'no-prd' for unknown values. */
export function getStatusConfig(status: string): { label: string; badge: string; bar: string } {
  return STATUS_CONFIG[status as FeatureStatus] ?? STATUS_CONFIG['no-prd'];
}
