import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createWatcher, type Watcher, type WatcherCallbacks } from '../src/server/watcher.js';

const MASTER_PLAN = `# test - Master Plan

**Status**: In Progress
**Created**: 2026-03-01
**Last Updated**: 2026-03-20

---

## Executive Summary

A test feature for watcher tests.

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
last_commit: abc123
uncommitted_changes: false
checkpointed: 2026-03-20T10:00:00Z
---

<next_action>Do the next thing</next_action>
`;

let tempDir: string;
let watcher: Watcher | null;
let callbacks: WatcherCallbacks;
let featureUpdated: Array<{ projectPath: string; featureName: string }>;
let featureAdded: Array<{ projectPath: string; featureName: string }>;
let featureRemoved: Array<{ projectPath: string; featureName: string }>;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'watcher-test-'));
  featureUpdated = [];
  featureAdded = [];
  featureRemoved = [];

  callbacks = {
    onFeatureUpdated: (projectPath, featureName) => {
      featureUpdated.push({ projectPath, featureName });
    },
    onFeatureAdded: (projectPath, featureName) => {
      featureAdded.push({ projectPath, featureName });
    },
    onFeatureRemoved: (projectPath, featureName) => {
      featureRemoved.push({ projectPath, featureName });
    },
  };

  watcher = null;
});

afterEach(async () => {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  await rm(tempDir, { recursive: true, force: true });
});

// Helper to wait for debounced events
function waitForEvents(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createWatcher', () => {
  it('fires onFeatureUpdated when a .md file changes', async () => {
    // Set up initial structure
    const projectDir = join(tempDir, 'project-a');
    const featureDir = join(projectDir, '.dev', 'my-feature');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);

    // Clear any initial events from watcher startup
    featureUpdated.length = 0;
    featureAdded.length = 0;
    featureRemoved.length = 0;

    // Modify the file
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN + '\n<!-- updated -->');
    await waitForEvents(500);

    expect(featureUpdated.length).toBeGreaterThanOrEqual(1);
    expect(featureUpdated[0].projectPath).toBe(projectDir);
    expect(featureUpdated[0].featureName).toBe('my-feature');
  });

  it('fires onFeatureUpdated when checkpoint.md changes', async () => {
    const projectDir = join(tempDir, 'project-b');
    const featureDir = join(projectDir, '.dev', 'feature-x');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, 'checkpoint.md'), CHECKPOINT);

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);
    featureUpdated.length = 0;

    await writeFile(join(featureDir, 'checkpoint.md'), CHECKPOINT + '\n<!-- updated -->');
    await waitForEvents(500);

    expect(featureUpdated.length).toBeGreaterThanOrEqual(1);
    expect(featureUpdated[0].featureName).toBe('feature-x');
  });

  it('fires onFeatureAdded when a new feature directory appears with a .md file', async () => {
    const projectDir = join(tempDir, 'project-c');
    await mkdir(join(projectDir, '.dev'), { recursive: true });

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);
    featureAdded.length = 0;

    // Create a new feature directory with a master plan
    const newFeatureDir = join(projectDir, '.dev', 'new-feature');
    await mkdir(newFeatureDir, { recursive: true });
    await writeFile(join(newFeatureDir, '00-master-plan.md'), MASTER_PLAN);
    await waitForEvents(500);

    expect(featureAdded.length).toBeGreaterThanOrEqual(1);
    expect(featureAdded[0].projectPath).toBe(projectDir);
    expect(featureAdded[0].featureName).toBe('new-feature');
  });

  it('fires onFeatureRemoved when a feature .md file is deleted', async () => {
    const projectDir = join(tempDir, 'project-d');
    const featureDir = join(projectDir, '.dev', 'doomed-feature');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);
    featureRemoved.length = 0;

    // Delete the master plan file
    await unlink(join(featureDir, '00-master-plan.md'));
    await waitForEvents(500);

    expect(featureRemoved.length).toBeGreaterThanOrEqual(1);
    expect(featureRemoved[0].featureName).toBe('doomed-feature');
  });

  it('debounces rapid writes into a single event', async () => {
    const projectDir = join(tempDir, 'project-e');
    const featureDir = join(projectDir, '.dev', 'rapid-feature');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([tempDir], callbacks, { debounceMs: 200 });
    await waitForEvents(300);
    featureUpdated.length = 0;

    // Rapid writes within debounce window
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN + '\n<!-- 1 -->');
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN + '\n<!-- 2 -->');
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN + '\n<!-- 3 -->');
    await waitForEvents(500);

    // Should have debounced to 1 event (or at most 2 if timing is borderline)
    expect(featureUpdated.length).toBeLessThanOrEqual(2);
    expect(featureUpdated.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores changes outside .dev/ directories', async () => {
    const projectDir = join(tempDir, 'project-f');
    await mkdir(join(projectDir, '.dev', 'some-feature'), { recursive: true });
    await writeFile(join(projectDir, '.dev', 'some-feature', '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);
    featureUpdated.length = 0;

    // Write a file outside .dev/
    await writeFile(join(projectDir, 'README.md'), '# readme');
    await waitForEvents(500);

    expect(featureUpdated).toHaveLength(0);
  });

  it('ignores node_modules directories', async () => {
    const nmDir = join(tempDir, 'node_modules', 'pkg', '.dev', 'hidden');
    await mkdir(nmDir, { recursive: true });
    await writeFile(join(nmDir, '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);
    featureUpdated.length = 0;

    await writeFile(join(nmDir, '00-master-plan.md'), MASTER_PLAN + '\n<!-- change -->');
    await waitForEvents(500);

    expect(featureUpdated).toHaveLength(0);
  });

  it('watches multiple scan directories', async () => {
    const dir1 = join(tempDir, 'workspace-1');
    const dir2 = join(tempDir, 'workspace-2');
    const feat1 = join(dir1, 'proj1', '.dev', 'f1');
    const feat2 = join(dir2, 'proj2', '.dev', 'f2');
    await mkdir(feat1, { recursive: true });
    await mkdir(feat2, { recursive: true });
    await writeFile(join(feat1, '00-master-plan.md'), MASTER_PLAN);
    await writeFile(join(feat2, '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([dir1, dir2], callbacks);
    await waitForEvents(300);
    featureUpdated.length = 0;

    await writeFile(join(feat1, '00-master-plan.md'), MASTER_PLAN + '\n<!-- a -->');
    await writeFile(join(feat2, '00-master-plan.md'), MASTER_PLAN + '\n<!-- b -->');
    await waitForEvents(500);

    const names = featureUpdated.map((e) => e.featureName).sort();
    expect(names).toContain('f1');
    expect(names).toContain('f2');
  });

  it('removes stale projects during rescan when .dev directory is deleted', async () => {
    const projectDir = join(tempDir, 'project-stale');
    const featureDir = join(projectDir, '.dev', 'stale-feature');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN);

    // Use a short rescan interval so the test doesn't take too long
    watcher = await createWatcher([tempDir], callbacks, { rescanIntervalMs: 500 });
    await waitForEvents(300);
    featureRemoved.length = 0;

    // Remove the entire project directory
    await rm(projectDir, { recursive: true, force: true });

    // Wait for the rescan to detect the removal
    await waitForEvents(1000);

    expect(featureRemoved.length).toBeGreaterThanOrEqual(1);
    expect(featureRemoved[0].projectPath).toBe(projectDir);
    expect(featureRemoved[0].featureName).toBe('stale-feature');
  });

  it('close() stops watching', async () => {
    const projectDir = join(tempDir, 'project-g');
    const featureDir = join(projectDir, '.dev', 'closeable');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN);

    watcher = await createWatcher([tempDir], callbacks);
    await waitForEvents(300);
    featureUpdated.length = 0;

    await watcher.close();
    watcher = null;

    await writeFile(join(featureDir, '00-master-plan.md'), MASTER_PLAN + '\n<!-- after close -->');
    await waitForEvents(500);

    expect(featureUpdated).toHaveLength(0);
  });
});
