import { resolve } from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import {
  parseMasterPlan,
  parseVerdict,
  parseFeedback,
  updateStatus,
  writeRunStatus,
  writeRunStatusSync,
} from 'dev-workflow-core';
import type {
  Phase,
  Verdict,
  RunStatus,
  PhaseAttempt,
} from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

// ─── Subprocess types ─────────────────────────────────────────────

export interface SpawnClaudeOpts {
  prompt: string;
  timeoutMs: number;
  cwd: string;
}

export interface SpawnClaudeResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export type SpawnClaudeFn = (opts: SpawnClaudeOpts) => Promise<SpawnClaudeResult>;

/** Tracks the currently in-flight subprocess so the SIGINT handler can kill
 * its process group before the orchestrator exits. Mutated by the default
 * spawn implementation; remains null when tests inject a mock. */
interface ActiveSpawn {
  pid: number | null;
}

export interface RunDeps {
  spawnClaude?: SpawnClaudeFn;
  now?: () => Date;
  newRunId?: () => string;
  /** Override for test isolation: skip real SIGINT/SIGTERM handler installation. */
  installSignalHandlers?: boolean;
}

const STDOUT_CAP_BYTES = 4 * 1024 * 1024;
const STDOUT_TRUNCATE_SENTINEL = '\n…[stdout truncated at 4MB]…\n';
const SIGTERM_GRACE_MS = 5000;
const DEFAULT_RETRY_CAP = 2;
const DEFAULT_PHASE_TIMEOUT_MS = 30 * 60_000;

// ─── Default subprocess implementation ────────────────────────────

function makeDefaultSpawnClaude(active: ActiveSpawn): SpawnClaudeFn {
  return ({ prompt, timeoutMs, cwd }) =>
  new Promise((resolveP) => {
    // detached: true puts the child in its own process group so we can kill the
    // entire group on timeout — otherwise grandchildren (e.g. bash → sleep)
    // keep stdio pipes open and the 'close' event never fires.
    const proc = spawn('claude', ['-p', prompt], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    active.pid = proc.pid ?? null;

    const killGroup = (signal: NodeJS.Signals) => {
      // proc.pid can be undefined briefly if spawn errored before fork
      if (proc.pid === undefined) return;
      try {
        // Negative pid → kill the whole group, not just the leader.
        process.kill(-proc.pid, signal);
      } catch {
        // Group may already be dead; fall back to direct kill as a best effort.
        try { proc.kill(signal); } catch { /* ignore */ }
      }
    };

    let stdoutBuf = Buffer.alloc(0);
    let stderrBuf = Buffer.alloc(0);
    let stdoutTruncated = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;

    const timeout = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      killTimer = setTimeout(() => {
        killGroup('SIGKILL');
      }, SIGTERM_GRACE_MS);
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => {
      if (stdoutBuf.length >= STDOUT_CAP_BYTES) {
        stdoutTruncated = true;
        return;
      }
      const room = STDOUT_CAP_BYTES - stdoutBuf.length;
      stdoutBuf = Buffer.concat([stdoutBuf, chunk.subarray(0, room)]);
      if (chunk.length > room) stdoutTruncated = true;
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      // Bounded stderr too — don't blow memory if the child rage-logs.
      if (stderrBuf.length < STDOUT_CAP_BYTES) {
        const room = STDOUT_CAP_BYTES - stderrBuf.length;
        stderrBuf = Buffer.concat([stderrBuf, chunk.subarray(0, room)]);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      active.pid = null;
      resolveP({
        stdout: stdoutBuf.toString('utf-8'),
        stderr: (err.message ?? '') + '\n' + stderrBuf.toString('utf-8'),
        exitCode: null,
        timedOut,
      });
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      active.pid = null;
      let stdout = stdoutBuf.toString('utf-8');
      if (stdoutTruncated) stdout += STDOUT_TRUNCATE_SENTINEL;
      resolveP({
        stdout,
        stderr: stderrBuf.toString('utf-8'),
        exitCode: code,
        timedOut,
      });
    });
  });
}

// ─── Prompt builders ──────────────────────────────────────────────

function implementerPrompt(featureName: string, phaseId: string, feedback: string | null): string {
  const feedbackBlock = feedback
    ? `\n\n   The previous attempt was rejected with this feedback — address it specifically:\n\n${feedback}\n`
    : '';
  return `You are continuing the dev-workflow feature \`${featureName}\`.

1. Run the \`/dev-resume\` skill on this feature to load context from disk.
2. Implement the phase whose ID is \`${phaseId}\` from the master plan.${feedbackBlock}
3. When the phase is implemented and verified, run \`/dev-checkpoint\` to persist state.

Do NOT advance the phase status marker yourself. The orchestrator will mark it ✅ after review.`;
}

function judgePrompt(featureName: string, phaseId: string): string {
  return `You are reviewing the most recent phase of dev-workflow feature \`${featureName}\` (phase \`${phaseId}\`).

Run \`/dev-judge\` on this feature. Your final output MUST be exactly one \`<verdict>\` XML block as defined by the dev-judge skill — no other text after it.`;
}

// ─── Phase iteration helpers ──────────────────────────────────────

function pendingPhases(phases: Phase[]): Phase[] {
  return phases.filter((p) => p.status !== 'complete');
}

async function markPhaseCompleted(featureDir: string, phaseNum: number): Promise<void> {
  const masterPlanPath = resolve(featureDir, '00-master-plan.md');
  await updateStatus(masterPlanPath, { phase: phaseNum }, '✅');
}

// ─── Run command ──────────────────────────────────────────────────

export async function run(args: string[], deps: RunDeps = {}): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;
  const dryRun = flags['dry-run'] === true || flags.dryRun === true;
  const maxPhases = numberFlag(flags, 'max-phases', Infinity);
  const phaseTimeoutMs = numberFlag(flags, 'phase-timeout-ms', DEFAULT_PHASE_TIMEOUT_MS);
  const retryCap = numberFlag(flags, 'retry-cap', DEFAULT_RETRY_CAP);

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  const featureName =
    (typeof flags.feature === 'string' ? flags.feature : null) ??
    featureDir.split('/').filter(Boolean).pop()!;

  const masterPlanPath = resolve(featureDir, '00-master-plan.md');
  const masterPlan = await parseMasterPlan(masterPlanPath);
  if (!masterPlan) {
    console.error(`No master plan at ${masterPlanPath}.`);
    return 1;
  }

  const allPending = pendingPhases(masterPlan.phases);
  const planned = allPending.slice(0, maxPhases === Infinity ? allPending.length : maxPhases);

  if (planned.length === 0) {
    if (json) {
      console.log(JSON.stringify({ status: 'noop', reason: 'all phases complete', planned: [] }, null, 2));
    } else {
      console.log('All phases complete — nothing to run.');
    }
    return 0;
  }

  if (dryRun) {
    const out = {
      feature: featureName,
      featureDir,
      planned: planned.map((p) => ({ number: p.number, title: p.title, status: p.status })),
      retryCap,
      phaseTimeoutMs,
    };
    if (json) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`Feature: ${featureName}`);
      console.log(`Planned phases (${planned.length}):`);
      for (const p of planned) {
        console.log(`  Phase ${p.number}: ${p.title} [${p.status}]`);
      }
      console.log(`Retry cap: ${retryCap}, phase timeout: ${phaseTimeoutMs}ms`);
    }
    return 0;
  }

  const active: ActiveSpawn = { pid: null };
  const spawnClaude = deps.spawnClaude ?? makeDefaultSpawnClaude(active);
  const now = deps.now ?? (() => new Date());
  const newRunId = deps.newRunId ?? randomUUID;
  const installSignals = deps.installSignalHandlers ?? true;

  const runId = newRunId();
  const startedAtIso = now().toISOString();

  let lastKnownStatus: RunStatus = {
    runId,
    status: 'planning',
    currentPhase: null,
    attempt: 0,
    startedAt: startedAtIso,
    updatedAt: startedAtIso,
    lastVerdict: null,
    lastFeedback: null,
    exitReason: null,
    phaseHistory: [],
  };
  await writeRunStatus(featureDir, lastKnownStatus);

  // Signal handler: write final coherent snapshot synchronously, then exit.
  // Async writes don't reliably flush before SIGINT exit, so we mirror to *Sync.
  let signalCleanup: (() => void) | null = null;
  if (installSignals) {
    const onSignal = (signal: NodeJS.Signals) => {
      // Take the whole detached subprocess group with us — otherwise
      // a `claude -p` (or anything it spawned) is left orphaned.
      if (active.pid !== null) {
        try { process.kill(-active.pid, 'SIGTERM'); } catch { /* already gone */ }
      }
      try {
        writeRunStatusSync(featureDir, {
          ...lastKnownStatus,
          status: 'idle',
          exitReason: `${signal} received`,
          updatedAt: now().toISOString(),
        });
      } catch {
        /* best effort — process is dying */
      }
      // Default exit code for SIGINT is 130, SIGTERM 143.
      process.exit(signal === 'SIGINT' ? 130 : 143);
    };
    const sigint = () => onSignal('SIGINT');
    const sigterm = () => onSignal('SIGTERM');
    process.on('SIGINT', sigint);
    process.on('SIGTERM', sigterm);
    signalCleanup = () => {
      process.off('SIGINT', sigint);
      process.off('SIGTERM', sigterm);
    };
  }

  try {
    for (const phase of planned) {
      const phaseId = String(phase.number);
      let attempt = 0;
      let feedback: string | null = null;
      let phaseDone = false;

      while (attempt < retryCap + 1) {
        attempt++;
        const attemptStartedAt = now().toISOString();

        // ── Implementer ──
        lastKnownStatus = {
          ...lastKnownStatus,
          status: 'implementing',
          currentPhase: phaseId,
          attempt,
          lastFeedback: feedback,
        };
        await writeRunStatus(featureDir, lastKnownStatus);

        const implResult = await spawnClaude({
          prompt: implementerPrompt(featureName, phaseId, feedback),
          timeoutMs: phaseTimeoutMs,
          cwd: process.cwd(),
        });

        if (implResult.timedOut) {
          const reason = `timeout (${phaseTimeoutMs}ms) on phase ${phaseId} attempt ${attempt} (implementer)`;
          await recordTerminal(featureDir, lastKnownStatus, 'timeout', reason, now);
          return 3;
        }

        // ── Judge ──
        lastKnownStatus = { ...lastKnownStatus, status: 'judging' };
        await writeRunStatus(featureDir, lastKnownStatus);

        const judgeResult = await spawnClaude({
          prompt: judgePrompt(featureName, phaseId),
          timeoutMs: phaseTimeoutMs,
          cwd: process.cwd(),
        });

        if (judgeResult.timedOut) {
          const reason = `timeout (${phaseTimeoutMs}ms) on phase ${phaseId} attempt ${attempt} (judge)`;
          await recordTerminal(featureDir, lastKnownStatus, 'timeout', reason, now);
          return 3;
        }

        const verdict: Verdict | null = parseVerdict(judgeResult.stdout);
        const fb = parseFeedback(judgeResult.stdout);
        const finishedAt = now().toISOString();

        const attemptRecord: PhaseAttempt = {
          phase: phaseId,
          attempt,
          startedAt: attemptStartedAt,
          finishedAt,
          verdict,
          feedback: fb,
          durationMs: Date.parse(finishedAt) - Date.parse(attemptStartedAt),
        };

        lastKnownStatus = {
          ...lastKnownStatus,
          lastVerdict: verdict,
          lastFeedback: fb,
          phaseHistory: [...lastKnownStatus.phaseHistory, attemptRecord],
        };
        await writeRunStatus(featureDir, lastKnownStatus);

        if (verdict === 'pass') {
          await markPhaseCompleted(featureDir, phase.number);
          phaseDone = true;
          break;
        }

        if (verdict === 'revise' && attempt < retryCap + 1) {
          feedback = fb;
          continue;
        }

        // Terminal: escalate, no-verdict, or retry cap exceeded.
        const reason =
          verdict === 'escalate'
            ? `judge escalated on phase ${phaseId} attempt ${attempt}`
            : verdict === null
              ? `no verdict block on phase ${phaseId} attempt ${attempt}`
              : `retry cap (${retryCap}) exceeded on phase ${phaseId}`;
        await recordTerminal(featureDir, lastKnownStatus, 'escalated', reason, now);
        return 2;
      }

      if (!phaseDone) {
        // Defensive: should be unreachable — the inner loop returns on terminal.
        const reason = `phase ${phaseId} ended without a terminal verdict`;
        await recordTerminal(featureDir, lastKnownStatus, 'escalated', reason, now);
        return 2;
      }
    }

    lastKnownStatus = {
      ...lastKnownStatus,
      status: 'done',
      currentPhase: null,
      exitReason: 'all phases passed',
      updatedAt: now().toISOString(),
    };
    await writeRunStatus(featureDir, lastKnownStatus);

    if (json) {
      console.log(JSON.stringify({ status: 'done', phases: planned.length }, null, 2));
    } else {
      console.log(`Done — ${planned.length} phase(s) completed.`);
    }
    return 0;
  } finally {
    if (signalCleanup) signalCleanup();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

async function recordTerminal(
  featureDir: string,
  status: RunStatus,
  terminal: 'escalated' | 'timeout',
  reason: string,
  now: () => Date,
): Promise<void> {
  const final: RunStatus = {
    ...status,
    status: terminal,
    exitReason: reason,
    updatedAt: now().toISOString(),
  };
  await writeRunStatus(featureDir, final);
}

function numberFlag(
  flags: Record<string, string | true>,
  name: string,
  fallback: number,
): number {
  const v = flags[name];
  if (typeof v !== 'string') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
