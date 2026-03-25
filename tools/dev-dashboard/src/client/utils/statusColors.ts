import type { Feature, FeatureStatus } from '@shared/types.js';

// Priority order for sorting segments top-to-bottom
const STATUS_PRIORITY: FeatureStatus[] = [
  'gate',
  'active',
  'stale',
  'checkpoint-only',
  'no-prd',
  'complete',
  'empty',
];

export const STATUS_COLORS: Record<FeatureStatus, string> = {
  active: '#0ea5e9', // sky-500
  gate: '#f59e0b', // amber-500
  stale: '#ef4444', // red-500
  complete: '#10b981', // emerald-500
  'checkpoint-only': '#8b5cf6', // violet-500
  'no-prd': '#64748b', // slate-500
  empty: '#475569', // slate-600
};

export function buildStatusGradient(features: Feature[]): string | null {
  if (features.length === 0) return null;

  const counts: Partial<Record<FeatureStatus, number>> = {};
  for (const f of features) {
    counts[f.status] = (counts[f.status] ?? 0) + 1;
  }

  const segments: { color: string; fraction: number }[] = [];
  for (const status of STATUS_PRIORITY) {
    const count = counts[status];
    if (count) {
      segments.push({ color: STATUS_COLORS[status], fraction: count / features.length });
    }
  }

  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0].color;

  const stops: string[] = [];
  let offset = 0;
  for (const seg of segments) {
    const start = Math.round(offset * 100);
    offset += seg.fraction;
    const end = Math.round(offset * 100);
    stops.push(`${seg.color} ${start}%`, `${seg.color} ${end}%`);
  }

  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}
