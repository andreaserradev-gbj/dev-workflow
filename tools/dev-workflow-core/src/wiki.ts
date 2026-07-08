import { mkdir, writeFile, readdir, lstat, readlink, symlink, unlink } from 'fs/promises';
import { join, resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import type { Project } from './types.js';
import { scanProjects } from './scanner.js';
import {
  buildIndexPage,
  buildLogPage,
  buildReadmePage,
  buildObsidianAppConfig,
} from './wiki-templates.js';

export interface WikiOptions {
  includeReadme?: boolean;
  initObsidian?: boolean;
}

export async function generateWiki(
  projects: Project[],
  outputDir: string,
  options?: WikiOptions,
): Promise<void> {
  const projectsDir = join(outputDir, 'projects');
  await mkdir(projectsDir, { recursive: true });

  // ── Non-destructive union (Mechanism A) ──────────────────────────
  // Never drop a project that still exists on disk just because this run didn't
  // scan it. Discover the roots already represented by existing `projects/`
  // symlinks, re-scan only the ones this run didn't cover, and union them with
  // the passed-in `projects` (this run wins by name). A project is pruned only
  // when its directory is genuinely gone (its symlink target no longer exists).
  // The full-set caller (dashboard) covers every root, so the re-scan is empty
  // and this is a true no-op there.
  const currentPaths = new Set(projects.map((p) => resolve(p.path)));
  const knownRoots = await discoverExistingRoots(projectsDir);
  const rootsToRescan = [...knownRoots].filter((root) => !currentPaths.has(root));
  const rescanned = rootsToRescan.length > 0 ? await scanProjects(rootsToRescan) : [];

  const unionByName = new Map<string, Project>();
  for (const project of rescanned) unionByName.set(project.name, project);
  for (const project of projects) unionByName.set(project.name, project);
  const allProjects = Array.from(unionByName.values());

  // Manage symlinks
  const expectedLinks = new Set<string>();
  for (const project of allProjects) {
    const devTarget = join(project.path, '.dev');
    const linkName = project.name;
    expectedLinks.add(linkName);
    await ensureSymlink(projectsDir, linkName, devTarget);

    const archiveTarget = join(project.path, '.dev-archive');
    if (existsSync(archiveTarget)) {
      const archiveLinkName = `${project.name}--archive`;
      expectedLinks.add(archiveLinkName);
      await ensureSymlink(projectsDir, archiveLinkName, archiveTarget);
    }
  }

  await removeStaleSymlinks(projectsDir, expectedLinks);

  // Generate pages
  const generated = new Date().toISOString();
  await writeFile(join(outputDir, 'index.md'), buildIndexPage(allProjects, generated));
  await writeFile(join(outputDir, 'log.md'), buildLogPage(allProjects, generated));

  if (options?.includeReadme) {
    await writeFile(join(outputDir, 'README.md'), buildReadmePage());
  }

  if (options?.initObsidian) {
    const obsidianDir = join(outputDir, '.obsidian');
    if (!existsSync(obsidianDir)) {
      await mkdir(obsidianDir, { recursive: true });
      await writeFile(join(obsidianDir, 'app.json'), buildObsidianAppConfig());
    }
  }
}

/**
 * Roots already represented in the wiki by an existing `projects/` symlink whose
 * target still exists on disk. Returns absolute project-root paths (the directory
 * containing `.dev` / `.dev-archive`), deduped.
 *
 * A dangling symlink (target gone) is intentionally omitted: that is the genuine
 * stale case, left for `removeStaleSymlinks` to prune. Non-symlink entries and
 * targets that are not `.dev` / `.dev-archive` are ignored.
 */
async function discoverExistingRoots(projectsDir: string): Promise<Set<string>> {
  const roots = new Set<string>();
  let entries: string[];
  try {
    entries = await readdir(projectsDir);
  } catch {
    return roots; // missing/empty projects dir — nothing represented yet
  }

  for (const entry of entries) {
    const linkPath = join(projectsDir, entry);
    let target: string;
    try {
      const stats = await lstat(linkPath);
      if (!stats.isSymbolicLink()) continue;
      target = resolve(projectsDir, await readlink(linkPath));
    } catch {
      continue; // unreadable entry — skip
    }
    if (!existsSync(target)) continue; // dangling — genuine stale, prune later
    const base = basename(target);
    if (base === '.dev' || base === '.dev-archive') {
      roots.add(dirname(target));
    }
  }

  return roots;
}

async function ensureSymlink(parentDir: string, linkName: string, target: string): Promise<void> {
  const linkPath = join(parentDir, linkName);
  const absTarget = resolve(target);

  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink()) {
      const currentTarget = await readlink(linkPath);
      if (resolve(parentDir, currentTarget) === absTarget) return;
      await unlink(linkPath);
    } else {
      // Not a symlink — don't touch it
      return;
    }
  } catch {
    // Doesn't exist — proceed to create
  }

  await symlink(absTarget, linkPath);
}

async function removeStaleSymlinks(projectsDir: string, expectedLinks: Set<string>): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(projectsDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (expectedLinks.has(entry)) continue;
    const entryPath = join(projectsDir, entry);
    try {
      const stats = await lstat(entryPath);
      if (stats.isSymbolicLink()) {
        await unlink(entryPath);
      }
    } catch {
      // Skip entries we can't stat
    }
  }
}
