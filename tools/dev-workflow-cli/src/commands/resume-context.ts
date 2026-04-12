import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  parseFeature,
  parseCheckpoint,
  parseMasterPlan,
  parseSessionLog,
} from 'dev-workflow-core';
import type { SessionLogEntry } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

const execFileAsync = promisify(execFile);

type Validity = 'fresh' | 'stale' | 'drifted';

interface ResumeContextOutput {
  feature: {
    name: string;
    status: string;
    progress: { done: number; total: number; percent: number } | null;
    currentPhase: { number: number; total: number; title: string } | null;
  };
  checkpoint: {
    context: string | null;
    nextAction: string | null;
    decisions: string[];
    blockers: string[];
    notes: string[];
  };
  validity: Validity;
  validityDetails: {
    checkpointBranch: string | null;
    currentBranch: string;
    checkpointUncommitted: boolean | null;
    currentUncommitted: boolean;
  };
  currentPhasePrd: string | null;
  referenceFiles: string[];
  sessionHistory: SessionLogEntry[];
  accumulatedDecisions: string[];
}

/** Three-day staleness threshold in milliseconds. */
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Get the current git branch name. Returns empty string on error. */
async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['branch', '--show-current']);
    return stdout.trim();
  } catch {
    return '';
  }
}

/** Check if there are uncommitted changes. */
async function hasUncommittedChanges(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Compute validity based on branch match and checkpoint freshness. */
function computeValidity(
  checkpointBranch: string | null,
  currentBranch: string,
  checkpointDate: string | null,
): Validity {
  if (checkpointBranch && checkpointBranch !== currentBranch) {
    return 'drifted';
  }

  if (checkpointDate) {
    const ageMs = Date.now() - new Date(checkpointDate).getTime();
    if (ageMs >= THREE_DAYS_MS) {
      return 'stale';
    }
  }

  return 'fresh';
}

/**
 * Extract the current phase's PRD section from the master plan.
 * Finds "### Phase N:" heading and extracts from there to the next phase
 * heading or the "## File Changes Summary" heading.
 */
function extractCurrentPhasePrd(content: string, phaseNum: number): string | null {
  const normalized = content;

  // Find the start of the target phase section
  const phaseRegex = /^#{2,3}\s*Phase\s+(\d+)[:\s—–-]+\s*(.+)/gm;
  const headings: { number: number; index: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = phaseRegex.exec(normalized)) !== null) {
    headings.push({ number: parseInt(match[1], 10), index: match.index });
  }

  const targetHeading = headings.find((h) => h.number === phaseNum);
  if (!targetHeading) return null;

  // Find the end: next phase heading or "## File Changes Summary"
  const afterStart = normalized.slice(targetHeading.index);

  // Look for the next phase heading or File Changes Summary
  const endRegex = /^#{2,3}\s*(?:Phase\s+\d+|File Changes Summary)/gm;
  endRegex.lastIndex = 0;
  // Skip the first match (our own heading)
  let endMatch: RegExpExecArray | null;
  let endIdx = afterStart.length; // default to rest of file

  // Search in the content after the heading line
  const firstNewline = afterStart.indexOf('\n');
  const searchFrom = firstNewline >= 0 ? firstNewline + 1 : 0;

  endRegex.lastIndex = searchFrom;
  while ((endMatch = endRegex.exec(afterStart)) !== null) {
    endIdx = endMatch.index;
    break;
  }

  return afterStart.slice(0, endIdx).trim();
}

/**
 * Parse the "## Reference Files" section from the master plan.
 * Extracts file paths from lines like "- `path` — description" or "- path — description".
 */
function parseReferenceFiles(content: string): string[] {
  const refSection = content.match(/## Reference Files\s*\n([\s\S]*?)(?=\n##|\n$|$)/);
  if (!refSection) return [];

  const files: string[] = [];
  const lines = refSection[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match: - `path` — description  or  - path — description
    const pathMatch = trimmed.match(/^-\s+`?([^`—\n]+)`?\s*(?:—|-{1,2})\s*/);
    if (pathMatch) {
      files.push(pathMatch[1].trim());
    }
  }

  return files;
}

/** Deduplicate decisions by content equality, preserving insertion order. */
function deduplicateDecisions(allSessions: SessionLogEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const session of allSessions) {
    for (const decision of session.decisions) {
      if (!seen.has(decision)) {
        seen.add(decision);
        result.push(decision);
      }
    }
  }

  return result;
}

/**
 * CLI entry point for resume-context command.
 *
 * Accepts `--dir`, `--json`, `--sessions` flags (default --sessions=5, accepts "all").
 * Composes a single merged JSON response from feature, checkpoint, session-log,
 * master plan, and git state.
 */
export async function resumeContext(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  // Parse --sessions flag (default: 5, accepts "all")
  let maxSessions = 5;
  if (flags.sessions && typeof flags.sessions === 'string') {
    if (flags.sessions.toLowerCase() === 'all') {
      maxSessions = Infinity;
    } else {
      const parsed = parseInt(flags.sessions, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        maxSessions = parsed;
      }
    }
  }

  const featureName =
    (flags.feature as string | undefined) ?? featureDir.split('/').pop()!;

  // 1. Feature data
  const feature = await parseFeature(featureDir, featureName);

  // 2. Checkpoint data
  const checkpoint = await parseCheckpoint(resolve(featureDir, 'checkpoint.md'));

  // 3. Master plan (for currentPhasePrd and referenceFiles)
  const masterPlan = await parseMasterPlan(resolve(featureDir, '00-master-plan.md'));

  // 4. Session log
  const allSessions = await parseSessionLog(resolve(featureDir, 'session-log.md'));

  // 5. Git state
  const currentBranch = await getCurrentBranch();
  const currentUncommitted = await hasUncommittedChanges();

  // 6. Compute validity
  const validity = computeValidity(
    checkpoint?.branch ?? null,
    currentBranch,
    checkpoint?.checkpointed ?? null,
  );

  // 7. Extract current phase PRD section
  let currentPhasePrd: string | null = null;
  if (masterPlan && feature.currentPhase) {
    try {
      const masterContent = await readFile(
        resolve(featureDir, '00-master-plan.md'),
        'utf-8',
      );
      currentPhasePrd = extractCurrentPhasePrd(masterContent, feature.currentPhase.number);
    } catch {
      // Master plan file read failed — leave as null
    }
  }

  // 8. Parse reference files from master plan
  let referenceFiles: string[] = [];
  if (masterPlan) {
    try {
      const masterContent = await readFile(
        resolve(featureDir, '00-master-plan.md'),
        'utf-8',
      );
      referenceFiles = parseReferenceFiles(masterContent);
    } catch {
      // Leave empty
    }
  }

  // 9. Session history (last N sessions)
  const sessionHistory =
    maxSessions === Infinity
      ? allSessions
      : allSessions.slice(-maxSessions);

  // 10. Accumulated decisions (all sessions, deduplicated)
  const accumulatedDecisions = deduplicateDecisions(allSessions);

  const output: ResumeContextOutput = {
    feature: {
      name: feature.name,
      status: feature.status,
      progress: feature.progress,
      currentPhase: feature.currentPhase,
    },
    checkpoint: {
      context: checkpoint?.context ?? null,
      nextAction: checkpoint?.nextAction ?? null,
      decisions: checkpoint?.decisions ?? [],
      blockers: checkpoint?.blockers ?? [],
      notes: checkpoint?.notes ?? [],
    },
    validity,
    validityDetails: {
      checkpointBranch: checkpoint?.branch ?? null,
      currentBranch,
      checkpointUncommitted: checkpoint?.uncommittedChanges ?? null,
      currentUncommitted,
    },
    currentPhasePrd,
    referenceFiles,
    sessionHistory,
    accumulatedDecisions,
  };

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Text output — human-readable summary
    console.log(`Feature: ${feature.name}`);
    console.log(`Status: ${feature.status}`);
    if (feature.progress) {
      console.log(`Progress: ${feature.progress.done}/${feature.progress.total} (${feature.progress.percent}%)`);
    }
    if (feature.currentPhase) {
      console.log(`Current Phase: ${feature.currentPhase.number}/${feature.currentPhase.total} — ${feature.currentPhase.title}`);
    }
    console.log(`Validity: ${validity}`);
    if (checkpoint?.context) {
      console.log();
      console.log('Context:');
      console.log(checkpoint.context);
    }
    if (checkpoint?.nextAction) {
      console.log();
      console.log('Next Action:');
      console.log(checkpoint.nextAction);
    }
    if (accumulatedDecisions.length > 0) {
      console.log();
      console.log('Accumulated Decisions:');
      for (const d of accumulatedDecisions) {
        console.log(`  - ${d}`);
      }
    }
    if (sessionHistory.length > 0) {
      console.log();
      console.log(`Session History (${sessionHistory.length} sessions shown):`);
      for (const s of sessionHistory) {
        console.log(`  Session ${s.session} (${s.date}): ${s.context ?? '(no context)'}`);
      }
    }
    if (referenceFiles.length > 0) {
      console.log();
      console.log('Reference Files:');
      for (const f of referenceFiles) {
        console.log(`  - ${f}`);
      }
    }
  }

  return 0;
}