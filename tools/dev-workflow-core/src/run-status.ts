import {
  readFile as readFileAsync,
  writeFile as writeFileAsync,
  rename as renameAsync,
  unlink as unlinkAsync,
} from 'fs/promises';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { RunStatus, PhaseAttempt } from './types.js';

export type { RunStatus, RunStatusValue, PhaseAttempt, Verdict } from './types.js';

export const RUN_STATUS_FILENAME = '.run-status.json';
export const MAX_HISTORY = 200;
export const TRUNCATION_SENTINEL_PHASE = '__truncated__';

function sidecarPath(featureDir: string): string {
  return join(featureDir, RUN_STATUS_FILENAME);
}

function tmpSidecarPath(featureDir: string): string {
  // Unique suffix per write so concurrent writers don't clobber each other's tmp files.
  const suffix = randomBytes(6).toString('hex');
  return join(featureDir, `${RUN_STATUS_FILENAME}.tmp.${process.pid}.${suffix}`);
}

function prepareForWrite(status: RunStatus): RunStatus {
  const updated: RunStatus = {
    ...status,
    updatedAt: new Date().toISOString(),
    phaseHistory: status.phaseHistory.slice(),
  };

  if (updated.phaseHistory.length > MAX_HISTORY) {
    const overflow = updated.phaseHistory.length - MAX_HISTORY;
    const kept = updated.phaseHistory.slice(overflow);
    const sentinel: PhaseAttempt = {
      phase: TRUNCATION_SENTINEL_PHASE,
      attempt: 0,
      startedAt: updated.updatedAt,
      finishedAt: updated.updatedAt,
      verdict: null,
      feedback: `[${overflow} earlier attempts truncated]`,
      durationMs: null,
    };
    updated.phaseHistory = [sentinel, ...kept];
  }

  return updated;
}

function serialize(status: RunStatus): string {
  return JSON.stringify(status, null, 2) + '\n';
}

export async function readRunStatus(
  featureDir: string,
): Promise<RunStatus | null> {
  let raw: string;
  try {
    raw = await readFileAsync(sidecarPath(featureDir), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return JSON.parse(raw) as RunStatus;
}

export async function writeRunStatus(
  featureDir: string,
  status: RunStatus,
): Promise<void> {
  const prepared = prepareForWrite(status);
  const final = sidecarPath(featureDir);
  const tmp = tmpSidecarPath(featureDir);
  const payload = serialize(prepared);

  try {
    await writeFileAsync(tmp, payload, 'utf-8');
    await renameAsync(tmp, final);
  } catch (err) {
    try {
      await unlinkAsync(tmp);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

export function writeRunStatusSync(
  featureDir: string,
  status: RunStatus,
): void {
  const prepared = prepareForWrite(status);
  const final = sidecarPath(featureDir);
  const tmp = tmpSidecarPath(featureDir);
  const payload = serialize(prepared);

  try {
    writeFileSync(tmp, payload, 'utf-8');
    renameSync(tmp, final);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}
