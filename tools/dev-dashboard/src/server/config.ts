import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { resolve, join } from 'path';
import { homedir } from 'os';
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

function expandHome(dir: string): string {
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
