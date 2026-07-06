import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { statusUpdate } from '../src/commands/status-update.js';

function captureOutput() {
  const lines: string[] = [];
  const errorLines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => errorLines.push(args.map(String).join(' '));
  return {
    lines,
    errorLines,
    restore() {
      console.log = origLog;
      console.error = origErr;
    },
  };
}

/** A minimal master plan with two phases and numbered steps. */
const MASTER_PLAN = `# Feature: Test Feature

## Implementation Order

### Phase 1: Setup

1. ⬜ Create scaffold
2. ⬜ Add dependencies

**Verification**:
- [x] Scaffold exists

⏸️ **GATE**: Phase 1 complete.

### Phase 2: Core

1. ⬜ Implement logic
2. ⬜ Add tests

⏸️ **GATE**: Phase 2 complete.
`;

/** A master plan with sub-PRD references (no inline Phase headers). */
const MASTER_PLAN_SUBPRD = `# Feature: SubPRD Feature

## Implementation Order

See sub-PRDs for details.
`;

const SUB_PRD_1 = `# Sub-PRD: Setup Phase

**Status**: In Progress

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Create scaffold | ⬜ |
| **2** | Add deps | ⬜ |
`;

/** A master plan whose Phase 1 has inline steps but Phase 2 is a stub that
 *  delegates its steps to a sub-PRD (Goal + GATE, no numbered steps). */
const MASTER_PLAN_STUB = `# Feature: Stub Feature

## Implementation Order

### Phase 1: Setup

1. ⬜ Create scaffold

⏸️ **GATE**: Phase 1 complete.

### Phase 2: Core → [02](./02-sub-prd-core.md)
**Goal**: Delegated to the sub-PRD.

⏸️ **GATE**.
`;

const SUB_PRD_2 = `# Sub-PRD: Core

**Status**: Not Started

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Implement core | ⬜ Not Started |
| **2** | Add tests | ⬜ Not Started |
`;

function createTempFeatureDir(masterPlan?: string, subPrds?: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'su-test-'));
  mkdirSync(join(dir), { recursive: true });
  if (masterPlan) {
    writeFileSync(join(dir, '00-master-plan.md'), masterPlan, 'utf-8');
  }
  if (subPrds) {
    for (const [name, content] of Object.entries(subPrds)) {
      writeFileSync(join(dir, name), content, 'utf-8');
    }
  }
  return dir;
}

describe('status-update', () => {
  let output: ReturnType<typeof captureOutput>;
  let tempDirs: string[];

  beforeEach(() => {
    output = captureOutput();
    tempDirs = [];
  });

  afterEach(() => {
    output.restore();
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('marks a step as done with --marker done', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--step', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);
    expect(json.line).toBeGreaterThan(0);

    // Verify the file was updated
    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).toContain('1. ✅ Create scaffold');
    // Other steps should be unchanged
    expect(updated).toContain('2. ⬜ Add dependencies');
  });

  it('marks a step as todo with --marker todo', async () => {
    const planWithDone = `# Feature: Test

### Phase 1: Setup

1. ✅ Create scaffold
2. ⬜ Add dependencies
`;
    const dir = createTempFeatureDir(planWithDone);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--step', '1', '--marker', 'todo', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);

    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).toContain('1. ⬜ Create scaffold');
  });

  it('reports unchanged when marker already set', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--step', '1', '--marker', 'todo']);

    expect(code).toBe(0);
    const text = output.lines.join('\n');
    expect(text).toContain('already todo');
  });

  it('marks a phase-level marker', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);
  });

  it('updates step in Phase 2 without affecting Phase 1', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '2', '--step', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);

    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).toContain('1. ✅ Implement logic');
    // Phase 1 should be untouched
    expect(updated).toContain('1. ⬜ Create scaffold');
  });

  it('updates a sub-PRD table row when the master plan has no Phase headers', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN_SUBPRD, { '01-sub-prd-setup.md': SUB_PRD_1 });
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--step', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);
    expect(json.file).toContain('01-sub-prd-setup.md');

    const updated = readFileSync(join(dir, '01-sub-prd-setup.md'), 'utf-8');
    expect(updated).toContain('| **1** | Create scaffold | ✅ Done |');
    // The other row and the master plan are untouched.
    expect(updated).toContain('| **2** | Add deps | ⬜ |');
  });

  it('routes a delegated stub-header phase to its sub-PRD file, not the master plan', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN_STUB, { '02-sub-prd-core.md': SUB_PRD_2 });
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '2', '--step', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.file).toContain('02-sub-prd-core.md');

    const sub = readFileSync(join(dir, '02-sub-prd-core.md'), 'utf-8');
    expect(sub).toContain('| **1** | Implement core | ✅ Done |');
    // The master plan's stub Phase 2 heading is left alone.
    const master = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(master).toContain('### Phase 2: Core → [02](./02-sub-prd-core.md)');
  });

  it('keeps a master-plan phase with inline steps authoritative over a same-numbered sub-PRD', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN_STUB, { '01-sub-prd-setup.md': SUB_PRD_1 });
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--step', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.file).toContain('00-master-plan.md');

    const master = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(master).toContain('1. ✅ Create scaffold');
    // The sub-PRD with the same NN prefix is not touched.
    const sub = readFileSync(join(dir, '01-sub-prd-setup.md'), 'utf-8');
    expect(sub).toContain('| **1** | Create scaffold | ⬜ |');
  });

  it('sets a sub-PRD Status field for a phase-level marker', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN_SUBPRD, { '01-sub-prd-setup.md': SUB_PRD_1 });
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);
    expect(json.file).toContain('01-sub-prd-setup.md');

    const updated = readFileSync(join(dir, '01-sub-prd-setup.md'), 'utf-8');
    expect(updated).toContain('**Status**: Complete');
  });

  it('returns exit code 1 when --phase is missing', async () => {
    const code = await statusUpdate(['--dir', '/tmp/test', '--marker', 'done']);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('--phase');
  });

  it('returns exit code 1 when --marker is missing', async () => {
    const code = await statusUpdate(['--dir', '/tmp/test', '--phase', '1']);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('--marker');
  });

  it('returns exit code 1 for invalid --marker value', async () => {
    const code = await statusUpdate(['--dir', '/tmp/test', '--phase', '1', '--marker', 'maybe']);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Invalid --marker');
  });

  it('returns exit code 1 when no dir specified', async () => {
    const code = await statusUpdate(['--phase', '1', '--marker', 'done']);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });

  it('returns exit code 1 for non-existent phase', async () => {
    const dir = createTempFeatureDir(MASTER_PLAN);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '99', '--marker', 'done']);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Phase 99 not found');
  });

  it('handles emoji shortcodes in the source file', async () => {
    const shortcodePlan = `# Feature: Test

### Phase 1: Setup

1. :white_check_mark: Already done
2. :white_large_square: Not done
`;
    const dir = createTempFeatureDir(shortcodePlan);
    tempDirs.push(dir);

    const code = await statusUpdate(['--dir', dir, '--phase', '1', '--step', '2', '--marker', 'done', '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.changed).toBe(true);

    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    // After update, the shortcode is normalized to emoji
    expect(updated).toContain('2. ✅ Not done');
  });
});