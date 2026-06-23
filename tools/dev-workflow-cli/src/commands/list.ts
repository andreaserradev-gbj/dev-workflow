import { join } from 'path';
import {
  scanProjects,
  STATUS_ORDER,
  type Feature,
  type FeatureStatus,
} from 'dev-workflow-core';
import { parseFlags } from '../index.js';
import { matchesProject, resolveScanDirs } from '../scan-dirs.js';

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

interface ListedProject {
  name: string;
  path: string;
  features: Feature[];
}

export async function list(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);

  const json = flags.json === true;
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

  // Apply filters
  const filtered = projects
    .map((p) => ({
      name: p.name,
      path: p.path,
      features: p.features.filter((f) => keepFeature(f, { all, statusFilter })),
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
        features: p.features.map((f) => featureJson(f, p.path)),
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  printText(filtered, scanDirs);
  return 0;
}

// ─── Filtering ─────────────────────────────────────────────────────────

interface FilterOpts {
  all: boolean;
  statusFilter: FeatureStatus | null;
}

function keepFeature(f: Feature, opts: FilterOpts): boolean {
  const { all, statusFilter } = opts;

  if (statusFilter) return f.status === statusFilter;

  if (!all && f.status === 'archived') return false;

  return true;
}

// ─── Sorting ───────────────────────────────────────────────────────────

function sortListing(projects: ListedProject[]): void {
  for (const p of projects) {
    p.features.sort((a, b) => {
      const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDelta !== 0) return statusDelta;
      return a.name.localeCompare(b.name);
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
  for (const f of p.features) {
    const cp = f.lastCheckpoint;
    if (!cp) continue;
    const ms = new Date(cp).getTime();
    if (Number.isFinite(ms) && ms > max) max = ms;
  }
  return max > 0 ? max : null;
}

// ─── Output ────────────────────────────────────────────────────────────

function featureJson(f: Feature, projectPath: string) {
  return {
    name: f.name,
    path: join(projectPath, f.status === 'archived' ? '.dev-archive' : '.dev', f.name),
    status: f.status,
    progress: f.progress,
    currentPhase: f.currentPhase,
  };
}

function printText(projects: ListedProject[], scanDirs: string[]): void {
  if (projects.length === 0) {
    const where = scanDirs.join(', ');
    console.log(`No features found under: ${where}`);
    return;
  }

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (i > 0) console.log('');
    console.log(`Project: ${p.name} (${p.path})`);

    const nameWidth = Math.max(...p.features.map((f) => f.name.length));
    const statusWidth = Math.max(...p.features.map((f) => f.status.length));

    for (const f of p.features) {
      const name = f.name.padEnd(nameWidth);
      const status = f.status.padEnd(statusWidth);
      const progress = f.progress
        ? `${f.progress.done}/${f.progress.total}`
        : '-';
      const phase = f.currentPhase
        ? `Phase ${f.currentPhase.number}/${f.currentPhase.total}`
        : '-';
      console.log(`  ${name}  ${status}  ${progress.padEnd(7)} ${phase.padEnd(13)}`);
    }
  }
}
