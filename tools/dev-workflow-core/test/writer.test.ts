import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import {
  parseCheckpoint,
  parseMasterPlan,
} from '../src/parser.js';
import {
  writeCheckpoint,
  updateStatus,
} from '../src/writer.js';
import type { CheckpointWriteInput, StepTarget, StatusMarker } from '../src/types.js';

const FIXTURES = resolve(__dirname, 'fixtures');
const TMP_DIR = resolve(__dirname, 'fixtures/_writer_tmp');

// Helper: read a fixture file
async function readFixture(...paths: string[]): Promise<string> {
  return readFile(resolve(FIXTURES, ...paths), 'utf-8');
}

// Helper: round-trip test — parse → construct WriteInput → write → parse → compare
async function roundTripTest(fixtureDir: string) {
  const checkpointPath = resolve(FIXTURES, fixtureDir, 'checkpoint.md');
  const original = await parseCheckpoint(checkpointPath);
  expect(original).not.toBeNull();

  // Construct CheckpointWriteInput from parsed data
  const input: CheckpointWriteInput = {
    branch: original!.branch ?? undefined,
    lastCommit: original!.lastCommit ?? undefined,
    uncommittedChanges: original!.uncommittedChanges ?? undefined,
    checkpointed: original!.checkpointed ?? undefined,
    prdFiles: original!.prdFiles.length > 0 ? original!.prdFiles : undefined,
    context: original!.context ?? '',
    currentState: original!.currentState ?? '',
    nextAction: original!.nextAction ?? '',
    keyFiles: original!.keyFiles ?? '',
    decisions: original!.decisions.length > 0 ? original!.decisions : undefined,
    blockers: original!.blockers.length > 0 ? original!.blockers : undefined,
    notes: original!.notes.length > 0 ? original!.notes : undefined,
    continuationPrompt: original!.continuationPrompt ?? undefined,
  };

  // Write to temp file
  await mkdir(TMP_DIR, { recursive: true });
  const tmpPath = join(TMP_DIR, 'roundtrip-checkpoint.md');
  await writeCheckpoint(tmpPath, input);

  // Parse the written file
  const written = await parseCheckpoint(tmpPath);

  // Compare parsed results
  expect(written).not.toBeNull();
  expect(written!.branch).toBe(original!.branch);
  expect(written!.lastCommit).toBe(original!.lastCommit);
  expect(written!.uncommittedChanges).toBe(original!.uncommittedChanges);
  // checkpointed may differ in format (ISO string vs YAML date) but the value should match
  // after round-trip through gray-matter
  expect(written!.context).toBe(original!.context);
  expect(written!.currentState).toBe(original!.currentState);
  expect(written!.nextAction).toBe(original!.nextAction);
  expect(written!.keyFiles).toBe(original!.keyFiles);
  expect(written!.prdFiles).toEqual(original!.prdFiles);
  expect(written!.decisions).toEqual(original!.decisions);
  expect(written!.blockers).toEqual(original!.blockers);
  expect(written!.notes).toEqual(original!.notes);
  expect(written!.continuationPrompt).toBe(original!.continuationPrompt);

  // Cleanup
  await rm(TMP_DIR, { recursive: true, force: true });
}

// ─── Round-Trip Tests ──────────────────────────────────────────────

describe('writeCheckpoint round-trip', () => {
  afterEach(async () => {
    try { await rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('round-trips the full-feature checkpoint', async () => {
    const checkpointPath = resolve(FIXTURES, 'full-feature/checkpoint.md');
    const original = await parseCheckpoint(checkpointPath);
    expect(original).not.toBeNull();

    const input: CheckpointWriteInput = {
      branch: original!.branch ?? undefined,
      lastCommit: original!.lastCommit ?? undefined,
      uncommittedChanges: original!.uncommittedChanges ?? undefined,
      checkpointed: original!.checkpointed ?? undefined,
      prdFiles: original!.prdFiles.length > 0 ? original!.prdFiles : undefined,
      context: original!.context ?? '',
      currentState: original!.currentState ?? '',
      nextAction: original!.nextAction ?? '',
      keyFiles: original!.keyFiles ?? '',
      decisions: original!.decisions.length > 0 ? original!.decisions : undefined,
      blockers: original!.blockers.length > 0 ? original!.blockers : undefined,
      notes: original!.notes.length > 0 ? original!.notes : undefined,
      continuationPrompt: original!.continuationPrompt ?? undefined,
    };

    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'full-roundtrip.md');
    await writeCheckpoint(tmpPath, input);

    const written = await parseCheckpoint(tmpPath);
    expect(written).not.toBeNull();

    // Frontmatter fields must match
    expect(written!.branch).toBe(original!.branch);
    expect(written!.lastCommit).toBe(original!.lastCommit);
    expect(written!.uncommittedChanges).toBe(original!.uncommittedChanges);

    // XML sections must match
    expect(written!.context).toBe(original!.context);
    expect(written!.currentState).toBe(original!.currentState);
    expect(written!.nextAction).toBe(original!.nextAction);
    expect(written!.keyFiles).toBe(original!.keyFiles);
    expect(written!.prdFiles).toEqual(original!.prdFiles);
    expect(written!.decisions).toEqual(original!.decisions);
    expect(written!.blockers).toEqual(original!.blockers);
    expect(written!.notes).toEqual(original!.notes);
    expect(written!.continuationPrompt).toBe(original!.continuationPrompt);
  });

  it('round-trips the checkpoint-only fixture (no optional sections)', async () => {
    const checkpointPath = resolve(FIXTURES, 'checkpoint-only/checkpoint.md');
    const original = await parseCheckpoint(checkpointPath);
    expect(original).not.toBeNull();

    // checkpoint-only fixture has no decisions, blockers, or notes
    expect(original!.decisions).toEqual([]);
    expect(original!.blockers).toEqual([]);
    expect(original!.notes).toEqual([]);

    const input: CheckpointWriteInput = {
      branch: original!.branch ?? undefined,
      lastCommit: original!.lastCommit ?? undefined,
      uncommittedChanges: original!.uncommittedChanges ?? undefined,
      checkpointed: original!.checkpointed ?? undefined,
      prdFiles: original!.prdFiles.length > 0 ? original!.prdFiles : undefined,
      context: original!.context ?? '',
      currentState: original!.currentState ?? '',
      nextAction: original!.nextAction ?? '',
      keyFiles: original!.keyFiles ?? '',
      decisions: undefined,
      blockers: undefined,
      notes: undefined,
    };

    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'minimal-roundtrip.md');
    await writeCheckpoint(tmpPath, input);

    const written = await parseCheckpoint(tmpPath);
    expect(written).not.toBeNull();
    expect(written!.branch).toBe(original!.branch);
    expect(written!.uncommittedChanges).toBe(original!.uncommittedChanges);
    expect(written!.context).toBe(original!.context);
    expect(written!.currentState).toBe(original!.currentState);
    expect(written!.nextAction).toBe(original!.nextAction);
    expect(written!.keyFiles).toBe(original!.keyFiles);
    expect(written!.prdFiles).toEqual(original!.prdFiles);
    expect(written!.decisions).toEqual([]);
    expect(written!.blockers).toEqual([]);
    expect(written!.notes).toEqual([]);
  });
});

// ─── Diff Tests ────────────────────────────────────────────────────

describe('writeCheckpoint diff (formatting-only vs content loss)', () => {
  afterEach(async () => {
    try { await rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('written checkpoint has no content loss vs full-feature fixture', async () => {
    const checkpointPath = resolve(FIXTURES, 'full-feature/checkpoint.md');
    const original = await parseCheckpoint(checkpointPath);
    expect(original).not.toBeNull();

    const input: CheckpointWriteInput = {
      branch: original!.branch ?? undefined,
      lastCommit: original!.lastCommit ?? undefined,
      uncommittedChanges: original!.uncommittedChanges ?? undefined,
      checkpointed: original!.checkpointed ?? undefined,
      prdFiles: original!.prdFiles.length > 0 ? original!.prdFiles : undefined,
      context: original!.context ?? '',
      currentState: original!.currentState ?? '',
      nextAction: original!.nextAction ?? '',
      keyFiles: original!.keyFiles ?? '',
      decisions: original!.decisions.length > 0 ? original!.decisions : undefined,
      blockers: original!.blockers.length > 0 ? original!.blockers : undefined,
      notes: original!.notes.length > 0 ? original!.notes : undefined,
    };

    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'diff-test.md');
    await writeCheckpoint(tmpPath, input);

    // Parse the written file — all content fields must be present
    const written = await parseCheckpoint(tmpPath);
    expect(written).not.toBeNull();

    // No content loss: all semantic fields are preserved
    expect(written!.branch).toBe(original!.branch);
    expect(written!.lastCommit).toBe(original!.lastCommit);
    expect(written!.uncommittedChanges).toBe(original!.uncommittedChanges);
    expect(written!.context).toBe(original!.context);
    expect(written!.currentState).toBe(original!.currentState);
    expect(written!.nextAction).toBe(original!.nextAction);
    expect(written!.keyFiles).toBe(original!.keyFiles);
    expect(written!.prdFiles).toEqual(original!.prdFiles);
    expect(written!.continuationPrompt).toBe(original!.continuationPrompt);
    expect(written!.decisions).toEqual(original!.decisions);
    expect(written!.blockers).toEqual(original!.blockers);
    expect(written!.notes).toEqual(original!.notes);
  });
});

// ─── Optional Section Tests ─────────────────────────────────────────

describe('writeCheckpoint optional sections', () => {
  afterEach(async () => {
    try { await rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('omits decisions, blockers, notes when arrays are empty', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'no-optional.md');

    const input: CheckpointWriteInput = {
      branch: 'feature/test',
      lastCommit: 'Initial commit',
      uncommittedChanges: false,
      checkpointed: '2026-04-12T10:00:00.000Z',
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
      decisions: [],
      blockers: [],
      notes: [],
    };

    await writeCheckpoint(tmpPath, input);

    const content = await readFile(tmpPath, 'utf-8');
    // Empty arrays should result in no XML sections
    expect(content).not.toContain('<decisions>');
    expect(content).not.toContain('<blockers>');
    expect(content).not.toContain('<notes>');

    // But parseCheckpoint should return empty arrays
    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.decisions).toEqual([]);
    expect(parsed!.blockers).toEqual([]);
    expect(parsed!.notes).toEqual([]);
  });

  it('omits decisions, blockers, notes when undefined', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'undefined-optional.md');

    const input: CheckpointWriteInput = {
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
      // decisions, blockers, notes are undefined
    };

    await writeCheckpoint(tmpPath, input);

    const content = await readFile(tmpPath, 'utf-8');
    expect(content).not.toContain('<decisions>');
    expect(content).not.toContain('<blockers>');
    expect(content).not.toContain('<notes>');
  });

  it('includes decisions, blockers, notes when arrays are populated', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'with-optional.md');

    const input: CheckpointWriteInput = {
      branch: 'feature/test',
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
      decisions: ['Use SQLite for local storage', 'Index on created_at'],
      blockers: ['Need API key from infra team'],
      notes: ['Consider migration to Postgres later'],
    };

    await writeCheckpoint(tmpPath, input);

    const content = await readFile(tmpPath, 'utf-8');
    expect(content).toContain('<decisions>');
    expect(content).toContain('- Use SQLite for local storage');
    expect(content).toContain('</decisions>');
    expect(content).toContain('<blockers>');
    expect(content).toContain('- Need API key from infra team');
    expect(content).toContain('</blockers>');
    expect(content).toContain('<notes>');
    expect(content).toContain('- Consider migration to Postgres later');
    expect(content).toContain('</notes>');

    // Parse back and verify
    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.decisions).toEqual(['Use SQLite for local storage', 'Index on created_at']);
    expect(parsed!.blockers).toEqual(['Need API key from infra team']);
    expect(parsed!.notes).toEqual(['Consider migration to Postgres later']);
  });

  it('includes continuation prompt when provided', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'continuation.md');

    const input: CheckpointWriteInput = {
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
      continuationPrompt: 'Please continue with Phase 2 implementation.',
    };

    await writeCheckpoint(tmpPath, input);

    const content = await readFile(tmpPath, 'utf-8');
    expect(content).toContain('---\n\nPlease continue with Phase 2 implementation.');
  });

  it('includes PRD files list when provided', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'prd-files.md');

    const input: CheckpointWriteInput = {
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
      prdFiles: ['.dev/feature/00-master-plan.md', '.dev/feature/01-sub-prd-api.md'],
    };

    await writeCheckpoint(tmpPath, input);

    const content = await readFile(tmpPath, 'utf-8');
    expect(content).toContain('Read the following PRD files in order:');
    expect(content).toContain('1. .dev/feature/00-master-plan.md');
    expect(content).toContain('2. .dev/feature/01-sub-prd-api.md');
  });

  it('defaults checkpointed to current time when not provided', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'auto-timestamp.md');

    const input: CheckpointWriteInput = {
      context: 'Test',
      currentState: 'Test',
      nextAction: 'Test',
      keyFiles: 'Test',
    };

    const before = new Date().toISOString();
    await writeCheckpoint(tmpPath, input);
    const after = new Date().toISOString();

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.checkpointed).not.toBeNull();
    // checkpointed should be between before and after
    expect(parsed!.checkpointed! >= before).toBe(true);
    expect(parsed!.checkpointed! <= after).toBe(true);
  });

  it('handles boolean uncommitted_changes correctly in YAML', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'boolean-test.md');

    const input: CheckpointWriteInput = {
      uncommittedChanges: true,
      context: 'Test',
      currentState: 'Test',
      nextAction: 'Test',
      keyFiles: 'Test',
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.uncommittedChanges).toBe(true);

    // Test with false
    const input2: CheckpointWriteInput = {
      ...input,
      uncommittedChanges: false,
    };
    await writeCheckpoint(tmpPath, input2);

    const parsed2 = await parseCheckpoint(tmpPath);
    expect(parsed2).not.toBeNull();
    expect(parsed2!.uncommittedChanges).toBe(false);
  });
});

// ─── Status Marker Update Tests ────────────────────────────────────

describe('updateStatus marker updates', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(TMP_DIR, `status-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try { await rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('flips a numbered step marker from ⬜ to ✅', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ⬜ Create project structure',
      '2. ⬜ Configure build tools',
      '3. ⬜ Write initial tests',
      '',
    ].join('\n'), 'utf-8');

    const result = await updateStatus(filePath, { phase: 1, step: 2 }, '✅');

    expect(result.changed).toBe(true);
    expect(result.line).toBe(6); // Step 2 is on line 6 (1-indexed)

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('2. ✅ Configure build tools');
    expect(content).toContain('1. ⬜ Create project structure'); // unchanged
    expect(content).toContain('3. ⬜ Write initial tests'); // unchanged
  });

  it('flips a numbered step marker from ✅ to ⬜', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ✅ Create project structure',
      '2. ✅ Configure build tools',
      '3. ⬜ Write initial tests',
      '',
    ].join('\n'), 'utf-8');

    const result = await updateStatus(filePath, { phase: 1, step: 1 }, '⬜');

    expect(result.changed).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('1. ⬜ Create project structure'); // flipped
    expect(content).toContain('2. ✅ Configure build tools'); // unchanged
  });

  it('reports changed=false when marker is already the same', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ✅ Create project structure',
      '',
    ].join('\n'), 'utf-8');

    const result = await updateStatus(filePath, { phase: 1, step: 1 }, '✅');

    expect(result.changed).toBe(false);
  });

  it('updates a phase-level marker in the heading', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup ⬜',
      '',
      '1. ⬜ Create project structure',
      '',
      '### Phase 2: Implementation ⬜',
      '',
    ].join('\n'), 'utf-8');

    const result = await updateStatus(filePath, { phase: 1 }, '✅');

    expect(result.changed).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('### Phase 1: Setup ✅');
    expect(content).toContain('### Phase 2: Implementation ⬜'); // unchanged
  });

  it('handles emoji shortcodes by normalizing them first', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. :white_check_mark: Create project structure',
      '2. :white_large_square: Configure build tools',
      '',
    ].join('\n'), 'utf-8');

    const result = await updateStatus(filePath, { phase: 1, step: 2 }, '✅');

    expect(result.changed).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    // Normalized ✅ replaces the shortcode
    expect(content).toContain('2. ✅ Configure build tools');
    // Also normalized the :white_check_mark: shortcode on line 1
    expect(content).toContain('1. ✅ Create project structure');
  });

  it('handles bullet step markers', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '- ⬜ Create project structure',
      '- ⬜ Configure build tools',
      '- ⬜ Write initial tests',
      '',
    ].join('\n'), 'utf-8');

    const result = await updateStatus(filePath, { phase: 1, step: 2 }, '✅');

    expect(result.changed).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('- ✅ Configure build tools');
    expect(content).toContain('- ⬜ Create project structure'); // unchanged
    expect(content).toContain('- ⬜ Write initial tests'); // unchanged
  });

  it('skips verification section checkboxes', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ⬜ Create project structure',
      '2. ⬜ Configure build tools',
      '',
      '**Verification**',
      '- [x] Project builds',
      '- [ ] Tests pass',
      '',
    ].join('\n'), 'utf-8');

    // Step 2 should still be found (not confused with verification items)
    const result = await updateStatus(filePath, { phase: 1, step: 2 }, '✅');
    expect(result.changed).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('2. ✅ Configure build tools');
    // Verification items should be unchanged
    expect(content).toContain('- [x] Project builds');
    expect(content).toContain('- [ ] Tests pass');
  });

  it('throws an error for a non-existent phase', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ⬜ Do something',
      '',
    ].join('\n'), 'utf-8');

    await expect(
      updateStatus(filePath, { phase: 99 }, '✅'),
    ).rejects.toThrow('Phase 99 not found');
  });

  it('throws an error for a non-existent step', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ⬜ Do something',
      '',
    ].join('\n'), 'utf-8');

    await expect(
      updateStatus(filePath, { phase: 1, step: 5 }, '✅'),
    ).rejects.toThrow('Could not find step 5 in phase 1');
  });

  it('preserves other content byte-for-byte when only marker changes', async () => {
    const filePath = join(tmpDir, 'plan.md');
    const original = [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ⬜ Create project structure',
      '2. ⬜ Configure build tools',
      '',
      'Some other content here.',
      '',
    ].join('\n');
    await writeFile(filePath, original, 'utf-8');

    await updateStatus(filePath, { phase: 1, step: 1 }, '✅');

    const updated = await readFile(filePath, 'utf-8');
    // Only line 4 should change (the "1. ⬜" becomes "1. ✅")
    const originalLines = original.split('\n');
    const updatedLines = updated.split('\n');

    for (let i = 0; i < originalLines.length; i++) {
      if (i === 4) {
        // This is the step 1 line — should have ✅ instead of ⬜
        expect(updatedLines[i]).toBe('1. ✅ Create project structure');
      } else {
        expect(updatedLines[i]).toBe(originalLines[i]);
      }
    }
  });

  it('works with real full-feature master plan fixture', async () => {
    const original = await readFixture('full-feature', '00-master-plan.md');
    const filePath = join(tmpDir, 'master-plan.md');
    await writeFile(filePath, original, 'utf-8');

    // Phase 1, Step 1 — should currently be ✅ (all 5 steps are done in Phase 1)
    // Let's flip step 1 to ⬜
    const result = await updateStatus(filePath, { phase: 1, step: 1 }, '⬜');

    expect(result.changed).toBe(true);
    expect(result.line).toBeGreaterThan(0);

    const updated = await readFile(filePath, 'utf-8');
    // Step 1 in Phase 1 should now be ⬜
    expect(updated).toMatch(/1\.\s*⬜/);
  });

  it('handles checkbox steps with numbered format', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. `[x]` Setup complete',
      '2. `[ ]` Build tools pending',
      '',
    ].join('\n'), 'utf-8');

    // Flip step 2 from `[ ]` to `[x]`
    const result = await updateStatus(filePath, { phase: 1, step: 2 }, '✅');
    expect(result.changed).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('2. `[x]` Build tools pending');
    expect(content).toContain('1. `[x]` Setup complete'); // unchanged
  });

  it('handles multiple phases correctly', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, [
      '# Test Plan',
      '',
      '### Phase 1: Setup',
      '',
      '1. ✅ Create project',
      '2. ✅ Configure tools',
      '',
      '### Phase 2: Implementation',
      '',
      '1. ⬜ Build feature',
      '2. ⬜ Write tests',
      '',
    ].join('\n'), 'utf-8');

    // Flip Phase 2, Step 1
    const result = await updateStatus(filePath, { phase: 2, step: 1 }, '✅');
    expect(result.changed).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('1. ✅ Build feature'); // Phase 2 step 1 changed
    expect(content).toContain('2. ⬜ Write tests'); // Phase 2 step 2 unchanged
    expect(content).toContain('1. ✅ Create project'); // Phase 1 unchanged
  });
});

// ─── Regression Tests from Real-World Checkpoints ──────────────────
//
// These tests cover edge cases found in real-world checkpoint data.
//
// Key findings:
//   - 29/44 checkpoints lack branch/lastCommit (frontmatter fields are optional)
//   - 1/44 has `uncommitted_changes` as a string ("4 files modified") – parser treats as null
//   - 1/44 has date-only timestamp ("2026-03-25" with no time) – parser converts to ISO string
//   - 4/44 have timezone offsets in timestamps ("+01:00" instead of "Z")
//   - Several have quoted last_commit values (YAML auto-quotes strings with colons)
//   - 2/44 have no PRD file references at all
//   - ~50% have continuation prompts ending with `---\nPlease continue...`
//   - 3 legacy formats exist (XML-only, markdown-heading-only) – parser returns null/partial

describe('writeCheckpoint regression tests', () => {
  afterEach(async () => {
    try { await rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  it('handles lastCommit with special characters that YAML would quote', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'quoted-commit.md');

    const input: CheckpointWriteInput = {
      branch: 'feature/test',
      lastCommit: 'abc1234 fix: handle edge case in parser (see #42)',
      uncommittedChanges: false,
      checkpointed: '2026-03-27T09:55:10Z',
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.lastCommit).toBe('abc1234 fix: handle edge case in parser (see #42)');
  });

  it('handles timestamp with timezone offset (round-trips as ISO string)', async () => {
    // Real case: checkpointed: 2026-03-24T08:20:00+01:00
    // Gray-matter parses this as a Date, toISOString() normalizes to UTC
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'timezone.md');

    // Simulate: write with explicit ISO string (the writer always produces ISO strings)
    const input: CheckpointWriteInput = {
      branch: 'feature/test',
      checkpointed: '2026-03-24T07:20:00.000Z', // 08:20+01:00 = 07:20Z
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    // Parser normalizes to ISO string
    expect(parsed!.checkpointed).toContain('2026-03-24T07:20:00');
  });

  it('omits PRD file section when prdFiles is empty or undefined', async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'no-prd.md');

    const input: CheckpointWriteInput = {
      context: 'Test context',
      currentState: 'Test state',
      nextAction: 'Test next action',
      keyFiles: 'Test key files',
    };

    await writeCheckpoint(tmpPath, input);

    const content = await readFile(tmpPath, 'utf-8');
    expect(content).not.toContain('Read the following PRD files');

    // Also test empty array (should also omit the section)
    const input2: CheckpointWriteInput = {
      ...input,
      prdFiles: [],
      checkpointed: '2026-03-20T12:00:00Z',
    };
    await writeCheckpoint(tmpPath, input2);
    const content2 = await readFile(tmpPath, 'utf-8');
    expect(content2).not.toContain('Read the following PRD files');
  });

  it('produces checkpoint with no frontmatter fields when none provided', async () => {
    // 29/44 real checkpoints have branch/lastCommit — but the other 15 don't.
    // Writer should produce valid YAML even with no optional frontmatter.
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'minimal.md');

    const input: CheckpointWriteInput = {
      context: 'Just context, nothing else',
      currentState: 'Working on it',
      nextAction: 'Continue',
      keyFiles: 'src/main.ts',
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.branch).toBeNull();
    expect(parsed!.lastCommit).toBeNull();
    expect(parsed!.uncommittedChanges).toBeNull();
    expect(parsed!.context).toBe('Just context, nothing else');
    // currentState and keyFiles are extracted by parseCheckpoint
    expect(parsed!.currentState).toBe('Working on it');
    expect(parsed!.keyFiles).toBe('src/main.ts');
    expect(parsed!.prdFiles).toEqual([]);
    expect(parsed!.continuationPrompt).toBeNull();
    // checkpointed defaults to now
    expect(parsed!.checkpointed).not.toBeNull();
  });

  it('round-trips a checkpoint with only context and nextAction (no branch/commit)', async () => {
    // Mimics the containers-sections-review checkpoint format:
    // frontmatter with branch/commit, no PRD refs, full XML sections
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'review-style.md');

    const input: CheckpointWriteInput = {
      branch: 'master',
      lastCommit: '6aed9354 Add push-to-master trigger',
      uncommittedChanges: false,
      checkpointed: '2026-03-20T12:00:00Z',
      context: '## Context\n\n**Goal**: Review Confluence pitch for integration impact\n**Current phase**: Review complete\n**Key completions**: Analyzed pitch, posted comment',
      currentState: '## Current Progress\n\n- ✅ Read pitch document\n- ✅ Researched codebase\n- ⬜ Follow up if needed',
      nextAction: '## Next Steps\n\nIf implementation proceeds:\n- Review proposed changes',
      keyFiles: '## Key Files\n\n- Pitch doc: docs/confluence-pitch.md',
      decisions: ['No integration breakage from proposed changes'],
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.branch).toBe('master');
    expect(parsed!.lastCommit).toBe('6aed9354 Add push-to-master trigger');
    expect(parsed!.uncommittedChanges).toBe(false);
    expect(parsed!.context).toContain('Review Confluence pitch');
    expect(parsed!.decisions).toEqual(['No integration breakage from proposed changes']);
    expect(parsed!.blockers).toEqual([]); // Not provided → no XML tag → parsed as []
    expect(parsed!.notes).toEqual([]);
  });

  it('handles lastCommit value that contains colons (YAML quoting)', async () => {
    // Real case: last_commit values often contain colons from git messages
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'colon-commit.md');

    const input: CheckpointWriteInput = {
      lastCommit: 'abc1234 feat: add OAuth2 token refresh with 5min TTL',
      context: 'Test',
      currentState: 'Test',
      nextAction: 'Test',
      keyFiles: 'Test',
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.lastCommit).toBe('abc1234 feat: add OAuth2 token refresh with 5min TTL');
  });

  it('round-trips a comprehensive checkpoint modeled on real-world data', async () => {
    // Mimics the confluence-oauth-outage-investigation format:
    // full frontmatter, all XML sections, continuation prompt, PRD refs
    await mkdir(TMP_DIR, { recursive: true });
    const tmpPath = join(TMP_DIR, 'comprehensive.md');

    const input: CheckpointWriteInput = {
      branch: 'master',
      lastCommit: '15d3e4c8 fix: downgrade expected migration errors from ERROR to WARN/INFO',
      uncommittedChanges: false,
      checkpointed: '2026-03-24T08:20:00.000Z',
      prdFiles: ['.dev/investigation/00-master-plan.md'],
      context: '## Context\n\n**Goal**: Investigate and resolve production outage\n**Current phase**: Incident Response — waiting on vendor fix\n**Key completions**: Root cause identified, P1 ticket filed',
      currentState: '## Current Progress\n\n- ✅ CloudWatch alarm investigation\n- ✅ Root cause analysis\n- ⬜ Monitor for resolution',
      nextAction: '## Next Steps\n\nMonitor vendor resolution:\n- Check if errors stop after fix\n- Verify functionality restored',
      keyFiles: '## Key Files\n\n- OAuth handler: src/oauth.ts\n- Connector: src/connector.ts',
      decisions: [
        'Classified as vendor-side issue based on: sudden onset, all tenants affected',
        'Filed as P1 severity — total outage worldwide',
      ],
      blockers: [
        'Blocked on vendor engineering fixing their infrastructure',
        'Status page showed no incident — don\'t rely on it alone',
      ],
      notes: [
        'Vendor enforced new rate limiting on March 2 — unclear if related',
        'One user generated 1,807 errors alone',
      ],
      continuationPrompt: 'Please continue by monitoring the vendor incident resolution. Check CloudWatch for error rate.',
    };

    await writeCheckpoint(tmpPath, input);

    const parsed = await parseCheckpoint(tmpPath);
    expect(parsed).not.toBeNull();

    // Frontmatter
    expect(parsed!.branch).toBe('master');
    expect(parsed!.lastCommit).toBe('15d3e4c8 fix: downgrade expected migration errors from ERROR to WARN/INFO');
    expect(parsed!.uncommittedChanges).toBe(false);

    // XML sections
    expect(parsed!.context).toContain('Investigate and resolve production outage');
    expect(parsed!.nextAction).toContain('Monitor vendor resolution');
    expect(parsed!.decisions).toHaveLength(2);
    expect(parsed!.decisions[0]).toContain('vendor-side issue');
    expect(parsed!.blockers).toHaveLength(2);
    expect(parsed!.blockers[0]).toContain('Blocked on vendor');
    expect(parsed!.notes).toHaveLength(2);
    expect(parsed!.notes[0]).toContain('rate limiting');

    // Verify file content has continuation prompt
    const content = await readFile(tmpPath, 'utf-8');
    expect(content).toContain('---\n\nPlease continue by monitoring');
    expect(content).toContain('Read the following PRD files');
    expect(content).toContain('.dev/investigation/00-master-plan.md');
  });

  it('round-trips edge-case checkpoint fixtures derived from real-world data', async () => {
    // Fixture directory: test/fixtures/edge-case-checkpoints/
    // Each subdirectory contains a checkpoint.md replicating a pattern found
    // in real-world checkpoints (46 analyzed across 3 repos). These are
    // synthetic fixtures — no proprietary data.
    //
    // Edge cases covered:
    //   - no-branch-commit: missing branch/lastCommit frontmatter
    //   - timezone-offset: timestamp with +01:00 offset
    //   - date-only-timestamp: "2026-03-25" with no time component
    //   - string-uncommitted-feature-key: uncommitted_changes as string + extra YAML key
    //   - inline-close-tags: </decisions> on same line as last item
    //   - backticked-xml-tags: <code><decisions></code> in content
    //   - no-slash-decisions-heading: <decisions> with ## heading
    //   - comprehensive: full frontmatter + all XML sections + continuation prompt
    //   - full-feature (existing): standard fixture with all fields populated
    //   - checkpoint-only (existing): minimal fixture with no optional sections

    const edgeCaseDir = resolve(FIXTURES, 'edge-case-checkpoints');
    const entries = await readdir(edgeCaseDir);

    // Also include the existing standard fixtures
    const standardDirs = ['full-feature', 'checkpoint-only'];
    const allDirs = [...standardDirs, ...entries];

    let tested = 0;
    let knownBreakage = 0; // Expected failures from known parser limitations

    for (const entry of allDirs) {
      const isEdgeCase = entries.includes(entry);
      const cpPath = isEdgeCase
        ? join(edgeCaseDir, entry, 'checkpoint.md')
        : join(FIXTURES, entry, 'checkpoint.md');

      let content: string;
      try { content = await readFile(cpPath, 'utf-8'); } catch { continue; }

      // Skip non-YAML-frontmatter checkpoints
      if (!content.trimStart().startsWith('---')) continue;

      // Track known parser limitations — these parse but break round-trip
      const hasInlineClose = /^\s*- .+<\/(?:decisions|blockers|notes)>$/m.test(content);
      const hasBacktickedXml = /\`\u003c(?:decisions|blockers|notes)\u003e\`/.test(content);
      // All known parser limitations are now fixed:
      // - Inline close tags: parser strips stray close tags from list items
      // - Backticked XML tags: extractXmlTag replaces inline code with placeholders
      const isKnownBreakage = false;

      const original = await parseCheckpoint(cpPath);
      if (!original) continue;

      // Construct write input from parsed data
      const input: CheckpointWriteInput = {
        branch: original.branch ?? undefined,
        lastCommit: original.lastCommit ?? undefined,
        uncommittedChanges: original.uncommittedChanges ?? undefined,
        checkpointed: original.checkpointed ?? undefined,
        prdFiles: original.prdFiles.length > 0 ? original.prdFiles : undefined,
        context: original.context ?? '',
        currentState: original.currentState ?? '',
        nextAction: original.nextAction ?? '',
        keyFiles: original.keyFiles ?? '',
        decisions: original.decisions.length > 0 ? original.decisions : undefined,
        blockers: original.blockers.length > 0 ? original.blockers : undefined,
        notes: original.notes.length > 0 ? original.notes : undefined,
        continuationPrompt: original.continuationPrompt ?? undefined,
      };

      await mkdir(TMP_DIR, { recursive: true });
      const tmpPath = join(TMP_DIR, `edge-sweep-${entry}.md`);
      await writeCheckpoint(tmpPath, input);
      const reparsed = await parseCheckpoint(tmpPath);

      if (isKnownBreakage) {
        // Known parser limitation: round-trip breaks for inline close tags
        // and backticked XML tags — just verify the write doesn't throw
        knownBreakage++;
        continue;
      }

      tested++;

      // All key fields must round-trip
      expect(reparsed).not.toBeNull();
      expect(reparsed!.branch).toBe(original.branch);
      expect(reparsed!.lastCommit).toBe(original.lastCommit);
      // uncommitted_changes as string returns null from parser — only compare booleans
      if (typeof original.uncommittedChanges === 'boolean') {
        expect(reparsed!.uncommittedChanges).toBe(original.uncommittedChanges);
      }
      // Required fields: writer always produces the XML tag, so null → '' is expected
      expect(reparsed!.context ?? '').toBe(original.context ?? '');
      expect(reparsed!.currentState ?? '').toBe(original.currentState ?? '');
      expect(reparsed!.nextAction ?? '').toBe(original.nextAction ?? '');
      expect(reparsed!.keyFiles ?? '').toBe(original.keyFiles ?? '');
      expect(reparsed!.prdFiles).toEqual(original.prdFiles);
      expect(reparsed!.decisions).toEqual(original.decisions);
      expect(reparsed!.blockers).toEqual(original.blockers);
      expect(reparsed!.notes).toEqual(original.notes);
      expect(reparsed!.continuationPrompt).toBe(original.continuationPrompt);
    }

    // Should have tested at least 6 clean round-trips.
    // All previous known breakage cases (inline close tags, backticked XML) are now fixed.
    expect(tested).toBeGreaterThanOrEqual(6);
    expect(knownBreakage).toBe(0); // All parser bugs fixed!
  });
});