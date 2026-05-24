import type { Project, Feature, SearchOptions, SearchHit, SearchMatch } from './types.js';

const DEFAULT_MAX_RESULTS = 20;

interface SearchableField {
  name: string;
  extract: (f: Feature) => string | null;
}

const SEARCHABLE_FIELDS: SearchableField[] = [
  { name: 'name', extract: (f) => f.name },
  { name: 'summary', extract: (f) => f.summary },
  { name: 'nextAction', extract: (f) => f.nextAction },
  { name: 'branch', extract: (f) => f.branch },
  { name: 'currentPhase', extract: (f) => f.currentPhase?.title ?? null },
];

export function searchFeatures(projects: Project[], options: SearchOptions): SearchHit[] {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const terms = options.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const project of projects) {
    for (const feature of project.features) {
      const result = matchFeature(feature, terms);
      if (result) {
        hits.push({
          project: project.name,
          feature,
          matches: result.matches,
          score: result.score,
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, maxResults);
}

function matchFeature(
  feature: Feature,
  terms: string[],
): { matches: SearchMatch[]; score: number } | null {
  const matches: SearchMatch[] = [];
  const termHits = new Set<string>();

  for (const field of SEARCHABLE_FIELDS) {
    const value = field.extract(feature);
    if (!value) continue;

    const lower = value.toLowerCase();
    for (const term of terms) {
      if (lower.includes(term)) {
        termHits.add(term);
        matches.push({
          field: field.name,
          snippet: extractSnippet(value, term),
        });
      }
    }
  }

  // AND semantics: all terms must match somewhere
  if (termHits.size < terms.length) return null;

  // Score: number of field matches (more fields = more relevant)
  const score = matches.length;
  return { matches, score };
}

function extractSnippet(text: string, term: string): string {
  const WINDOW = 60;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term);
  if (idx === -1) return text.slice(0, WINDOW * 2);

  const start = Math.max(0, idx - WINDOW);
  const end = Math.min(text.length, idx + term.length + WINDOW);

  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}
