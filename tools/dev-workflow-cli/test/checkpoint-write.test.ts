import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkpointWrite, doCheckpointWrite } from '../src/commands/checkpoint-write.js';
import { parseCheckpoint, parseSessionLog } from 'dev-workflow-core';

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

/** Create a temp feature dir with optional existing files. */
function createTempFeatureDir(existingCheckpoint?: string, masterPlan?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cpw-test-'));
  mkdirSync(join(dir), { recursive: true });
  if (existingCheckpoint) {
    writeFileSync(join(dir, 'checkpoint.md'), existingCheckpoint, 'utf-8');
  }
  if (masterPlan) {
    writeFileSync(join(dir, '00-master-plan.md'), masterPlan, 'utf-8');
  }
  return dir;
}

describe('checkpoint-write', () => {
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

  it('writes checkpoint and outputs results', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const inputData = {
      branch: 'feature/test',
      lastCommit: 'abc123 init',
      uncommittedChanges: false,
      context: 'Building the thing',
      currentState: 'Phase 1 done',
      nextAction: 'Start Phase 2',
      keyFiles: 'src/main.ts',
      decisions: ['Use SQLite'],
      blockers: [],
      notes: ['Watch for edge case'],
    };

    const result = await doCheckpointWrite(dir, inputData);

    expect(result.success).toBe(true);
    expect(result.file).toBe(join(dir, 'checkpoint.md'));

    // Verify the checkpoint file was written and parses back correctly
    const parsed = await parseCheckpoint(join(dir, 'checkpoint.md'));
    expect(parsed).not.toBeNull();
    expect(parsed!.branch).toBe('feature/test');
    expect(parsed!.context).toBe('Building the thing');
    expect(parsed!.decisions).toEqual(['Use SQLite']);
    // Empty arrays should not produce XML blocks
    expect(parsed!.blockers).toEqual([]);
    expect(parsed!.notes).toEqual(['Watch for edge case']);
  });

  it('appends previous checkpoint to session-log before writing', async () => {
    const existingCheckpoint = `---
branch: feature/old
last_commit: def456 old
uncommitted_changes: false
checkpointed: "2026-04-10T09:00:00.000Z"
---

<context>
Old session context
</context>

<current_state>
Phase 1 started
</current_state>

<next_action>
Continue Phase 1
</next_action>

<key_files>
src/old.ts
</key_files>

<decisions>
- Use REST not GraphQL
</decisions>
`;

    const dir = createTempFeatureDir(existingCheckpoint);
    tempDirs.push(dir);

    const inputData = {
      branch: 'feature/new',
      context: 'New session context',
      currentState: 'Phase 1 done',
      nextAction: 'Start Phase 2',
      keyFiles: 'src/new.ts',
    };

    const result = await doCheckpointWrite(dir, inputData);

    expect(result.success).toBe(true);

    // Session-log should have the old checkpoint as Session 1
    const sessionLog = readFileSync(join(dir, 'session-log.md'), 'utf-8');
    expect(sessionLog).toContain('## Session 1 — 2026-04-10T09:00:00.000Z');
    expect(sessionLog).toContain('Old session context');
    expect(sessionLog).toContain('Use REST not GraphQL');

    // New checkpoint should have the new data
    const parsed = await parseCheckpoint(join(dir, 'checkpoint.md'));
    expect(parsed!.branch).toBe('feature/new');
    expect(parsed!.context).toBe('New session context');
  });

  it('accumulates multiple sessions in session-log', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    // First write (no existing checkpoint, so no session-log entry)
    await doCheckpointWrite(dir, {
      branch: 'feature/first',
      context: 'First session',
      currentState: 'Starting out',
      nextAction: 'Keep going',
      keyFiles: 'src/a.ts',
      decisions: ['First decision'],
    });

    // Second write (appends first checkpoint to session-log)
    await doCheckpointWrite(dir, {
      branch: 'feature/second',
      context: 'Second session',
      currentState: 'Making progress',
      nextAction: 'Finish up',
      keyFiles: 'src/b.ts',
      decisions: ['Second decision'],
    });

    // Third write (appends second checkpoint to session-log)
    await doCheckpointWrite(dir, {
      branch: 'feature/third',
      context: 'Third session',
      currentState: 'Almost done',
      nextAction: 'Final review',
      keyFiles: 'src/c.ts',
      decisions: ['Third decision'],
    });

    // Session-log should have Session 1 and Session 2
    const sessionLog = readFileSync(join(dir, 'session-log.md'), 'utf-8');
    expect(sessionLog).toContain('## Session 1');
    expect(sessionLog).toContain('First session');
    expect(sessionLog).toContain('First decision');
    expect(sessionLog).toContain('## Session 2');
    expect(sessionLog).toContain('Second session');
    expect(sessionLog).toContain('Second decision');

    // Current checkpoint should be the third one
    const parsed = await parseCheckpoint(join(dir, 'checkpoint.md'));
    expect(parsed!.context).toBe('Third session');
  });

  it('handles checkpoint without optional sections in session-log', async () => {
    // A minimal checkpoint with no decisions/blockers/notes
    const existingCheckpoint = `---
branch: feature/min
checkpointed: "2026-04-11T12:00:00.000Z"
---

<context>
Minimal context
</context>

<current_state>
Working
</current_state>

<next_action>
Keep going
</next_action>

<key_files>
src/main.ts
</key_files>
`;

    const dir = createTempFeatureDir(existingCheckpoint);
    tempDirs.push(dir);

    const inputData = {
      context: 'Updated context',
      currentState: 'Still working',
      nextAction: 'Almost there',
      keyFiles: 'src/main.ts',
    };

    await doCheckpointWrite(dir, inputData);

    // Session-log should have Session 1 but no decisions/blockers/notes blocks
    const sessionLog = readFileSync(join(dir, 'session-log.md'), 'utf-8');
    expect(sessionLog).toContain('## Session 1');
    expect(sessionLog).toContain('Minimal context');
    expect(sessionLog).not.toContain('<decisions>');
    expect(sessionLog).not.toContain('<blockers>');
    expect(sessionLog).not.toContain('<notes>');
  });

  // CLI-level flag validation tests (don't need stdin)
  it('returns exit code 1 when neither --stdin nor --input-file is provided', async () => {
    const code = await checkpointWrite(['--dir', '/tmp/test']);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Must pass either --stdin or --input-file');
  });

  it('returns exit code 1 when --stdin and --input-file are both provided', async () => {
    const code = await checkpointWrite(['--dir', '/tmp/test', '--stdin', '--input-file', '/tmp/x.json']);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('mutually exclusive');
  });

  it('returns exit code 1 when no dir specified', async () => {
    const code = await checkpointWrite(['--stdin']);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });

  it('reads checkpoint input from --input-file and writes successfully', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    // JSON whose string values contain literal newlines and tabs — exactly the
    // shape that breaks `echo '...' | node ...` via shell escaping.
    const inputData = {
      branch: 'feature/input-file',
      lastCommit: 'abc input-file',
      uncommittedChanges: false,
      context: '## Context\n\n**Goal**: test the --input-file path.\n\tIndented line.',
      currentState: '## Current Progress\n\n- Phase 1 done\n- Phase 2 pending',
      nextAction: '## Next Steps\n\n1. First\n2. Second',
      keyFiles: '## Key Files\n\n- src/a.ts\n- src/b.ts',
      decisions: ['Use --input-file'],
    };
    const inputPath = join(dir, '.checkpoint-input.json');
    writeFileSync(inputPath, JSON.stringify(inputData, null, 2), 'utf-8');

    const code = await checkpointWrite([
      '--dir',
      dir,
      '--input-file',
      inputPath,
      '--json',
    ]);

    expect(code).toBe(0);
    expect(output.errorLines.join('\n')).toBe('');

    const parsed = await parseCheckpoint(join(dir, 'checkpoint.md'));
    expect(parsed).not.toBeNull();
    expect(parsed!.branch).toBe('feature/input-file');
    expect(parsed!.context).toContain('test the --input-file path');
    expect(parsed!.context).toContain('Indented line');
    expect(parsed!.decisions).toEqual(['Use --input-file']);
  });

  it('returns exit code 1 when --input-file does not exist', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const code = await checkpointWrite([
      '--dir',
      dir,
      '--input-file',
      join(dir, 'does-not-exist.json'),
    ]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Failed to read input file');
  });

  it('returns exit code 1 when --input-file contains invalid JSON', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const inputPath = join(dir, '.checkpoint-input.json');
    writeFileSync(inputPath, '{not valid json', 'utf-8');

    const code = await checkpointWrite(['--dir', dir, '--input-file', inputPath]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Failed to read input file');
  });

  it('session-log entries round-trip through parseSessionLog', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    // Write first checkpoint
    await doCheckpointWrite(dir, {
      branch: 'feature/first',
      context: 'First session context',
      currentState: 'Starting out',
      nextAction: 'Keep going',
      keyFiles: 'src/a.ts',
      decisions: ['Use SQLite', 'Skip ORM'],
      blockers: ['Waiting on schema review'],
      notes: ['Check edge cases'],
    });

    // Write second checkpoint (appends first to session-log)
    await doCheckpointWrite(dir, {
      branch: 'feature/second',
      context: 'Second session context',
      currentState: 'Making progress',
      nextAction: 'Finish up',
      keyFiles: 'src/b.ts',
      decisions: ['Add indexing'],
    });

    // Write third checkpoint (appends second to session-log)
    await doCheckpointWrite(dir, {
      branch: 'feature/third',
      context: 'Third session context',
      currentState: 'Almost done',
      nextAction: 'Final review',
      keyFiles: 'src/c.ts',
    });

    // The critical test: parseSessionLog must be able to read what formatSessionEntry wrote
    const entries = await parseSessionLog(join(dir, 'session-log.md'));

    expect(entries).toHaveLength(2); // first + second (third is current checkpoint, not in log)

    // Session 1 — from first checkpoint
    expect(entries[0].session).toBe(1);
    expect(entries[0].context).toBe('First session context');
    expect(entries[0].decisions).toEqual(['Use SQLite', 'Skip ORM']);
    expect(entries[0].blockers).toEqual(['Waiting on schema review']);
    expect(entries[0].notes).toEqual(['Check edge cases']);

    // Session 2 — from second checkpoint
    expect(entries[1].session).toBe(2);
    expect(entries[1].context).toBe('Second session context');
    expect(entries[1].decisions).toEqual(['Add indexing']);
    expect(entries[1].blockers).toEqual([]);
    expect(entries[1].notes).toEqual([]);
  });

  it('round-trips: writeCheckpoint output parses back identically', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const inputData = {
      branch: 'feature/round-trip',
      lastCommit: 'abc round-trip',
      uncommittedChanges: true,
      context: 'Round-trip context with `backtick <tags>` inside',
      currentState: 'Phase 1 in progress',
      nextAction: 'Finish Phase 1',
      keyFiles: 'src/round.ts\nlib/utils.ts',
      decisions: ['Use approach A', 'Skip B for now'],
      blockers: ['Waiting on API'],
      notes: ['Note one', 'Note two'],
      continuationPrompt: 'Please continue with Phase 2',
      prdFiles: ['.dev/feature/00-master-plan.md', '.dev/feature/01-sub-prd.md'],
    };

    await doCheckpointWrite(dir, inputData);

    const parsed = await parseCheckpoint(join(dir, 'checkpoint.md'));
    expect(parsed).not.toBeNull();
    expect(parsed!.branch).toBe('feature/round-trip');
    expect(parsed!.lastCommit).toBe('abc round-trip');
    expect(parsed!.uncommittedChanges).toBe(true);
    expect(parsed!.context).toContain('backtick <tags>');
    expect(parsed!.decisions).toEqual(['Use approach A', 'Skip B for now']);
    expect(parsed!.blockers).toEqual(['Waiting on API']);
    expect(parsed!.notes).toEqual(['Note one', 'Note two']);
    expect(parsed!.continuationPrompt).toBe('Please continue with Phase 2');
  });
});