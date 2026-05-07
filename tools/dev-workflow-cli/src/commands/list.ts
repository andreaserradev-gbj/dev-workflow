import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join, resolve } from 'path';
import {
  scanProjects,
  getAfkRunnableInfo,
  STATUS_ORDER,
  type Feature,
  type FeatureStatus,
  type Project,
  type AfkRunnableState,
  type AfkRunnableInfo,
} from 'dev-workflow-core';
import { parseFlags } from '../index.js';

// AFK state sort order: runnable first (the operator question), then everything else.
const AFK_STATE_ORDER: Record<AfkRunnableState, number> = {
  runnable: 0,
  'not-runnable': 1,
};

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

interface ListedFeature {
  feature: Feature;
  afk: AfkRunnableInfo;
}

interface ListedProject {
  name: string;
  path: string;
  features: ListedFeature[];
}

export async function list(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);

  const json = flags.json === true;
  const afkOnly = flags.afk === true;
  const all = flags.all === true;
  const projectFilter = typeof flags.project === 'string' ? flags.project : null;
  const statusFilter = typeof flags.status === 'string' ? (flags.status as FeatureStatus) : null;
  const scanOverride = typeof flags.scan === 'string' ? flags.scan : null;

  if (statusFilter && !VALID_STATUSES.has(statusFilter)) {
    console.error(
      `Unknown status: ${statusFilter}. Valid: ${[...VALID_STATUSES].join(', ')}`,
    );
    return 1;
  }

  const scanDirs = await resolveScanDirs(scanOverride);
  const projects = await scanProjects(scanDirs);

  // Annotate each feature with its AFK classification
  const annotated: ListedProject[] = projects.map((p) => ({
    name: p.name,
    path: p.path,
    features: p.features.map((f) => ({ feature: f, afk: getAfkRunnableInfo(f) })),
  }));

  // Apply filters
  const filtered = annotated
    .map((p) => ({
      ...p,
      features: p.features.filter((row) => keepFeature(row, { afkOnly, all, statusFilter })),
    }))
    .filter((p) => {
      if (projectFilter && !matchesProject(p, projectFilter)) return false;
      return p.features.length > 0;
    });

  sortListing(filtered);

  if (json) {
    const payload = {
      scanDirs,
      projects: filtered.map((p) => ({
        name: p.name,
        path: p.path,
        features: p.features.map((row) => featureJson(row, p.path)),
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  printText(filtered, scanDirs, { afkOnly, all });
  return 0;
}

// ─── Scan-dir resolution ──────────────────────────────────────────────

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
    console.warn(
      `Warning: dashboard config at ${getDashboardConfigPath()} is invalid JSON; falling back to cwd.`,
    );
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

// ─── Filtering ─────────────────────────────────────────────────────────

interface FilterOpts {
  afkOnly: boolean;
  all: boolean;
  statusFilter: FeatureStatus | null;
}

function keepFeature(row: ListedFeature, opts: FilterOpts): boolean {
  const { afkOnly, all, statusFilter } = opts;

  if (statusFilter) return row.feature.status === statusFilter;

  if (afkOnly) return row.afk.state === 'runnable';

  if (!all && row.feature.status === 'archived') return false;

  return true;
}

function matchesProject(p: ListedProject, filter: string): boolean {
  if (p.name === filter) return true;
  const expanded = expandHome(filter);
  return p.path === expanded;
}

// ─── Sorting ───────────────────────────────────────────────────────────

function sortListing(projects: ListedProject[]): void {
  for (const p of projects) {
    p.features.sort((a, b) => {
      const stateDelta = AFK_STATE_ORDER[a.afk.state] - AFK_STATE_ORDER[b.afk.state];
      if (stateDelta !== 0) return stateDelta;
      const statusDelta = STATUS_ORDER[a.feature.status] - STATUS_ORDER[b.feature.status];
      if (statusDelta !== 0) return statusDelta;
      return a.feature.name.localeCompare(b.feature.name);
    });
  }

  projects.sort((a, b) => {
    const aDate = mostRecentCheckpoint(a);
    const bDate = mostRecentCheckpoint(b);
    if (aDate && bDate) {
      const delta = bDate - aDate;
      if (delta !== 0) return delta;
    } else if (aDate && !bDate) {
      return -1;
    } else if (!aDate && bDate) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function mostRecentCheckpoint(p: ListedProject): number | null {
  let max = 0;
  for (const row of p.features) {
    const cp = row.feature.lastCheckpoint;
    if (!cp) continue;
    const ms = new Date(cp).getTime();
    if (Number.isFinite(ms) && ms > max) max = ms;
  }
  return max > 0 ? max : null;
}

// ─── Output ────────────────────────────────────────────────────────────

function featureJson(row: ListedFeature, projectPath: string) {
  const f = row.feature;
  return {
    name: f.name,
    path: join(projectPath, f.status === 'archived' ? '.dev-archive' : '.dev', f.name),
    status: f.status,
    progress: f.progress,
    currentPhase: f.currentPhase,
    afk: row.afk,
  };
}

function printText(
  projects: ListedProject[],
  scanDirs: string[],
  opts: { afkOnly: boolean; all: boolean },
): void {
  if (projects.length === 0) {
    const where = scanDirs.join(', ');
    if (opts.afkOnly) {
      console.log(`No AFK-runnable features found under: ${where}`);
    } else {
      console.log(`No features found under: ${where}`);
    }
    return;
  }

  const stateLabel: Record<AfkRunnableState, string> = {
    runnable: 'READY',
    'not-runnable': 'BLOCKED',
  };

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (i > 0) console.log('');
    console.log(`Project: ${p.name} (${p.path})`);

    const labelWidth = Math.max(...p.features.map((r) => stateLabel[r.afk.state].length));
    const nameWidth = Math.max(...p.features.map((r) => r.feature.name.length));
    const statusWidth = Math.max(...p.features.map((r) => r.feature.status.length));

    for (const row of p.features) {
      const f = row.feature;
      const label = stateLabel[row.afk.state].padEnd(labelWidth);
      const name = f.name.padEnd(nameWidth);
      const status = f.status.padEnd(statusWidth);
      const progress = f.progress
        ? `${f.progress.done}/${f.progress.total}`
        : '-';
      const phase = f.currentPhase
        ? `Phase ${f.currentPhase.number}/${f.currentPhase.total}`
        : '-';
      console.log(
        `  ${label}  ${name}  ${status}  ${progress.padEnd(7)} ${phase.padEnd(13)} ${row.afk.reason}`,
      );
    }
  }
}
