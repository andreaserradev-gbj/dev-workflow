import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { mkdir, rm, readFile, readdir } from 'fs/promises';
import {
  readRunStatus,
  writeRunStatus,
  writeRunStatusSync,
  MAX_HISTORY,
  RUN_STATUS_FILENAME,
  TRUNCATION_SENTINEL_PHASE,
} from '../src/run-status.js';
import type { RunStatus, PhaseAttempt } from '../src/run-status.js';

const TMP_ROOT = resolve(__dirname, 'fixtures/_run_status_tmp');

let counter = 0;
async function makeTmpDir(): Promise<string> {
  const dir = join(TMP_ROOT, `t-${process.pid}-${++counter}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function baseStatus(overrides: Partial<RunStatus> = {}): RunStatus {
  const now = new Date().toISOString();
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    status: 'planning',
    currentPhase: null,
    attempt: 0,
    startedAt: now,
    updatedAt: now,
    lastVerdict: null,
    lastFeedback: null,
    exitReason: null,
    phaseHistory: [],
    ...overrides,
  };
}

function makeAttempt(phase: string, attempt: number): PhaseAttempt {
  const now = new Date().toISOString();
  return {
    phase,
    attempt,
    startedAt: now,
    finishedAt: now,
    verdict: 'pass',
    feedback: null,
    durationMs: 0,
  };
}

afterEach(async () => {
  try {
    await rm(TMP_ROOT, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('readRunStatus', () => {
  it('returns null when sidecar is missing', async () => {
    const dir = await makeTmpDir();
    const result = await readRunStatus(dir);
    expect(result).toBeNull();
  });

  it('throws when sidecar is malformed JSON', async () => {
    const dir = await makeTmpDir();
    const { writeFile } = await import('fs/promises');
    await writeFile(join(dir, RUN_STATUS_FILENAME), '{ not json', 'utf-8');
    await expect(readRunStatus(dir)).rejects.toThrow();
  });
});

describe('writeRunStatus round-trip', () => {
  it('preserves all fields including runId, exitReason, phaseHistory', async () => {
    const dir = await makeTmpDir();
    const input = baseStatus({
      runId: 'abcd1234-abcd-4cde-8efe-1234567890ab',
      status: 'done',
      currentPhase: '3',
      attempt: 2,
      lastVerdict: 'pass',
      lastFeedback: 'looks good',
      exitReason: 'all phases passed',
      phaseHistory: [makeAttempt('1', 1), makeAttempt('2', 1), makeAttempt('3', 2)],
    });

    await writeRunStatus(dir, input);
    const read = await readRunStatus(dir);

    expect(read).not.toBeNull();
    expect(read!.runId).toBe(input.runId);
    expect(read!.status).toBe(input.status);
    expect(read!.currentPhase).toBe(input.currentPhase);
    expect(read!.attempt).toBe(input.attempt);
    expect(read!.startedAt).toBe(input.startedAt);
    expect(read!.lastVerdict).toBe(input.lastVerdict);
    expect(read!.lastFeedback).toBe(input.lastFeedback);
    expect(read!.exitReason).toBe(input.exitReason);
    expect(read!.phaseHistory).toEqual(input.phaseHistory);
    // updatedAt is refreshed by writer; expect it to be a valid ISO string >= input.updatedAt
    expect(typeof read!.updatedAt).toBe('string');
    expect(Date.parse(read!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(input.startedAt));
  });

  it('refreshes updatedAt on every write', async () => {
    const dir = await makeTmpDir();
    const input = baseStatus();
    await writeRunStatus(dir, input);
    const first = await readRunStatus(dir);

    // small wait so timestamps differ
    await new Promise((r) => setTimeout(r, 5));

    await writeRunStatus(dir, { ...input, status: 'implementing' });
    const second = await readRunStatus(dir);

    expect(Date.parse(second!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first!.updatedAt));
  });

  it('preserves runId across writes (writer does not regenerate)', async () => {
    const dir = await makeTmpDir();
    const runId = 'fixed-run-id-1234';
    await writeRunStatus(dir, baseStatus({ runId, status: 'planning' }));
    await writeRunStatus(dir, baseStatus({ runId, status: 'implementing' }));
    await writeRunStatus(dir, baseStatus({ runId, status: 'done' }));

    const read = await readRunStatus(dir);
    expect(read!.runId).toBe(runId);
  });
});

describe('writeRunStatus phaseHistory append-and-trim', () => {
  it('keeps history under MAX_HISTORY by dropping oldest and prepending sentinel', async () => {
    const dir = await makeTmpDir();
    const big = baseStatus({
      phaseHistory: Array.from({ length: 250 }, (_, i) => makeAttempt(String(i), 1)),
    });

    await writeRunStatus(dir, big);
    const read = await readRunStatus(dir);

    // Expected: 1 sentinel + MAX_HISTORY most-recent entries
    expect(read!.phaseHistory.length).toBe(MAX_HISTORY + 1);

    const first = read!.phaseHistory[0];
    expect(first.phase).toBe(TRUNCATION_SENTINEL_PHASE);
    expect(first.feedback).toBe(`[${250 - MAX_HISTORY} earlier attempts truncated]`);

    // Newest entry preserved
    const last = read!.phaseHistory[read!.phaseHistory.length - 1];
    expect(last.phase).toBe('249');
  });

  it('does not trim or add sentinel when history is at the limit', async () => {
    const dir = await makeTmpDir();
    const exactly = baseStatus({
      phaseHistory: Array.from({ length: MAX_HISTORY }, (_, i) => makeAttempt(String(i), 1)),
    });

    await writeRunStatus(dir, exactly);
    const read = await readRunStatus(dir);

    expect(read!.phaseHistory.length).toBe(MAX_HISTORY);
    expect(read!.phaseHistory[0].phase).toBe('0');
    expect(read!.phaseHistory[0].phase).not.toBe(TRUNCATION_SENTINEL_PHASE);
  });
});

describe('writeRunStatus atomicity', () => {
  it('produces a parseable JSON file even under concurrent writes', async () => {
    const dir = await makeTmpDir();
    const a = baseStatus({ status: 'planning', runId: 'A' });
    const b = baseStatus({ status: 'implementing', runId: 'B' });

    // Fire many concurrent writes
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      promises.push(writeRunStatus(dir, i % 2 === 0 ? a : b));
    }
    await Promise.all(promises);

    const read = await readRunStatus(dir);
    expect(read).not.toBeNull();
    expect(['A', 'B']).toContain(read!.runId);

    // No leftover .tmp files (each writer cleans up its own; success path renames away)
    const entries = await readdir(dir);
    const tmps = entries.filter((e) => e.startsWith(RUN_STATUS_FILENAME + '.tmp'));
    expect(tmps).toEqual([]);
  });
});

describe('writeRunStatusSync', () => {
  it('produces an on-disk file equivalent to writeRunStatus for the same input', async () => {
    const dirAsync = await makeTmpDir();
    const dirSync = await makeTmpDir();

    // Fix updatedAt so async vs sync don't diverge by clock — we don't get to control
    // the writer's updatedAt; instead compare the structural fields after read.
    const input = baseStatus({
      runId: 'compare-async-sync',
      status: 'judging',
      currentPhase: '2',
      attempt: 1,
      lastVerdict: 'revise',
      lastFeedback: 'address X',
      phaseHistory: [makeAttempt('1', 1), makeAttempt('2', 1)],
    });

    await writeRunStatus(dirAsync, input);
    writeRunStatusSync(dirSync, input);

    const a = await readRunStatus(dirAsync);
    const s = await readRunStatus(dirSync);

    // Compare every field except updatedAt (clock)
    const stripUpdated = (r: RunStatus | null) => {
      if (!r) return r;
      const { updatedAt: _u, ...rest } = r;
      return rest;
    };
    expect(stripUpdated(a)).toEqual(stripUpdated(s));
  });

  it('cleans up tmp file on rename (sync path leaves no tmp behind on success)', async () => {
    const dir = await makeTmpDir();
    writeRunStatusSync(dir, baseStatus());
    const entries = await readdir(dir);
    const tmps = entries.filter((e) => e.startsWith(RUN_STATUS_FILENAME + '.tmp'));
    expect(tmps).toEqual([]);
    expect(entries).toContain(RUN_STATUS_FILENAME);
  });
});
