import { useState, useEffect, useRef } from 'preact/hooks';
import type { FeatureDetail } from '@shared/types.js';

interface UseFeatureDetailResult {
  data: FeatureDetail | null;
  loading: boolean;
  error: string | null;
}

// Module-level cache shared across hook instances
const cache = new Map<string, FeatureDetail>();

function cacheKey(project: string, feature: string): string {
  return `${project}/${feature}`;
}

/**
 * Fetches and caches FeatureDetail for a given project/feature.
 *
 * @param project - Project name
 * @param featureName - Feature name
 * @param invalidationSignal - Any value that changes when the data should be
 *   refetched (e.g. the Feature object from the list, updated by WebSocket).
 *   On change, cached data is returned immediately while refetching in the background.
 */
export function useFeatureDetail(
  project: string,
  featureName: string,
  invalidationSignal?: unknown,
): UseFeatureDetailResult {
  const key = cacheKey(project, featureName);
  const cached = cache.get(key);

  const [data, setData] = useState<FeatureDetail | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  // Track the signal to detect changes after initial mount
  const prevSignal = useRef(invalidationSignal);
  const hasFetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const isInvalidation = prevSignal.current !== invalidationSignal && cached != null;
    prevSignal.current = invalidationSignal;

    // Always fetch on first mount (cache may be stale from a previous mount cycle).
    // On subsequent renders, skip fetch if signal hasn't changed.
    if (hasFetchedRef.current && cached && !isInvalidation && data != null) return;
    hasFetchedRef.current = true;

    // For stale-while-revalidate: don't show loading if we have cached data
    if (!cached) setLoading(true);

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(
      `/api/projects/${encodeURIComponent(project)}/features/${encodeURIComponent(featureName)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load detail (${res.status})`);
        return res.json();
      })
      .then((detail: FeatureDetail) => {
        cache.set(key, detail);
        setData(detail);
        setLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [project, featureName, invalidationSignal]);

  return { data, loading, error };
}
