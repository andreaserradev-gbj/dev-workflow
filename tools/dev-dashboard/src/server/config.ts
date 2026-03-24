import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { resolve, join } from 'path';
import { homedir } from 'os';
import chokidar from 'chokidar';
import type { DashboardConfig } from '../shared/types.js';

const CONFIG_DIR = join(homedir(), '.config', 'dev-dashboard');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: DashboardConfig = {
  scanDirs: ['~/code'],
  port: 3141,
  notifications: false,
};

export interface CliOverrides {
  scan?: string[];
  port?: number;
}

export async function loadConfig(overrides: CliOverrides = {}): Promise<DashboardConfig> {
  let fileConfig: Partial<DashboardConfig> = {};

  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch {
    // File doesn't exist or is invalid — create with defaults
    await createDefaultConfig();
    console.log(`Created config at ${CONFIG_PATH}`);
  }

  const config: DashboardConfig = {
    scanDirs: overrides.scan ?? fileConfig.scanDirs ?? DEFAULTS.scanDirs,
    port: overrides.port ?? fileConfig.port ?? DEFAULTS.port,
    notifications: fileConfig.notifications ?? DEFAULTS.notifications,
  };

  // Expand ~ and validate
  config.scanDirs = config.scanDirs.map(expandHome);
  await validateScanDirs(config.scanDirs);

  return config;
}

async function createDefaultConfig(): Promise<void> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn(`Warning: could not write config to ${CONFIG_PATH}:`, err);
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

export async function updateConfig(patch: Partial<DashboardConfig>): Promise<DashboardConfig> {
  let existing: Partial<DashboardConfig> = {};
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // Start from defaults if file doesn't exist
  }

  const updated = { ...DEFAULTS, ...existing, ...patch };
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
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
  configPath: string = CONFIG_PATH
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
        const newDirs = (fileConfig.scanDirs ?? DEFAULTS.scanDirs).map(expandHome);
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
