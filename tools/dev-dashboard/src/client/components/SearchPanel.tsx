import { useState, useEffect, useRef } from 'preact/hooks';
import type { DashboardSearchHit } from '@shared/types.js';
import { getStatusConfig } from '../utils/statusConfig.js';

interface Props {
  query: string;
  hits: DashboardSearchHit[];
  loading: boolean;
  onSelectFeature: (projectName: string, featureName: string) => void;
  onClose: () => void;
}

function highlightTerms(text: string, query: string): preact.JSX.Element {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => part.toLowerCase() === t) ? (
          <span key={i} class="text-sky-300 font-semibold">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function SearchPanel({ query, hits, loading, onSelectFeature, onClose }: Props) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset focus when hits change
  useEffect(() => {
    setFocusedIndex(0);
  }, [hits]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, hits.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && hits.length > 0) {
        e.preventDefault();
        const hit = hits[focusedIndex];
        if (hit) onSelectFeature(hit.projectName, hit.name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hits, focusedIndex, onSelectFeature, onClose]);

  // Scroll focused item into view
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focused = panel.querySelector('[data-focused="true"]');
    focused?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  // Group hits by project
  const grouped = new Map<string, DashboardSearchHit[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.projectName) ?? [];
    list.push(hit);
    grouped.set(hit.projectName, list);
  }

  // Flat index for keyboard navigation
  let flatIndex = 0;

  return (
    <div
      ref={panelRef}
      class="absolute top-full right-0 mt-1 z-50 bg-slate-800 border border-slate-700
             rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in"
      style={{ maxHeight: '60vh', width: '420px' }}
    >
      <div class="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 32px)' }}>
        {loading && hits.length === 0 ? (
          <div class="p-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} class="animate-pulse flex items-center gap-3 p-2">
                <div class="h-4 bg-slate-700 rounded w-32" />
                <div class="h-3 bg-slate-700/60 rounded w-16" />
              </div>
            ))}
          </div>
        ) : hits.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-8 text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="w-6 h-6 mb-2 opacity-50"
            >
              <path
                fill-rule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-xs">No features matched</span>
          </div>
        ) : (
          <div class="py-1">
            {[...grouped.entries()].map(([project, projectHits]) => (
              <div key={project}>
                <div class="px-3 pt-2 pb-1">
                  <span class="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {project}
                  </span>
                </div>
                {projectHits.map((hit) => {
                  const idx = flatIndex++;
                  const isFocused = idx === focusedIndex;
                  const config = getStatusConfig(hit.status);
                  const progress = hit.progress
                    ? Math.round((hit.progress.done / hit.progress.total) * 100)
                    : 0;

                  return (
                    <button
                      key={`${hit.projectName}/${hit.name}`}
                      type="button"
                      data-focused={isFocused}
                      onClick={() => onSelectFeature(hit.projectName, hit.name)}
                      class={`w-full text-left px-3 py-2 flex flex-col gap-1 cursor-pointer transition-colors
                        ${isFocused ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'}`}
                    >
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-slate-200 truncate">
                          {highlightTerms(hit.name, query)}
                        </span>
                        <span
                          class={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.badge}`}
                        >
                          {config.label}
                        </span>
                        {hit.progress && (
                          <div class="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                            <div class="w-12 h-[3px] rounded-full bg-slate-700 overflow-hidden">
                              <div
                                class={`h-full rounded-full ${config.bar}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span class="text-[10px] font-mono text-slate-500">
                              {hit.progress.done}/{hit.progress.total}
                            </span>
                          </div>
                        )}
                      </div>
                      {hit.snippet && (
                        <span class="text-xs text-slate-400 italic truncate">
                          {highlightTerms(hit.snippet, query)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with keyboard hints */}
      <div class="flex items-center justify-between px-3 py-1.5 border-t border-slate-700/60 bg-slate-800/80">
        <div class="flex items-center gap-2 text-[10px] text-slate-500">
          <span>
            <kbd class="px-1 py-0.5 rounded bg-slate-700/60 text-slate-400 font-mono">↑↓</kbd>{' '}
            navigate
          </span>
          <span>
            <kbd class="px-1 py-0.5 rounded bg-slate-700/60 text-slate-400 font-mono">↵</kbd> open
          </span>
          <span>
            <kbd class="px-1 py-0.5 rounded bg-slate-700/60 text-slate-400 font-mono">esc</kbd>{' '}
            close
          </span>
        </div>
        {hits.length > 0 && (
          <span class="text-[10px] text-slate-500 font-mono">
            {hits.length} result{hits.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
