import type { Feature, ReportFeature } from '@shared/types.js';

export interface ReportStats {
  total: number;
  completed: number;
  created: number;
  avgProgress: number;
}

function hasDateInRange(value: string | null, from: Date, to: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date >= from && date <= to;
}

export function isCompletedFeature(feature: Pick<Feature, 'status' | 'progress'>): boolean {
  if (feature.progress && feature.progress.total > 0) {
    return feature.progress.done === feature.progress.total;
  }

  return feature.status === 'complete';
}

export function computeReportStats(
  features: ReportFeature[],
  from: string,
  to: string,
): ReportStats {
  const total = features.length;
  const completed = features.filter(isCompletedFeature).length;

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const created = features.filter((feature) =>
    hasDateInRange(feature.created, fromDate, toDate),
  ).length;

  const withProgress = features.filter((feature) => feature.progress && feature.progress.total > 0);
  const avgProgress =
    withProgress.length > 0
      ? Math.round(
          (withProgress.reduce((sum, feature) => {
            return sum + feature.progress!.done / feature.progress!.total;
          }, 0) /
            withProgress.length) *
            100,
        )
      : 0;

  return { total, completed, created, avgProgress };
}
