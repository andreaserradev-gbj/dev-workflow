import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { run } from '../src/commands/run.js';
import type { SpawnClaudeFn, SpawnClaudeResult } from '../src/commands/run.js';
import { readRunStatus } from 'dev-workflow-core';

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

const SINGLE_PHASE_PLAN = `# Feature: Single

### Phase 1: Setup

1. ⬜ Scaffold
2. ⬜ Wire it up

⏸️ **GATE**: Phase 1 complete.
`;

const TWO_PHASE_PLAN = `# Feature: Two

### Phase 1: Setup

1. ⬜ Scaffold

⏸️ **GATE**: Phase 1 complete.

### Phase 2: Core

1. ⬜ Implement logic

⏸️ **GATE**: Phase 2 complete.
`;

const ALREADY_DONE_PLAN = `# Feature: Done

### Phase 1: Setup

1. ✅ Scaffold ✅

⏸️ **GATE**: Phase 1 complete.
`;

function createTempFeatureDir(masterPlan: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'run-test-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '00-master-plan.md'), masterPlan, 'utf-8');
  return dir;
}

interface PlannedSpawn {
  result: SpawnClaudeResult;
  /** Optional assertion to run on the prompt at call time. */
  expectPromptIncludes?: string | RegExp;
}

/** Build a spawnClaude mock that returns a queue of results in order. */
function mockSpawnClaude(planned: PlannedSpawn[]): {
  fn: SpawnClaudeFn;
  calls: { prompt: string; timeoutMs: number; cwd: string }[];
} {
  const calls: { prompt: string; timeoutMs: number; cwd: string }[] = [];
  let i = 0;
  const fn: SpawnClaudeFn = async (opts) => {
    calls.push({ prompt: opts.prompt, timeoutMs: opts.timeoutMs, cwd: opts.cwd });
    const next = planned[i++];
    if (!next) {
      throw new Error(`spawnClaude called more times than planned (call #${i})`);
    }
    if (next.expectPromptIncludes) {
      if (next.expectPromptIncludes instanceof RegExp) {
        expect(opts.prompt).toMatch(next.expectPromptIncludes);
      } else {
        expect(opts.prompt).toContain(next.expectPromptIncludes);
      }
    }
    return next.result;
  };
  return { fn, calls };
}

const okResult = (stdout: string): SpawnClaudeResult => ({
  stdout,
  stderr: '',
  exitCode: 0,
  timedOut: false,
});

const timeoutResult = (): SpawnClaudeResult => ({
  stdout: '',
  stderr: '',
  exitCode: null,
  timedOut: true,
});

const nonZeroExitResult = (exitCode: number, stderr = ''): SpawnClaudeResult => ({
  stdout: '',
  stderr,
  exitCode,
  timedOut: false,
});

describe('run command', () => {
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
        /* ignore */
      }
    }
  });

  // ─── Dry run ──────────────────────────────────────────────

  it('dry-run prints planned phases and does not spawn', async () => {
    const dir = createTempFeatureDir(TWO_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([]);
    const code = await run(
      ['--dir', dir, '--dry-run', '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(0);
    expect(calls).toEqual([]);

    const out = JSON.parse(output.lines.join('\n'));
    expect(out.planned).toHaveLength(2);
    expect(out.planned[0].number).toBe(1);
    expect(out.planned[1].number).toBe(2);

    // No sidecar should be written in dry-run.
    const sidecar = await readRunStatus(dir);
    expect(sidecar).toBeNull();
  });

  it('dry-run honors --max-phases', async () => {
    const dir = createTempFeatureDir(TWO_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn } = mockSpawnClaude([]);
    await run(
      ['--dir', dir, '--dry-run', '--json', '--max-phases', '1'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    const out = JSON.parse(output.lines.join('\n'));
    expect(out.planned).toHaveLength(1);
    expect(out.planned[0].number).toBe(1);
  });

  it('returns 0 with status=noop when nothing is pending', async () => {
    const dir = createTempFeatureDir(ALREADY_DONE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([]);
    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(0);
    expect(calls).toEqual([]);
    const out = JSON.parse(output.lines.join('\n'));
    expect(out.status).toBe('noop');
  });

  // ─── Happy paths ──────────────────────────────────────────

  it('single-phase pass: implementer + judge each spawn once, phase marked ✅, sidecar=done', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: okResult('ok, working\n'), expectPromptIncludes: '/dev-resume' },
      { result: okResult('all good\n<verdict>pass</verdict>'), expectPromptIncludes: '/dev-judge' },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(0);
    expect(calls).toHaveLength(2);

    // Master plan phase 1 title should now have ✅
    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).toMatch(/### Phase 1: Setup\s*✅/);

    const sidecar = await readRunStatus(dir);
    expect(sidecar).not.toBeNull();
    expect(sidecar!.status).toBe('done');
    expect(sidecar!.exitReason).toBe('all phases passed');
    expect(sidecar!.lastVerdict).toBe('pass');
    expect(sidecar!.phaseHistory).toHaveLength(1);
    expect(sidecar!.phaseHistory[0].phase).toBe('1');
    expect(sidecar!.phaseHistory[0].verdict).toBe('pass');
  });

  it('all phases pass: multi-phase loop flips both to ✅', async () => {
    const dir = createTempFeatureDir(TWO_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: okResult('phase 1 work') },
      { result: okResult('<verdict>pass</verdict>') },
      { result: okResult('phase 2 work') },
      { result: okResult('<verdict>pass</verdict>') },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(0);
    expect(calls).toHaveLength(4);

    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).toMatch(/### Phase 1: Setup\s*✅/);
    expect(updated).toMatch(/### Phase 2: Core\s*✅/);

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('done');
    expect(sidecar!.phaseHistory).toHaveLength(2);
    expect(sidecar!.phaseHistory.map((a) => a.phase)).toEqual(['1', '2']);
  });

  // ─── Revise + retry ───────────────────────────────────────

  it('revise then pass: feedback flows into the next implementer prompt', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const reviseStdout = `<feedback>
Step 2 missing tests — add tests covering the edge case.
</feedback>
<verdict>revise</verdict>`;

    const { fn, calls } = mockSpawnClaude([
      // First implementer attempt — no feedback yet
      { result: okResult('first pass'), expectPromptIncludes: 'phase whose ID is `1`' },
      // First judge — revise
      { result: okResult(reviseStdout) },
      // Second implementer — must include the feedback text
      { result: okResult('second pass'), expectPromptIncludes: 'Step 2 missing tests' },
      // Second judge — pass
      { result: okResult('<verdict>pass</verdict>') },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(0);
    expect(calls).toHaveLength(4);

    // Verify second implementer prompt did not include the feedback block
    // for the first attempt (sanity check on prompt builder)
    expect(calls[0].prompt).not.toContain('Step 2 missing tests');
    expect(calls[2].prompt).toContain('previous attempt was rejected');

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('done');
    expect(sidecar!.phaseHistory).toHaveLength(2);
    expect(sidecar!.phaseHistory[0].verdict).toBe('revise');
    expect(sidecar!.phaseHistory[0].feedback).toContain('Step 2 missing tests');
    expect(sidecar!.phaseHistory[1].verdict).toBe('pass');
  });

  it('retry-cap exceeded: 3 revises (cap=2) → escalate, exit 2', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const revise = okResult('<feedback>still wrong</feedback>\n<verdict>revise</verdict>');
    const { fn, calls } = mockSpawnClaude([
      { result: okResult('attempt 1') }, { result: revise },
      { result: okResult('attempt 2') }, { result: revise },
      { result: okResult('attempt 3') }, { result: revise },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(2);
    expect(calls).toHaveLength(6); // 3 attempts × (impl + judge)

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('escalated');
    expect(sidecar!.exitReason).toMatch(/retry cap \(2\) exceeded on phase 1/);
    expect(sidecar!.lastFeedback).toContain('still wrong');
    expect(sidecar!.phaseHistory).toHaveLength(3);

    // Phase 1 must NOT be marked complete on escalation
    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).not.toMatch(/### Phase 1: Setup\s*✅/);
  });

  // ─── Escalate / no-verdict ────────────────────────────────

  it('escalate immediate: judge returns escalate → exit 2 without retry', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: okResult('attempt') },
      { result: okResult('<reason>scope unclear</reason>\n<verdict>escalate</verdict>') },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(2);
    expect(calls).toHaveLength(2);

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('escalated');
    expect(sidecar!.exitReason).toMatch(/judge escalated on phase 1 attempt 1/);
    expect(sidecar!.lastVerdict).toBe('escalate');
  });

  it('no verdict block: treated as terminal escalation', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn } = mockSpawnClaude([
      { result: okResult('attempt') },
      { result: okResult('I have thoughts but no verdict tag.') },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(2);
    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('escalated');
    expect(sidecar!.exitReason).toMatch(/no verdict block on phase 1 attempt 1/);
  });

  // ─── Timeouts ─────────────────────────────────────────────

  it('implementer timeout: exits 3, sidecar shows timeout', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: timeoutResult() },
    ]);

    const code = await run(
      ['--dir', dir, '--json', '--phase-timeout-ms', '100'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(3);
    expect(calls).toHaveLength(1); // Judge never called

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('timeout');
    expect(sidecar!.exitReason).toMatch(/timeout \(100ms\) on phase 1 attempt 1 \(implementer\)/);
  });

  it('judge timeout: exits 3, sidecar shows timeout (judge)', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn } = mockSpawnClaude([
      { result: okResult('impl ran') },
      { result: timeoutResult() },
    ]);

    const code = await run(
      ['--dir', dir, '--json', '--phase-timeout-ms', '50'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(3);
    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('timeout');
    expect(sidecar!.exitReason).toMatch(/\(judge\)/);
  });

  // ─── Non-zero exit ────────────────────────────────────────

  it('implementer non-zero exit: escalates immediately, exit 2, phase NOT marked', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: nonZeroExitResult(1, 'auth: missing API key') },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(2);
    expect(calls).toHaveLength(1); // Judge never called

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('escalated');
    expect(sidecar!.exitReason).toMatch(/claude exited 1 on phase 1 attempt 1 \(implementer\)/);
    expect(sidecar!.exitReason).toContain('auth: missing API key');

    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).not.toMatch(/### Phase 1: Setup\s*✅/);
  });

  it('judge non-zero exit: escalates immediately, exit 2, phase NOT marked', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: okResult('impl ran') },
      { result: nonZeroExitResult(127, 'claude: command not found') },
    ]);

    const code = await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(code).toBe(2);
    expect(calls).toHaveLength(2);

    const sidecar = await readRunStatus(dir);
    expect(sidecar!.status).toBe('escalated');
    expect(sidecar!.exitReason).toMatch(/claude exited 127 on phase 1 attempt 1 \(judge\)/);

    const updated = readFileSync(join(dir, '00-master-plan.md'), 'utf-8');
    expect(updated).not.toMatch(/### Phase 1: Setup\s*✅/);
  });

  it('implementer prompt instructs fresh-feature fallback to direct master-plan read', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn, calls } = mockSpawnClaude([
      { result: okResult('working') },
      { result: okResult('<verdict>pass</verdict>') },
    ]);

    await run(
      ['--dir', dir, '--json'],
      { spawnClaude: fn, installSignalHandlers: false },
    );

    expect(calls[0].prompt).toMatch(/no checkpoint exists yet/);
    expect(calls[0].prompt).toMatch(/00-master-plan\.md/);
  });

  // ─── Sidecar transitions ──────────────────────────────────

  it('writes the initial planning sidecar before spawning anything', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    const { fn } = mockSpawnClaude([
      { result: okResult('working') },
      { result: okResult('<verdict>pass</verdict>') },
    ]);

    let snapshotAtFirstSpawn: string | null = null;
    const wrappedFn: SpawnClaudeFn = async (opts) => {
      if (snapshotAtFirstSpawn === null) {
        const s = await readRunStatus(dir);
        snapshotAtFirstSpawn = s?.status ?? null;
      }
      return fn(opts);
    };

    await run(
      ['--dir', dir, '--json'],
      { spawnClaude: wrappedFn, installSignalHandlers: false },
    );

    // At first spawn (implementer for phase 1), sidecar should be at 'implementing'.
    expect(snapshotAtFirstSpawn).toBe('implementing');
  });

  it('preserves runId across all sidecar writes within a run', async () => {
    const dir = createTempFeatureDir(SINGLE_PHASE_PLAN);
    tempDirs.push(dir);

    let collectedRunIds: string[] = [];
    const wrappedFn: SpawnClaudeFn = async (_opts) => {
      const s = await readRunStatus(dir);
      if (s) collectedRunIds.push(s.runId);
      // Alternate impl-then-judge
      const isImpl = collectedRunIds.length % 2 === 1;
      return isImpl ? okResult('working') : okResult('<verdict>pass</verdict>');
    };

    await run(
      ['--dir', dir, '--json'],
      {
        spawnClaude: wrappedFn,
        installSignalHandlers: false,
        newRunId: () => 'fixed-run-id-xyz',
      },
    );

    expect(collectedRunIds.length).toBeGreaterThan(0);
    for (const id of collectedRunIds) {
      expect(id).toBe('fixed-run-id-xyz');
    }

    const final = await readRunStatus(dir);
    expect(final!.runId).toBe('fixed-run-id-xyz');
  });

  // ─── Error paths ──────────────────────────────────────────

  it('fails fast when feature dir is not specified', async () => {
    const code = await run([], { installSignalHandlers: false });
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toMatch(/Could not resolve feature directory/);
  });

  it('fails when master plan is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-test-noplan-'));
    tempDirs.push(dir);

    const code = await run(
      ['--dir', dir, '--json'],
      { installSignalHandlers: false },
    );
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toMatch(/No master plan/);
  });
});
