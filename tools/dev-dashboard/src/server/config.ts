import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import { homedir } from 'os';
import chokidar from 'chokidar';
import type { DashboardConfig } from '../shared/types.js';

export function getConfigDir(): string {
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'dev-dashboard');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export const CONFIG_DIR = getConfigDir();
export const CONFIG_PATH = getConfigPath();
export const DEFAULT_CONFIG: DashboardConfig = {
  scanDirs: [],
  port: 3141,
  notifications: false,
  scanDirsConfigured: false,
};
export const DEFAULT_PORT = DEFAULT_CONFIG.port;

export interface CliOverrides {
  scan?: string[];
  port?: number;
}

export class ConfigReadError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_json' | 'unreadable',
  ) {
    super(message);
    this.name = 'ConfigReadError';
  }
}

export async function loadConfig(
  overrides: CliOverrides = {},
  configPath: string = getConfigPath(),
): Promise<DashboardConfig> {
  const storedConfig = await readStoredConfig(configPath);
  const scanDirs = normalizeScanDirs(overrides.scan ?? storedConfig.scanDirs).map(expandHome);

  const config: DashboardConfig = {
    scanDirs,
    port: overrides.port ?? storedConfig.port,
    notifications: storedConfig.notifications,
    scanDirsConfigured: overrides.scan ? scanDirs.length > 0 : storedConfig.scanDirsConfigured,
  };

  await validateScanDirs(config.scanDirs);
  return config;
}

export async function readStoredConfig(
  configPath: string = getConfigPath(),
): Promise<DashboardConfig> {
  let fileConfig: Partial<DashboardConfig> = {};

  try {
    const raw = await readFile(configPath, 'utf-8');
    try {
      fileConfig = JSON.parse(raw);
    } catch {
      throw new ConfigReadError(
        `Config file contains invalid JSON at ${configPath}`,
        'invalid_json',
      );
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      await createDefaultConfig(configPath);
      console.log(`Created config at ${configPath}`);
      return normalizeStoredConfig(fileConfig);
    }

    if (error instanceof ConfigReadError) {
      throw error;
    }

    throw new ConfigReadError(`Could not read config at ${configPath}`, 'unreadable');
  }

  return normalizeStoredConfig(fileConfig);
}

async function createDefaultConfig(configPath: string): Promise<void> {
  try {
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn(`Warning: could not write config to ${configPath}:`, err);
  }
}

export function expandHome(dir: string): string {
  if (dir.startsWith('~/')) {
    return resolve(homedir(), dir.slice(2));
  }
  if (dir === '~') {
    return homedir();
  }
  return resolve(dir);
}

async function validateScanDirs(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    try {
      await access(dir);
    } catch {
      console.warn(`Warning: scan directory does not exist: ${dir}`);
    }
  }
}

export async function updateConfig(
  patch: Partial<DashboardConfig>,
  configPath: string = getConfigPath(),
): Promise<DashboardConfig> {
  let existing: Partial<DashboardConfig> = {};
  try {
    const raw = await readFile(configPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // Start from defaults if file doesn't exist
  }

  const updated = normalizeStoredConfig({ ...DEFAULT_CONFIG, ...existing, ...patch });
  if (patch.scanDirs) {
    updated.scanDirsConfigured = updated.scanDirs.length > 0;
  }

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  return updated;
}

export interface ConfigWatcher {
  close: () => Promise<void>;
}

/**
 * Watch the config file for changes and invoke the callback when scanDirs change.
 * CLI overrides take precedence — if scanDirs were set via CLI, file changes are ignored.
 */
export function watchConfig(
  cliOverrides: CliOverrides,
  currentScanDirs: string[],
  onScanDirsChanged: (newDirs: string[]) => void,
  configPath: string = CONFIG_PATH,
): ConfigWatcher {
  let lastDirs = JSON.stringify(currentScanDirs);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar.watch(configPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on('change', async () => {
    if (cliOverrides.scan) return;

    // Debounce rapid writes
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const raw = await readFile(configPath, 'utf-8');
        const fileConfig: Partial<DashboardConfig> = JSON.parse(raw);
        const newDirs = (fileConfig.scanDirs ?? DEFAULT_CONFIG.scanDirs).map(expandHome);
        const serialized = JSON.stringify(newDirs);
        if (serialized !== lastDirs) {
          lastDirs = serialized;
          await validateScanDirs(newDirs);
          onScanDirsChanged(newDirs);
        }
      } catch {
        // Invalid JSON or read error — ignore until next change
      }
    }, 100);
  });

  return {
    close: () => watcher.close(),
  };
}

export function parseCliArgs(args: string[]): CliOverrides {
  const overrides: CliOverrides = {};
  let i = 0;

  while (i < args.length) {
    if (args[i] === '--scan') {
      overrides.scan = [];
      i++;
      // Collect all following non-flag arguments as scan dirs
      while (i < args.length && !args[i].startsWith('--')) {
        overrides.scan.push(args[i]);
        i++;
      }
    } else if (args[i] === '--port') {
      i++;
      if (i < args.length) {
        const port = parseInt(args[i], 10);
        if (!isNaN(port)) overrides.port = port;
        i++;
      }
    } else {
      i++;
    }
  }

  return overrides;
}

function normalizeStoredConfig(fileConfig: Partial<DashboardConfig>): DashboardConfig {
  const scanDirs = normalizeScanDirs(fileConfig.scanDirs);
  const scanDirsConfigured =
    typeof fileConfig.scanDirsConfigured === 'boolean'
      ? fileConfig.scanDirsConfigured
      : scanDirs.length > 0;

  return {
    scanDirs,
    port: fileConfig.port ?? DEFAULT_CONFIG.port,
    notifications: fileConfig.notifications ?? DEFAULT_CONFIG.notifications,
    scanDirsConfigured,
  };
}

function normalizeScanDirs(scanDirs: string[] | undefined): string[] {
  if (!Array.isArray(scanDirs)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const dir of scanDirs) {
    if (typeof dir !== 'string') continue;
    const trimmed = dir.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}
