import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join, resolve } from 'path';
import {
  scanProjects,
  searchFeatures,
  type FeatureStatus,
  type Project,
  type SearchHit,
} from 'dev-workflow-core';
import { parseFlags } from '../index.js';

const VALID_STATUSES: ReadonlySet<FeatureStatus> = new Set([
  'gate',
  'active',
  'stale',
  'complete',
  'checkpoint-only',
  'no-prd',
  'empty',
  'archived',
]);

export async function search(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);

  const json = flags.json === true;
  const query = typeof flags.query === 'string' ? flags.query : null;
  const projectFilter = typeof flags.project === 'string' ? flags.project : null;
  const statusFilter = typeof flags.status === 'string' ? (flags.status as FeatureStatus) : null;
  const scanOverride = typeof flags.scan === 'string' ? flags.scan : null;
  const maxResults = typeof flags.max === 'string' ? parseInt(flags.max, 10) : undefined;

  if (!query) {
    console.error('--query is required');
    return 1;
  }

  if (statusFilter && !VALID_STATUSES.has(statusFilter)) {
    console.error(
      `Unknown status: ${statusFilter}. Valid: ${[...VALID_STATUSES].join(', ')}`,
    );
    return 1;
  }

  const scanDirs = await resolveScanDirs(scanOverride);
  let projects = await scanProjects(scanDirs);

  if (projectFilter) {
    projects = projects.filter((p) => matchesProject(p, projectFilter));
  }

  if (statusFilter) {
    projects = projects.map((p) => ({
      ...p,
      features: p.features.filter((f) => f.status === statusFilter),
    })).filter((p) => p.features.length > 0);
  }

  const hits = searchFeatures(projects, { query, maxResults });

  if (json) {
    const payload = {
      query,
      hits: hits.map((h) => ({
        projectName: h.project,
        name: h.feature.name,
        status: h.feature.status,
        progress: h.feature.progress,
        currentPhase: h.feature.currentPhase,
        score: h.score,
        snippet: h.matches[0]?.snippet ?? null,
        matches: h.matches,
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printText(hits, query);
  }

  return hits.length > 0 ? 0 : 1;
}

// ─── Scan-dir resolution (mirrors list.ts) ───────────────────────────

async function resolveScanDirs(scanFlag: string | null): Promise<string[]> {
  if (scanFlag) return [expandHome(scanFlag)];

  const fromConfig = await readDashboardScanDirs();
  if (fromConfig.length > 0) return fromConfig;

  return [process.cwd()];
}

function getDashboardConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(configHome, 'dev-dashboard', 'config.json');
}

async function readDashboardScanDirs(): Promise<string[]> {
  let raw: string;
  try {
    raw = await readFile(getDashboardConfigPath(), 'utf-8');
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];
  const dirs = (parsed as { scanDirs?: unknown }).scanDirs;
  if (!Array.isArray(dirs)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    if (typeof dir !== 'string') continue;
    const expanded = expandHome(dir.trim());
    if (!expanded || seen.has(expanded)) continue;
    seen.add(expanded);
    out.push(expanded);
  }
  return out;
}

function expandHome(dir: string): string {
  if (dir === '~') return homedir();
  if (dir.startsWith('~/')) return resolve(homedir(), dir.slice(2));
  return resolve(dir);
}

function matchesProject(p: Project, filter: string): boolean {
  if (p.name === filter) return true;
  const expanded = expandHome(filter);
  return p.path === expanded;
}

// ─── Text output ─────────────────────────────────────────────────────

function printText(hits: SearchHit[], query: string): void {
  if (hits.length === 0) {
    console.log(`No results for "${query}"`);
    return;
  }

  // Group hits by project
  const grouped = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.project) ?? [];
    list.push(hit);
    grouped.set(hit.project, list);
  }

  let first = true;
  for (const [project, projectHits] of grouped) {
    if (!first) console.log('');
    first = false;

    const countLabel = projectHits.length === 1 ? '1 hit' : `${projectHits.length} hits`;
    console.log(`${project} (${countLabel})`);

    const nameWidth = Math.max(...projectHits.map((h) => h.feature.name.length));
    const statusWidth = Math.max(...projectHits.map((h) => h.feature.status.length));

    for (const hit of projectHits) {
      const f = hit.feature;
      const name = f.name.padEnd(nameWidth);
      const status = f.status.padEnd(statusWidth);
      const progress = f.progress
        ? `${f.progress.done}/${f.progress.total}`
        : '-';
      console.log(`  ${name}  ${status}  ${progress}`);

      const snippet = hit.matches[0]?.snippet;
      if (snippet) {
        console.log(`    ${snippet}`);
      }
    }
  }
}
