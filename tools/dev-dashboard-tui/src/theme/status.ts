import type { FeatureStatus } from 'dev-workflow-core/types';

// ANSI port of the web dashboard's getStatusConfig
// (tools/dev-dashboard/src/client/utils/statusConfig.ts). Same 8 FeatureStatus
// keys. The web keeps separate Tailwind classes for the badge and the progress
// bar but uses one hue per status for both; in the terminal that collapses to a
// single Ink `color`, applied to both the status badge and the progress-bar
// fill. Named ANSI colors (not hex) keep it readable across terminal themes.
// Single source of truth so every surface renders a given status identically.

export interface StatusTheme {
  /** Short badge label shown next to a feature. */
  label: string;
  /** Ink `Text` color for the badge and progress-bar fill. */
  color: string;
}

const STATUS_THEME: Record<FeatureStatus, StatusTheme> = {
  gate: { label: 'Gate', color: 'yellow' },
  active: { label: 'Active', color: 'cyan' },
  complete: { label: 'Complete', color: 'green' },
  stale: { label: 'Stale', color: 'red' },
  'checkpoint-only': { label: 'Checkpoint', color: 'magenta' },
  'no-prd': { label: 'No PRD', color: 'gray' },
  empty: { label: 'Empty', color: 'gray' },
  archived: { label: 'Archived', color: 'gray' },
};

/** Display theme for a status, falling back to 'no-prd' for unknown values. */
export function getStatusTheme(status: string): StatusTheme {
  return STATUS_THEME[status as FeatureStatus] ?? STATUS_THEME['no-prd'];
}
