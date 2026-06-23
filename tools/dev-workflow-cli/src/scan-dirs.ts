// Shared scan-directory and dashboard-config resolution for the list, search,
// and wiki-index commands. All three discover which project roots to scan the
// same way — an explicit --scan flag wins, else the dashboard's stored
// config.json `scanDirs`, else the current working directory — and read the
// same dashboard config file. Keep this the single source of that logic.

import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join, resolve } from 'path';

/** Expand a leading `~` / `~/` and resolve to an absolute path. */
export function expandHome(dir: string): string {
  if (dir === '~') return homedir();
  if (dir.startsWith('~/')) return resolve(homedir(), dir.slice(2));
  return resolve(dir);
}

function getDashboardConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(configHome, 'dev-dashboard', 'config.json');
}

/**
 * Scan dirs to use: an explicit --scan flag, else the dashboard's stored
 * `scanDirs`, else the current working directory.
 */
export async function resolveScanDirs(scanFlag: string | null): Promise<string[]> {
  if (scanFlag) return [expandHome(scanFlag)];

  const fromConfig = await readDashboardScanDirs();
  if (fromConfig.length > 0) return fromConfig;

  return [process.cwd()];
}

/** `scanDirs` from the dashboard's config.json, expanded and de-duped; `[]` if absent/invalid. */
async function readDashboardScanDirs(): Promise<string[]> {
  const configPath = getDashboardConfigPath();
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`Warning: dashboard config at ${configPath} is invalid JSON; falling back to cwd.`);
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

/** `wikiDir` from the dashboard's config.json, expanded; `null` if absent/invalid. */
export async function readDashboardWikiDir(): Promise<string | null> {
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

/** Match a project by exact name or by resolved path. */
export function matchesProject(p: { name: string; path: string }, filter: string): boolean {
  if (p.name === filter) return true;
  return p.path === expandHome(filter);
}
