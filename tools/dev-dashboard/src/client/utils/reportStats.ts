import type { Feature, ReportFeature } from '@shared/types.js';

export interface ReportStats {
  total: number;
  completed: number;
  created: number;
  avgProgress: number;
}

export interface ReportProjectGroup {
  project: string;
  features: ReportFeature[];
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function getLatestActivityInRange(feature: ReportFeature, from: Date, to: Date): number {
  const dates = [feature.lastCheckpoint, feature.lastUpdated, feature.created]
    .map(parseDate)
    .filter((date): date is Date => !!date)
    .filter((date) => date >= from && date <= to)
    .map((date) => date.getTime());
  return dates.length > 0 ? Math.max(...dates) : 0;
}

function hasDateInRange(value: string | null, from: Date, to: Date): boolean {
  const date = parseDate(value);
  return !!date && date >= from && date <= to;
}

export function isCompletedFeature(feature: Pick<Feature, 'status' | 'progress'>): boolean {
  if (feature.progress && feature.progress.total > 0) {
    return feature.progress.done === feature.progress.total;
  }

  return feature.status === 'complete';
}

export function getWorkedDays(
  feature: Pick<Feature, 'created' | 'lastCheckpoint' | 'lastUpdated' | 'progress'>,
): number | null {
  if (!feature.progress || feature.progress.percent <= 0) {
    return null;
  }

  const timeline = [
    parseDate(feature.created),
    parseDate(feature.lastUpdated),
    parseDate(feature.lastCheckpoint),
  ].filter((value): value is Date => value !== null);
  if (timeline.length === 0) return null;

  const start = new Date(Math.min(...timeline.map((value) => value.getTime())));
  const endCandidates = [
    parseDate(feature.lastUpdated),
    parseDate(feature.lastCheckpoint),
    start,
  ].filter((value): value is Date => value !== null);
  const end = new Date(Math.max(...endCandidates.map((value) => value.getTime())));
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / 86400000) + 1);
}

export function sortReportProjects(
  groups: ReportProjectGroup[],
  from: string,
  to: string,
): ReportProjectGroup[] {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const bucket = (group: ReportProjectGroup): number => {
    if (
      group.features.some((feature) => feature.status === 'active' || feature.status === 'stale')
    ) {
      return 0;
    }
    if (group.features.some((feature) => feature.status !== 'archived')) {
      return 1;
    }
    return 2;
  };

  const latestActivity = (group: ReportProjectGroup): number =>
    Math.max(
      ...group.features.map((feature) => getLatestActivityInRange(feature, fromDate, toDate)),
    );

  return [...groups].sort((a, b) => {
    const bucketDiff = bucket(a) - bucket(b);
    if (bucketDiff !== 0) return bucketDiff;

    const activityDiff = latestActivity(b) - latestActivity(a);
    if (activityDiff !== 0) return activityDiff;

    return a.project.localeCompare(b.project);
  });
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
