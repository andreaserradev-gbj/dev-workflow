import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { scanProjects, generateWiki, type Project } from 'dev-workflow-core';
import { parseFlags } from '../index.js';

export async function wikiIndex(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);

  const json = flags.json === true;
  const generate = flags.generate === true;
  const scanOverride = typeof flags.scan === 'string' ? flags.scan : null;
  const outOverride = typeof flags.out === 'string' ? flags.out : null;

  const scanDirs = await resolveScanDirs(scanOverride);
  const wikiDir = await resolveWikiDir(outOverride);
  const projects = await scanProjects(scanDirs);

  if (generate) {
    await generateWiki(projects, wikiDir, { includeReadme: true, initObsidian: true });
    const stats = countStats(projects);
    if (json) {
      console.log(JSON.stringify({
        wikiDir,
        generated: true,
        projects: stats.projectCount,
        features: stats.featureCount,
        entries: buildEntries(projects),
      }, null, 2));
    } else {
      console.log(`Generated wiki at ${wikiDir}`);
      console.log(`  index.md — ${stats.projectCount} projects, ${stats.featureCount} features`);
      console.log(`  log.md — ${stats.featureCount} entries`);
      console.log(`  projects/ — ${stats.projectCount} symlinks`);
      console.log(`  README.md — Obsidian setup guide`);
    }
    return 0;
  }

  if (json) {
    const stats = countStats(projects);
    console.log(JSON.stringify({
      wikiDir,
      generated: false,
      projects: stats.projectCount,
      features: stats.featureCount,
      entries: buildEntries(projects),
    }, null, 2));
    return 0;
  }

  printText(projects, wikiDir);
  return 0;
}

// ─── Scan-dir resolution ──────────────────────────────────────────

async function resolveScanDirs(scanFlag: string | null): Promise<string[]> {
  if (scanFlag) return [expandHome(scanFlag)];

  const fromConfig = await readDashboardScanDirs();
  if (fromConfig.length > 0) return fromConfig;

  return [process.cwd()];
}

async function resolveWikiDir(outFlag: string | null): Promise<string> {
  if (outFlag) return expandHome(outFlag);

  const fromConfig = await readDashboardWikiDir();
  if (fromConfig) return fromConfig;

  return join(homedir(), '.dev-wiki');
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

async function readDashboardWikiDir(): Promise<string | null> {
  let raw: string;
  try {
    raw = await readFile(getDashboardConfigPath(), 'utf-8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const wikiDir = (parsed as { wikiDir?: unknown }).wikiDir;
  if (typeof wikiDir !== 'string') return null;
  return expandHome(wikiDir.trim());
}

function expandHome(dir: string): string {
  if (dir === '~') return homedir();
  if (dir.startsWith('~/')) return resolve(homedir(), dir.slice(2));
  return resolve(dir);
}

// ─── Output helpers ───────────────────────────────────────────────

function countStats(projects: Project[]): { projectCount: number; featureCount: number } {
  let featureCount = 0;
  for (const p of projects) featureCount += p.features.length;
  return { projectCount: projects.length, featureCount };
}

function buildEntries(projects: Project[]) {
  const entries: {
    project: string;
    name: string;
    status: string;
    progress: number | null;
    summary: string | null;
    lastCheckpoint: string | null;
  }[] = [];

  for (const p of projects) {
    for (const f of p.features) {
      entries.push({
        project: p.name,
        name: f.name,
        status: f.status,
        progress: f.progress?.percent ?? null,
        summary: f.summary,
        lastCheckpoint: f.lastCheckpoint,
      });
    }
  }

  entries.sort((a, b) => {
    if (!a.lastCheckpoint && !b.lastCheckpoint) return 0;
    if (!a.lastCheckpoint) return 1;
    if (!b.lastCheckpoint) return -1;
    return new Date(b.lastCheckpoint).getTime() - new Date(a.lastCheckpoint).getTime();
  });

  return entries;
}

function printText(projects: Project[], wikiDir: string): void {
  const stats = countStats(projects);
  console.log(`Dev Wiki Index — ${stats.projectCount} projects, ${stats.featureCount} features`);
  console.log('');

  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));

  for (const p of sorted) {
    console.log(`${p.name} (${p.features.length} features)`);
    for (const f of p.features) {
      const status = f.status.padEnd(16);
      const progress = f.progress ? `${f.progress.percent}%` : '—';
      const summary = f.summary ? truncate(f.summary, 50) : '';
      console.log(`  ${f.name.padEnd(40)} ${status} ${progress.padStart(4)}  ${summary}`);
    }
    console.log('');
  }

  console.log(`Wiki directory: ${wikiDir}`);
  console.log('  Use --generate to write index.md and log.md');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}
