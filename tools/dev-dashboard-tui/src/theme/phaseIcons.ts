import type { Phase } from 'dev-workflow-core/types';

// Terminal port of the web dashboard's PHASE_ICON map
// (tools/dev-dashboard/src/client/components/FeaturePanel.tsx:14-18). Same three
// Phase['status'] keys and the same emoji glyphs — they render identically in a
// UTF-8 terminal, so no ANSI substitution is needed here (unlike the status
// theme, where the web's Tailwind classes had to collapse to Ink colors).
const PHASE_ICON: Record<Phase['status'], string> = {
  complete: '✅', // ✅
  'in-progress': '🔶', // 🔶
  'not-started': '⬜', // ⬜
};

/** Icon glyph for a phase status, falling back to the not-started box for unknown values. */
export function getPhaseIcon(status: string): string {
  return PHASE_ICON[status as Phase['status']] ?? PHASE_ICON['not-started'];
}
