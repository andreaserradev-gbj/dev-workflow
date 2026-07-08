// Shared scan-directory and dashboard-config resolution. The CLI's list, search,
// and wiki-index commands and the dev-dashboard-tui all discover which project
// roots to scan the same way — an explicit --scan flag wins, else the dashboard's
// stored config.json `scanDirs`, else the current working directory — and read the
// same dashboard config file. Keep this the single source of that logic.
//
// Node-only (fs/os/path), but deliberately chokidar-free so it can live on the
// main barrel: the CLI consumes it and must never resolve the `./live` runtime.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';

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

/**
 * Register a project root into the dashboard config's `scanDirs` so a later scan
 * resolves the full configured set regardless of where the command was invoked.
 *
 * Mirrors `readDashboardScanDirs` on the read side and `config.ts` on the write
 * side: a missing config is treated as empty (created below); a hand-edited but
 * invalid-JSON config is left untouched (warn + return, never clobbered); every
 * other key is preserved; and it is idempotent via `expandHome` so `~/x` and its
 * absolute form count as the same root. Deliberately chokidar-free — the CLI
 * calls this and must never resolve `config.ts` / `dev-workflow-core/live`.
 */
export async function ensureScanDir(root: string): Promise<void> {
  const expanded = expandHome(root);
  const configPath = getDashboardConfigPath();

  let parsed: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, 'utf-8');
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === 'object') parsed = json as Record<string, unknown>;
    } catch {
      console.warn(
        `Warning: dashboard config at ${configPath} is invalid JSON; not registering scan dir.`,
      );
      return;
    }
  } catch {
    // No config yet — start from an empty object and create the file below.
  }

  const existing = Array.isArray(parsed.scanDirs)
    ? (parsed.scanDirs as unknown[]).filter((d): d is string => typeof d === 'string')
    : [];

  // Idempotent: skip when this root is already registered (~ vs absolute equal).
  if (existing.some((d) => expandHome(d.trim()) === expanded)) return;

  const updated = {
    ...parsed,
    scanDirs: [...existing, expanded],
    scanDirsConfigured: true,
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
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
