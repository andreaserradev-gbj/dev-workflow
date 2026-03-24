import fg from 'fast-glob';
import { readdir } from 'fs/promises';
import { basename, dirname, resolve } from 'path';
import { parseFeature } from './parser.js';
import type { Project } from '../shared/types.js';

export interface ScanOptions {
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 3;

export async function scanProjects(
  scanDirs: string[],
  options: ScanOptions = {}
): Promise<Project[]> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const projectMap = new Map<string, Project>();

  for (const scanDir of scanDirs) {
    // Build glob pattern to find .dev directories
    // We need to find directories named ".dev" at various depths
    const patterns = buildGlobPatterns(maxDepth);

    let devDirs: string[];
    try {
      devDirs = await fg(patterns, {
        cwd: scanDir,
        onlyDirectories: true,
        absolute: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/.dev-archive/**'],
      });
    } catch {
      // scanDir doesn't exist or isn't accessible
      continue;
    }

    for (const devDir of devDirs) {
      // devDir is an absolute path to a .dev/ directory
      const projectDir = dirname(devDir);
      const projectName = basename(projectDir);

      // Read feature subdirectories inside .dev/
      let featureDirs: string[];
      try {
        const entries = await readdir(devDir, { withFileTypes: true });
        featureDirs = entries
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
      } catch {
        continue;
      }

      if (featureDirs.length === 0) continue;

      // Parse each feature
      const existing = projectMap.get(projectDir);
      const project: Project = existing ?? {
        name: projectName,
        path: projectDir,
        features: [],
      };

      for (const featureName of featureDirs) {
        const featurePath = resolve(devDir, featureName);
        const feature = await parseFeature(featurePath, featureName);
        project.features.push(feature);
      }

      projectMap.set(projectDir, project);
    }
  }

  return Array.from(projectMap.values());
}

function buildGlobPatterns(maxDepth: number): string[] {
  const patterns: string[] = [];
  // .dev at depth 1 (direct child), depth 2, etc.
  // depth 1: .dev
  // depth 2: */.dev
  // depth 3: */*/.dev
  for (let d = 0; d < maxDepth; d++) {
    const prefix = d === 0 ? '' : new Array(d).fill('*').join('/') + '/';
    patterns.push(prefix + '.dev');
  }
  return patterns;
}
