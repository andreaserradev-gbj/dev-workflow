import { useEffect, useRef, useState } from 'preact/hooks';
import type { ReportResponse } from '@shared/types.js';

interface ReportParams {
  from: string;
  to: string;
  project?: string;
}

interface UseReportResult {
  data: ReportResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useReportData(params: ReportParams | null): UseReportResult {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    if (!params) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let url = `/api/report?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`;
    if (params.project) {
      url += `&project=${encodeURIComponent(params.project)}`;
    }

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load report (${res.status})`);
        return res.json();
      })
      .then((result: ReportResponse) => {
        setData(result);
        setLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [params?.from, params?.to, params?.project, fetchCount]);

  const refetch = () => setFetchCount((c) => c + 1);

  return { data, loading, error, refetch };
}
