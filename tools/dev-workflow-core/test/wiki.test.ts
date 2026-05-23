import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile, lstat, readlink, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { generateWiki } from '../src/wiki.js';
import { buildIndexPage, buildLogPage, buildReadmePage, buildObsidianAppConfig } from '../src/wiki-templates.js';
import type { Project, Feature } from '../src/types.js';

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'wiki-test-'));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeFeature(overrides: Partial<Feature> & { name: string }): Feature {
  return {
    status: 'active',
    progress: { done: 1, total: 2, percent: 50 },
    currentPhase: null,
    lastCheckpoint: '2026-05-20T10:00:00Z',
    created: '2026-05-01',
    lastUpdated: '2026-05-20',
    nextAction: null,
    branch: null,
    summary: 'A test feature',
    ...overrides,
  };
}

function makeProject(name: string, features: Feature[], path?: string): Project {
  return { name, path: path ?? join(tempDir, name), features };
}

// ─── Template Tests ──────────────────────────────────────────────

describe('buildIndexPage', () => {
  it('renders empty state with valid YAML frontmatter', () => {
    const result = buildIndexPage([], '2026-05-20T00:00:00Z');
    expect(result).toContain('---');
    expect(result).toContain('projects: 0');
    expect(result).toContain('features: 0');
    expect(result).toContain('# Dev Wiki Index');
    expect(result).toContain('*No projects found.*');
  });

  it('renders a single project with features', () => {
    const projects: Project[] = [
      makeProject('my-app', [
        makeFeature({ name: 'auth', status: 'active', progress: { done: 3, total: 5, percent: 60 }, summary: 'Add authentication' }),
        makeFeature({ name: 'search', status: 'complete', progress: { done: 4, total: 4, percent: 100 }, summary: 'Full-text search' }),
      ]),
    ];
    const result = buildIndexPage(projects, '2026-05-20T00:00:00Z');
    expect(result).toContain('projects: 1');
    expect(result).toContain('features: 2');
    expect(result).toContain('## my-app (2 features)');
    expect(result).toContain('[auth](projects/my-app/auth/00-master-plan.md)');
    expect(result).toContain('3/5 (60%)');
    expect(result).toContain('Add authentication');
  });

  it('sorts features by STATUS_ORDER then by lastCheckpoint desc', () => {
    const projects: Project[] = [
      makeProject('proj', [
        makeFeature({ name: 'complete-feat', status: 'complete', lastCheckpoint: '2026-05-20T00:00:00Z' }),
        makeFeature({ name: 'active-old', status: 'active', lastCheckpoint: '2026-05-10T00:00:00Z' }),
        makeFeature({ name: 'active-new', status: 'active', lastCheckpoint: '2026-05-19T00:00:00Z' }),
        makeFeature({ name: 'gate-feat', status: 'gate', lastCheckpoint: '2026-05-15T00:00:00Z' }),
      ]),
    ];
    const result = buildIndexPage(projects, '2026-05-20T00:00:00Z');
    const rows = result.split('\n').filter((l) => l.startsWith('| ['));
    expect(rows[0]).toContain('gate-feat');
    expect(rows[1]).toContain('active-new');
    expect(rows[2]).toContain('active-old');
    expect(rows[3]).toContain('complete-feat');
  });

  it('renders archived features with --archive links', () => {
    const projects: Project[] = [
      makeProject('proj', [
        makeFeature({ name: 'old-feat', status: 'archived', summary: 'Legacy feature' }),
      ]),
    ];
    const result = buildIndexPage(projects, '2026-05-20T00:00:00Z');
    expect(result).toContain('### Archived (1)');
    expect(result).toContain('projects/proj--archive/old-feat/00-master-plan.md');
  });

  it('renders multiple projects sorted alphabetically', () => {
    const projects: Project[] = [
      makeProject('zebra', [makeFeature({ name: 'f1' })]),
      makeProject('alpha', [makeFeature({ name: 'f2' })]),
    ];
    const result = buildIndexPage(projects, '2026-05-20T00:00:00Z');
    const alphaIdx = result.indexOf('## alpha');
    const zebraIdx = result.indexOf('## zebra');
    expect(alphaIdx).toBeLessThan(zebraIdx);
  });

  it('truncates long summaries', () => {
    const longSummary = 'A'.repeat(200);
    const projects: Project[] = [
      makeProject('proj', [makeFeature({ name: 'f', summary: longSummary })]),
    ];
    const result = buildIndexPage(projects, '2026-05-20T00:00:00Z');
    expect(result).not.toContain(longSummary);
    expect(result).toContain('…');
  });
});

describe('buildLogPage', () => {
  it('renders empty state with valid YAML frontmatter', () => {
    const result = buildLogPage([], '2026-05-20T00:00:00Z');
    expect(result).toContain('entries: 0');
    expect(result).toContain('# Dev Wiki Log');
    expect(result).toContain('*No features found.*');
  });

  it('sorts entries by lastCheckpoint desc', () => {
    const projects: Project[] = [
      makeProject('proj', [
        makeFeature({ name: 'old', lastCheckpoint: '2026-05-10T00:00:00Z' }),
        makeFeature({ name: 'new', lastCheckpoint: '2026-05-20T00:00:00Z' }),
      ]),
    ];
    const result = buildLogPage(projects, '2026-05-20T00:00:00Z');
    const headings = result.split('\n').filter((l) => l.startsWith('## ['));
    expect(headings[0]).toContain('new');
    expect(headings[1]).toContain('old');
  });

  it('formats dates as YYYY-MM-DD', () => {
    const projects: Project[] = [
      makeProject('proj', [
        makeFeature({ name: 'f', lastCheckpoint: '2026-05-20T14:30:00Z' }),
      ]),
    ];
    const result = buildLogPage(projects, '2026-05-20T00:00:00Z');
    expect(result).toContain('## [2026-05-20]');
  });

  it('falls back to lastUpdated when lastCheckpoint is null', () => {
    const projects: Project[] = [
      makeProject('proj', [
        makeFeature({ name: 'f', lastCheckpoint: null, lastUpdated: '2026-04-15' }),
      ]),
    ];
    const result = buildLogPage(projects, '2026-05-20T00:00:00Z');
    expect(result).toContain('## [2026-04-15]');
  });

  it('shows "unknown" when both dates are null', () => {
    const projects: Project[] = [
      makeProject('proj', [
        makeFeature({ name: 'f', lastCheckpoint: null, lastUpdated: null }),
      ]),
    ];
    const result = buildLogPage(projects, '2026-05-20T00:00:00Z');
    expect(result).toContain('## [unknown]');
  });
});

describe('buildReadmePage', () => {
  it('contains Obsidian setup instructions', () => {
    const result = buildReadmePage();
    expect(result).toContain('Obsidian');
    expect(result).toContain('Open Vault');
    expect(result).toContain('Dataview');
    expect(result).toContain('auto-generated');
  });
});

describe('buildObsidianAppConfig', () => {
  it('returns valid JSON with expected keys', () => {
    const result = buildObsidianAppConfig();
    const parsed = JSON.parse(result);
    expect(parsed.alwaysUpdateLinks).toBe(true);
    expect(parsed.newLinkFormat).toBe('relative');
  });
});

// ─── Generator Tests ─────────────────────────────────────────────

describe('generateWiki', () => {
  it('creates index.md and log.md for empty projects', async () => {
    const outDir = join(tempDir, 'wiki-empty');
    await generateWiki([], outDir);

    const index = await readFile(join(outDir, 'index.md'), 'utf-8');
    const log = await readFile(join(outDir, 'log.md'), 'utf-8');
    expect(index).toContain('# Dev Wiki Index');
    expect(index).toContain('projects: 0');
    expect(log).toContain('# Dev Wiki Log');
    expect(log).toContain('entries: 0');
  });

  it('creates symlinks to project .dev/ directories', async () => {
    const projectDir = join(tempDir, 'symlink-test-project');
    await mkdir(join(projectDir, '.dev'), { recursive: true });

    const outDir = join(tempDir, 'wiki-symlinks');
    const projects: Project[] = [makeProject('symlink-test-project', [], projectDir)];
    await generateWiki(projects, outDir);

    const linkPath = join(outDir, 'projects', 'symlink-test-project');
    const stats = await lstat(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);
    const target = await readlink(linkPath);
    expect(resolve(join(outDir, 'projects'), target)).toBe(join(projectDir, '.dev'));
  });

  it('creates archive symlinks when .dev-archive/ exists', async () => {
    const projectDir = join(tempDir, 'archive-test-project');
    await mkdir(join(projectDir, '.dev'), { recursive: true });
    await mkdir(join(projectDir, '.dev-archive'), { recursive: true });

    const outDir = join(tempDir, 'wiki-archive');
    const projects: Project[] = [makeProject('archive-test-project', [], projectDir)];
    await generateWiki(projects, outDir);

    const archiveLink = join(outDir, 'projects', 'archive-test-project--archive');
    const stats = await lstat(archiveLink);
    expect(stats.isSymbolicLink()).toBe(true);
  });

  it('removes stale symlinks', async () => {
    const projectA = join(tempDir, 'stale-project-a');
    const projectB = join(tempDir, 'stale-project-b');
    await mkdir(join(projectA, '.dev'), { recursive: true });
    await mkdir(join(projectB, '.dev'), { recursive: true });

    const outDir = join(tempDir, 'wiki-stale');

    // First run: both projects
    await generateWiki(
      [makeProject('stale-project-a', [], projectA), makeProject('stale-project-b', [], projectB)],
      outDir,
    );
    expect(existsSync(join(outDir, 'projects', 'stale-project-a'))).toBe(true);
    expect(existsSync(join(outDir, 'projects', 'stale-project-b'))).toBe(true);

    // Second run: only project A
    await generateWiki([makeProject('stale-project-a', [], projectA)], outDir);
    expect(existsSync(join(outDir, 'projects', 'stale-project-a'))).toBe(true);

    // stale-project-b symlink should be removed
    const entries = await readdir(join(outDir, 'projects'));
    expect(entries).not.toContain('stale-project-b');
  });

  it('is idempotent — same input produces same output', async () => {
    const projectDir = join(tempDir, 'idempotent-project');
    await mkdir(join(projectDir, '.dev'), { recursive: true });

    const outDir = join(tempDir, 'wiki-idempotent');
    const projects: Project[] = [
      makeProject('idempotent-project', [makeFeature({ name: 'feat' })], projectDir),
    ];

    await generateWiki(projects, outDir);
    const index1 = await readFile(join(outDir, 'index.md'), 'utf-8');

    // Wait a tick so the generated timestamp differs, then check structure is stable
    await generateWiki(projects, outDir);
    const index2 = await readFile(join(outDir, 'index.md'), 'utf-8');

    // Content structure should match (aside from generated timestamp)
    const stripTimestamp = (s: string) => s.replace(/generated: "[^"]*"/, 'generated: "X"');
    expect(stripTimestamp(index1)).toBe(stripTimestamp(index2));
  });

  it('generates README.md with includeReadme option', async () => {
    const outDir = join(tempDir, 'wiki-readme');
    await generateWiki([], outDir, { includeReadme: true });
    const readme = await readFile(join(outDir, 'README.md'), 'utf-8');
    expect(readme).toContain('Obsidian');
  });

  it('does not generate README.md without includeReadme option', async () => {
    const outDir = join(tempDir, 'wiki-no-readme');
    await generateWiki([], outDir);
    expect(existsSync(join(outDir, 'README.md'))).toBe(false);
  });

  it('creates .obsidian/ stub with initObsidian option', async () => {
    const outDir = join(tempDir, 'wiki-obsidian');
    await generateWiki([], outDir, { initObsidian: true });
    const appJson = await readFile(join(outDir, '.obsidian', 'app.json'), 'utf-8');
    const parsed = JSON.parse(appJson);
    expect(parsed.alwaysUpdateLinks).toBe(true);
  });

  it('does not overwrite existing .obsidian/ directory', async () => {
    const outDir = join(tempDir, 'wiki-obsidian-existing');
    const obsidianDir = join(outDir, '.obsidian');
    await mkdir(obsidianDir, { recursive: true });
    await writeFile(join(obsidianDir, 'app.json'), '{"custom": true}');

    await generateWiki([], outDir, { initObsidian: true });
    const appJson = await readFile(join(obsidianDir, 'app.json'), 'utf-8');
    expect(JSON.parse(appJson).custom).toBe(true);
  });

  it('updates symlink when target changes', async () => {
    const projectDirOld = join(tempDir, 'retarget-old');
    const projectDirNew = join(tempDir, 'retarget-new');
    await mkdir(join(projectDirOld, '.dev'), { recursive: true });
    await mkdir(join(projectDirNew, '.dev'), { recursive: true });

    const outDir = join(tempDir, 'wiki-retarget');

    await generateWiki([makeProject('retarget', [], projectDirOld)], outDir);
    const target1 = await readlink(join(outDir, 'projects', 'retarget'));

    await generateWiki([makeProject('retarget', [], projectDirNew)], outDir);
    const target2 = await readlink(join(outDir, 'projects', 'retarget'));

    expect(resolve(join(outDir, 'projects'), target1)).toContain('retarget-old');
    expect(resolve(join(outDir, 'projects'), target2)).toContain('retarget-new');
  });
});
