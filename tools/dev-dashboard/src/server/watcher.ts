import chokidar from 'chokidar';
import fg from 'fast-glob';
import { dirname, sep } from 'path';

export interface WatcherCallbacks {
  onFeatureUpdated: (projectPath: string, featureName: string, archived: boolean) => void;
  onFeatureAdded: (projectPath: string, featureName: string, archived: boolean) => void;
  onFeatureRemoved: (projectPath: string, featureName: string) => void;
}

export interface WatcherOptions {
  debounceMs?: number;
  rescanIntervalMs?: number;
}

export interface Watcher {
  close: () => Promise<void>;
}

interface ParsedPath {
  projectPath: string;
  featureName: string;
  archived: boolean;
}

const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_RESCAN_INTERVAL_MS = 30_000;

/**
 * Parse a file path to extract the project path and feature name.
 * Expects paths like: .../project/.dev/feature-name/file.md
 *                  or: .../project/.dev-archive/feature-name/file.md
 * Returns null if the path doesn't match this pattern.
 */
function parsePath(filePath: string): ParsedPath | null {
  const parts = filePath.split(sep);

  // Try .dev-archive first (contains ".dev" as substring, so check it first)
  let devIdx = parts.lastIndexOf('.dev-archive');
  let archived = false;
  if (devIdx !== -1) {
    archived = true;
  } else {
    devIdx = parts.lastIndexOf('.dev');
  }

  // Need at least 2 segments after the dir: feature-dir/file.md
  // This rejects files sitting directly in .dev/ (e.g. status reports)
  if (devIdx === -1 || devIdx + 2 >= parts.length) return null;

  const projectPath = parts.slice(0, devIdx).join(sep);
  const featureName = parts[devIdx + 1];

  if (!projectPath || !featureName) return null;
  return { projectPath, featureName, archived };
}

/**
 * Find all .dev and .dev-archive directories within scan dirs (matching scanner's depth logic).
 */
async function findDevDirs(scanDirs: string[], maxDepth = 3): Promise<string[]> {
  const allDevDirs: string[] = [];
  for (const scanDir of scanDirs) {
    const patterns: string[] = [];
    for (let d = 0; d < maxDepth; d++) {
      const prefix = d === 0 ? '' : new Array(d).fill('*').join('/') + '/';
      patterns.push(prefix + '.dev');
      patterns.push(prefix + '.dev-archive');
    }
    try {
      const dirs = await fg(patterns, {
        cwd: scanDir,
        onlyDirectories: true,
        absolute: true,
        dot: true,
        ignore: ['**/node_modules/**'],
      });
      allDevDirs.push(...dirs);
    } catch {
      // scanDir doesn't exist or isn't accessible
    }
  }
  return allDevDirs;
}

export async function createWatcher(
  scanDirs: string[],
  callbacks: WatcherCallbacks,
  options: WatcherOptions = {},
): Promise<Watcher> {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const rescanIntervalMs = options.rescanIntervalMs ?? DEFAULT_RESCAN_INTERVAL_MS;

  // Track known features to distinguish add vs update
  const knownFeatures = new Set<string>();

  // Debounce timers per feature key
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  // Pending event type per feature key (for debounce)
  const pendingEvents = new Map<string, 'updated' | 'added'>();

  function featureKey(projectPath: string, featureName: string, archived = false): string {
    const subdir = archived ? '.dev-archive' : '.dev';
    return `${projectPath}${sep}${subdir}${sep}${featureName}`;
  }

  function scheduleEvent(
    projectPath: string,
    featureName: string,
    eventType: 'updated' | 'added',
    archived: boolean,
  ): void {
    const key = featureKey(projectPath, featureName, archived);

    // If there's already a pending event, prefer 'added' over 'updated'
    const existing = pendingEvents.get(key);
    if (!existing || eventType === 'added') {
      pendingEvents.set(key, eventType);
    }

    // Reset the debounce timer
    const existingTimer = timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        const type = pendingEvents.get(key) ?? 'updated';
        pendingEvents.delete(key);

        if (type === 'added') {
          callbacks.onFeatureAdded(projectPath, featureName, archived);
        } else {
          callbacks.onFeatureUpdated(projectPath, featureName, archived);
        }
      }, debounceMs),
    );
  }

  // Watch only .dev directories — not the entire scan tree.
  // This prevents EMFILE errors when scanDirs contain large trees like ~/code.
  const devDirs = await findDevDirs(scanDirs);
  const watchedDevDirs = new Set(devDirs);

  const watcher = chokidar.watch(devDirs.length > 0 ? devDirs : [], {
    ignoreInitial: true,
  });

  // Periodically rescan for new/removed .dev directories
  const rescanTimer = setInterval(async () => {
    try {
      const currentDevDirs = await findDevDirs(scanDirs);
      const currentSet = new Set(currentDevDirs);

      // Add newly discovered .dev directories
      for (const dir of currentDevDirs) {
        if (!watchedDevDirs.has(dir)) {
          watchedDevDirs.add(dir);
          watcher.add(dir);
        }
      }

      // Remove stale .dev directories that no longer exist
      for (const dir of watchedDevDirs) {
        if (!currentSet.has(dir)) {
          watchedDevDirs.delete(dir);
          watcher.unwatch(dir);

          // Extract projectPath from .dev dir (dir is /path/to/project/.dev)
          const projectPath = dirname(dir);

          // Find and remove all features belonging to this project
          for (const key of knownFeatures) {
            const parsed = parsePath(key);
            if (parsed && parsed.projectPath === projectPath) {
              knownFeatures.delete(key);
              // Clear any pending debounce
              const existingTimer = timers.get(key);
              if (existingTimer) {
                clearTimeout(existingTimer);
                timers.delete(key);
                pendingEvents.delete(key);
              }
              callbacks.onFeatureRemoved(parsed.projectPath, parsed.featureName);
            }
          }
        }
      }
    } catch {
      // Ignore rescan errors
    }
  }, rescanIntervalMs);

  function isDevMd(filePath: string): boolean {
    const hasDevDir =
      filePath.includes(`${sep}.dev${sep}`) || filePath.includes(`${sep}.dev-archive${sep}`);
    if (!hasDevDir || !filePath.endsWith('.md')) return false;
    if (filePath.includes(`${sep}node_modules${sep}`)) return false;
    return true;
  }

  watcher.on('add', (filePath: string) => {
    if (!isDevMd(filePath)) return;
    const parsed = parsePath(filePath);
    if (!parsed) return;

    const key = featureKey(parsed.projectPath, parsed.featureName, parsed.archived);
    if (knownFeatures.has(key)) {
      scheduleEvent(parsed.projectPath, parsed.featureName, 'updated', parsed.archived);
    } else {
      knownFeatures.add(key);
      scheduleEvent(parsed.projectPath, parsed.featureName, 'added', parsed.archived);
    }
  });

  watcher.on('change', (filePath: string) => {
    if (!isDevMd(filePath)) return;
    const parsed = parsePath(filePath);
    if (!parsed) return;

    const key = featureKey(parsed.projectPath, parsed.featureName, parsed.archived);
    knownFeatures.add(key);
    scheduleEvent(parsed.projectPath, parsed.featureName, 'updated', parsed.archived);
  });

  watcher.on('unlink', (filePath: string) => {
    if (!isDevMd(filePath)) return;
    const parsed = parsePath(filePath);
    if (!parsed) return;

    // Clear any pending debounce for this feature
    const key = featureKey(parsed.projectPath, parsed.featureName, parsed.archived);
    const existingTimer = timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timers.delete(key);
      pendingEvents.delete(key);
    }

    knownFeatures.delete(key);
    callbacks.onFeatureRemoved(parsed.projectPath, parsed.featureName);
  });

  // Wait for the watcher to be ready (skip if nothing to watch)
  if (devDirs.length > 0) {
    await new Promise<void>((resolve) => {
      watcher.on('ready', resolve);
    });
  }

  // Populate knownFeatures from initially watched files
  const watched = watcher.getWatched();
  for (const dir of Object.keys(watched)) {
    for (const file of watched[dir]) {
      const fullPath = `${dir}${sep}${file}`;
      const parsed = parsePath(fullPath);
      if (parsed) {
        knownFeatures.add(featureKey(parsed.projectPath, parsed.featureName));
      }
    }
  }

  return {
    close: async () => {
      clearInterval(rescanTimer);
      // Clear all pending timers
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      pendingEvents.clear();
      await watcher.close();
    },
  };
}
