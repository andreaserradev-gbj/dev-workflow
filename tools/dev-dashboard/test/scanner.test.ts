import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanProjects } from '../src/server/scanner.js';

let tempDir: string;

// Build a temporary project tree:
//   tempDir/
//     project-alpha/
//       .dev/
//         feature-one/   (has master plan)
//         feature-two/   (checkpoint only)
//     project-beta/
//       .dev/
//         feature-three/ (has master plan)
//     empty-project/
//       .dev/            (exists but empty)
//     node_modules/
//       some-pkg/
//         .dev/          (should be excluded)
//     deep-org/
//       team/
//         project-deep/
//           .dev/
//             feature-deep/ (at depth 4 — should be found with depth >= 4)

const MASTER_PLAN = `# test - Master Plan

**Status**: In Progress
**Created**: 2026-03-01
**Last Updated**: 2026-03-20

---

## Executive Summary

A test feature for scanner tests.

---

## Implementation Order

### Phase 1: Setup
**Goal**: Initial setup.

1. ✅ First step
2. ⬜ Second step

⏸️ **GATE**: Phase complete. Continue or \`/dev-checkpoint\`.
`;

const CHECKPOINT = `---
branch: feature/test
last_commit: Test commit
uncommitted_changes: false
checkpointed: 2026-03-20T10:00:00Z
---

<next_action>Do the next thing</next_action>
`;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'scanner-test-'));

  // project-alpha with 2 features
  await mkdir(join(tempDir, 'project-alpha/.dev/feature-one'), { recursive: true });
  await writeFile(join(tempDir, 'project-alpha/.dev/feature-one/00-master-plan.md'), MASTER_PLAN);
  await writeFile(join(tempDir, 'project-alpha/.dev/feature-one/checkpoint.md'), CHECKPOINT);

  await mkdir(join(tempDir, 'project-alpha/.dev/feature-two'), { recursive: true });
  await writeFile(join(tempDir, 'project-alpha/.dev/feature-two/checkpoint.md'), CHECKPOINT);

  // project-beta with 1 feature
  await mkdir(join(tempDir, 'project-beta/.dev/feature-three'), { recursive: true });
  await writeFile(join(tempDir, 'project-beta/.dev/feature-three/00-master-plan.md'), MASTER_PLAN);

  // empty-project with empty .dev/
  await mkdir(join(tempDir, 'empty-project/.dev'), { recursive: true });

  // node_modules should be excluded
  await mkdir(join(tempDir, 'node_modules/some-pkg/.dev/hidden-feature'), { recursive: true });
  await writeFile(join(tempDir, 'node_modules/some-pkg/.dev/hidden-feature/00-master-plan.md'), MASTER_PLAN);

  // .dev-archive should be excluded
  await mkdir(join(tempDir, 'project-alpha/.dev-archive/old-feature'), { recursive: true });
  await writeFile(join(tempDir, 'project-alpha/.dev-archive/old-feature/00-master-plan.md'), MASTER_PLAN);

  // deep nested project
  await mkdir(join(tempDir, 'deep-org/team/project-deep/.dev/feature-deep'), { recursive: true });
  await writeFile(join(tempDir, 'deep-org/team/project-deep/.dev/feature-deep/00-master-plan.md'), MASTER_PLAN);
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('scanProjects', () => {
  it('discovers projects and features from scan directory', async () => {
    const projects = await scanProjects([tempDir]);

    // Should find project-alpha, project-beta, and project-deep
    const names = projects.map((p) => p.name).sort();
    expect(names).toContain('project-alpha');
    expect(names).toContain('project-beta');
  });

  it('groups features under their parent project', async () => {
    const projects = await scanProjects([tempDir]);

    const alpha = projects.find((p) => p.name === 'project-alpha');
    expect(alpha).toBeDefined();
    // Includes active features from .dev/ and archived features from .dev-archive/
    expect(alpha!.features.map((f) => f.name).sort()).toEqual([
      'feature-one',
      'feature-two',
      'old-feature',
    ]);
  });

  it('parses feature data correctly', async () => {
    const projects = await scanProjects([tempDir]);

    const alpha = projects.find((p) => p.name === 'project-alpha');
    const featureOne = alpha!.features.find((f) => f.name === 'feature-one');
    expect(featureOne).toBeDefined();
    expect(featureOne!.progress).toMatchObject({ done: 1, total: 2 });
    expect(featureOne!.branch).toBe('feature/test');
  });

  it('handles checkpoint-only features', async () => {
    const projects = await scanProjects([tempDir]);

    const alpha = projects.find((p) => p.name === 'project-alpha');
    const featureTwo = alpha!.features.find((f) => f.name === 'feature-two');
    expect(featureTwo).toBeDefined();
    expect(featureTwo!.status).toBe('checkpoint-only');
    expect(featureTwo!.progress).toBeNull();
  });

  it('excludes node_modules directories', async () => {
    const projects = await scanProjects([tempDir]);

    const names = projects.map((p) => p.name);
    expect(names).not.toContain('some-pkg');
  });

  it('includes .dev-archive features with archived status', async () => {
    const projects = await scanProjects([tempDir]);

    const alpha = projects.find((p) => p.name === 'project-alpha');
    expect(alpha).toBeDefined();
    const oldFeature = alpha!.features.find((f) => f.name === 'old-feature');
    expect(oldFeature).toBeDefined();
    expect(oldFeature!.status).toBe('archived');
  });

  it('active feature takes precedence over archived with same name', async () => {
    // feature-one exists in both .dev and .dev-archive (we need to create the collision)
    const { mkdir: mkdirSync, writeFile: writeFileSync } = await import('fs/promises');
    await mkdirSync(join(tempDir, 'project-alpha/.dev-archive/feature-one'), { recursive: true });
    await writeFileSync(
      join(tempDir, 'project-alpha/.dev-archive/feature-one/00-master-plan.md'),
      MASTER_PLAN,
    );

    const projects = await scanProjects([tempDir]);
    const alpha = projects.find((p) => p.name === 'project-alpha');
    expect(alpha).toBeDefined();

    // Should only have one feature-one, and it should NOT be archived
    const featureOnes = alpha!.features.filter((f) => f.name === 'feature-one');
    expect(featureOnes).toHaveLength(1);
    expect(featureOnes[0].status).not.toBe('archived');
  });

  it('discovers project with only .dev-archive (no .dev)', async () => {
    const { mkdir: mkdirSync, writeFile: writeFileSync } = await import('fs/promises');
    await mkdirSync(join(tempDir, 'archive-only-project/.dev-archive/old-stuff'), {
      recursive: true,
    });
    await writeFileSync(
      join(tempDir, 'archive-only-project/.dev-archive/old-stuff/00-master-plan.md'),
      MASTER_PLAN,
    );

    const projects = await scanProjects([tempDir]);
    const archiveOnly = projects.find((p) => p.name === 'archive-only-project');
    expect(archiveOnly).toBeDefined();
    expect(archiveOnly!.features).toHaveLength(1);
    expect(archiveOnly!.features[0].status).toBe('archived');
  });

  it('skips projects with empty .dev/ (no feature subdirectories)', async () => {
    const projects = await scanProjects([tempDir]);

    const names = projects.map((p) => p.name);
    expect(names).not.toContain('empty-project');
  });

  it('finds deeply nested projects with sufficient depth', async () => {
    const projects = await scanProjects([tempDir], { maxDepth: 5 });

    const deep = projects.find((p) => p.name === 'project-deep');
    expect(deep).toBeDefined();
    expect(deep!.features).toHaveLength(1);
    expect(deep!.features[0].name).toBe('feature-deep');
  });

  it('respects depth limit', async () => {
    // depth 2 should find project-alpha/.dev and project-beta/.dev but not deep-org/team/project-deep/.dev
    const projects = await scanProjects([tempDir], { maxDepth: 2 });

    const names = projects.map((p) => p.name);
    expect(names).toContain('project-alpha');
    expect(names).not.toContain('project-deep');
  });

  it('merges results from multiple scan directories', async () => {
    const dirA = join(tempDir, 'project-alpha');
    const dirB = join(tempDir, 'project-beta');

    // Scan the project dirs directly — .dev/ is at depth 1
    const projects = await scanProjects([dirA, dirB], { maxDepth: 1 });

    const names = projects.map((p) => p.name);
    expect(names).toContain('project-alpha');
    expect(names).toContain('project-beta');
  });

  it('returns empty array for non-existent scan directory', async () => {
    const projects = await scanProjects(['/tmp/does-not-exist-scanner-test']);
    expect(projects).toEqual([]);
  });
});
