import { mkdir, writeFile, readdir, lstat, readlink, symlink, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import type { Project } from './types.js';
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

  // Manage symlinks
  const expectedLinks = new Set<string>();
  for (const project of projects) {
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
  await writeFile(join(outputDir, 'index.md'), buildIndexPage(projects, generated));
  await writeFile(join(outputDir, 'log.md'), buildLogPage(projects, generated));

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
