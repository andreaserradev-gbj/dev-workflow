import { useCallback, useEffect, useMemo, useState } from 'react';
import { scanProjects } from 'dev-workflow-core';
import { sortProjects } from 'dev-workflow-core/live';
import type { Feature, FeatureStatus, Project } from 'dev-workflow-core/types';

// The filter pills the portfolio exposes: the catch-all plus the four statuses
// worth isolating and the archived view. A curated subset of FeatureStatus —
// 'checkpoint-only' / 'no-prd' / 'empty' surface under 'all' rather than as
// their own pills. Single source shared by the store and the FilterPills UI.
export const FILTER_KEYS = ['all', 'active', 'gate', 'stale', 'complete', 'archived'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type StorePhase = 'loading' | 'ready' | 'error';

export interface Store {
  phase: StorePhase;
  error: string | null;
  /** All projects, recency-sorted (rail order). Unfiltered. */
  projects: Project[];
  /** Projects whose features match the active filter; empty projects dropped. */
  filteredProjects: Project[];
  filter: FilterKey;
  setFilter: (filter: FilterKey) => void;
  /** Highlighted project — index into filteredProjects (clamped on read). */
  selectedProjectIndex: number;
  setSelectedProjectIndex: (index: number) => void;
  /** Highlighted feature — index into the selected project's filtered features (clamped on read). */
  selectedFeatureIndex: number;
  setSelectedFeatureIndex: (index: number) => void;
  selectedProject: Project | null;
  selectedFeature: Feature | null;
  /** Re-run the one-shot scan (manual refresh; the live watcher arrives in Phase 7). */
  reload: () => void;
}

/**
 * Whether a feature belongs in the given filter view. 'all' hides archived (it
 * has its own pill); 'archived' shows only archived; a status pill matches
 * exactly. This diverges deliberately from the web 'all' (which folds archived
 * into a separate section) — pill-per-view is the simpler terminal model.
 */
function matchesFilter(status: FeatureStatus, filter: FilterKey): boolean {
  if (filter === 'all') return status !== 'archived';
  return status === filter;
}

/** Project list with each project's features narrowed to the filter; projects left empty are dropped. */
export function filterProjects(projects: Project[], filter: FilterKey): Project[] {
  return projects
    .map((project) => ({
      ...project,
      features: project.features.filter((f) => matchesFilter(f.status, filter)),
    }))
    .filter((project) => project.features.length > 0);
}

/** Feature count per filter pill, over all projects. Mirrors matchesFilter: 'all' counts non-archived. */
export function filterCounts(projects: Project[]): Record<FilterKey, number> {
  const counts: Record<FilterKey, number> = {
    all: 0,
    active: 0,
    gate: 0,
    stale: 0,
    complete: 0,
    archived: 0,
  };
  for (const project of projects) {
    for (const feature of project.features) {
      for (const key of FILTER_KEYS) {
        if (matchesFilter(feature.status, key)) counts[key] += 1;
      }
    }
  }
  return counts;
}

/**
 * Portfolio store: one-shot scan of `scanDirs` into recency-sorted projects,
 * plus the active filter and rail/list selection. Single-consumer — no
 * DashboardState broadcast machinery; Ink re-renders straight off this state.
 */
export function useStore(scanDirs: string[]): Store {
  const [phase, setPhase] = useState<StorePhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Join to a stable primitive so a fresh scanDirs array reference per render
  // does not re-trigger the scan; only a real change to the dirs (or reload) does.
  const scanKey = scanDirs.join('\n');

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setError(null);

    scanProjects(scanDirs)
      .then((raw) => {
        if (cancelled) return;
        setProjects(sortProjects(raw));
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      });

    return () => {
      cancelled = true;
    };
    // scanKey stands in for the scanDirs array (stable primitive); nonce forces a manual reload.
  }, [scanKey, nonce]);

  const filteredProjects = useMemo(() => filterProjects(projects, filter), [projects, filter]);

  const selectedProject =
    filteredProjects.length > 0
      ? filteredProjects[Math.min(selectedProjectIndex, filteredProjects.length - 1)]
      : null;

  const features = selectedProject?.features ?? [];
  const selectedFeature =
    features.length > 0 ? features[Math.min(selectedFeatureIndex, features.length - 1)] : null;

  return {
    phase,
    error,
    projects,
    filteredProjects,
    filter,
    setFilter,
    selectedProjectIndex,
    setSelectedProjectIndex,
    selectedFeatureIndex,
    setSelectedFeatureIndex,
    selectedProject,
    selectedFeature,
    reload,
  };
}
