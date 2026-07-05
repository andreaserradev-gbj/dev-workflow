import { useEffect, useState } from 'react';
import { resolve } from 'node:path';
import { buildFeatureDetail } from 'dev-workflow-core';
import type { Feature, FeatureDetail, Project } from 'dev-workflow-core/types';

export interface FeatureDetailState {
  detail: FeatureDetail | null;
  loading: boolean;
  error: string | null;
}

/**
 * Build the expanded FeatureDetail for the selected feature. Mirrors the web
 * dashboard's useFeatureDetail hook, but skips the HTTP round-trip: the TUI
 * shares the process with the parsers, so it calls buildFeatureDetail() (the
 * hoisted core function) directly. Re-runs whenever the selection changes.
 */
export function useFeatureDetail(
  project: Project | null,
  feature: Feature | null,
): FeatureDetailState {
  const [detail, setDetail] = useState<FeatureDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key the effect on identity primitives, not the object refs — every scan
  // yields fresh Project/Feature references, and (projectPath, featureName,
  // status) uniquely identifies a feature's detail on disk.
  const projectPath = project?.path ?? null;
  const projectName = project?.name ?? null;
  const featureName = feature?.name ?? null;
  const featureStatus = feature?.status ?? null;

  useEffect(() => {
    if (!project || !feature || projectPath === null || projectName === null) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const devSubdir = feature.status === 'archived' ? '.dev-archive' : '.dev';
    const featureDir = resolve(project.path, devSubdir, feature.name);

    buildFeatureDetail(featureDir, feature, project.name)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath, projectName, featureName, featureStatus]);

  return { detail, loading, error };
}
