import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { Project, WsEvent } from '@shared/types.js';
import { STATUS_ORDER } from '@shared/types.js';

export interface UseWebSocketOptions {
  onFeatureUpdated?: (project: string, feature: string) => void;
}

interface UseWebSocketResult {
  projects: Project[];
  connected: boolean;
  loading: boolean;
}

function sortFeatures(projects: Project[]): void {
  for (const project of projects) {
    project.features.sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    );
  }
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelay = useRef(1000);
  const onFeatureUpdatedRef = useRef(options.onFeatureUpdated);
  onFeatureUpdatedRef.current = options.onFeatureUpdated;

  const handleEvent = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'full_refresh':
        sortFeatures(event.data.projects);
        setProjects(event.data.projects);
        setLoading(false);
        break;

      case 'feature_updated':
        onFeatureUpdatedRef.current?.(event.project, event.feature);
        setProjects((prev) =>
          prev.map((p) => {
            if (p.path !== event.project && p.name !== event.project) return p;
            return {
              ...p,
              features: p.features
                .map((f) => (f.name === event.feature ? event.data : f))
                .sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)),
            };
          })
        );
        break;

      case 'feature_added':
        setProjects((prev) => {
          const existing = prev.find(
            (p) => p.path === event.project || p.name === event.project
          );
          if (existing) {
            return prev.map((p) => {
              if (p !== existing) return p;
              const features = [...p.features, event.feature].sort(
                (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
              );
              return { ...p, features };
            });
          }
          // New project
          return [
            ...prev,
            {
              name: event.project.split('/').pop() ?? event.project,
              path: event.project,
              features: [event.feature],
            },
          ];
        });
        break;

      case 'feature_removed':
        setProjects((prev) =>
          prev
            .map((p) => {
              if (p.path !== event.project && p.name !== event.project) return p;
              return {
                ...p,
                features: p.features.filter((f) => f.name !== event.feature),
              };
            })
            .filter((p) => p.features.length > 0)
        );
        break;
    }
  }, []);

  useEffect(() => {
    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectDelay.current = 1000;
      };

      ws.onmessage = (e) => {
        try {
          const event: WsEvent = JSON.parse(e.data);
          handleEvent(event);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect with exponential backoff
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000);
          connect();
        }, reconnectDelay.current);
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [handleEvent]);

  return { projects, connected, loading };
}
