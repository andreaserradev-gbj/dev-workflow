import { useState, useEffect, useRef } from 'preact/hooks';
import type { DashboardSearchHit } from '@shared/types.js';

interface UseSearchResult {
  hits: DashboardSearchHit[];
  loading: boolean;
  error: string | null;
}

const cache = new Map<string, DashboardSearchHit[]>();

export function useSearch(query: string): UseSearchResult {
  const trimmed = query.trim();
  const cached = trimmed ? cache.get(trimmed) : undefined;

  const [hits, setHits] = useState<DashboardSearchHit[]>(cached ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!trimmed) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (cached) setHits(cached);
    setLoading(!cached);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return res.json();
      })
      .then((data: { hits: DashboardSearchHit[] }) => {
        cache.set(trimmed, data.hits);
        setHits(data.hits);
        setLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [trimmed]);

  return { hits, loading, error };
}
