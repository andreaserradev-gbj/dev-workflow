import { resolve } from 'path';
import { readdir } from 'fs/promises';
import { updateStatus as coreUpdateStatus } from 'dev-workflow-core';
import type { StepTarget, StatusMarker, StatusUpdateResult } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

/** Map CLI-friendly marker names to emoji values. */
const MARKER_MAP: Record<string, StatusMarker> = {
  done: '✅',
  todo: '⬜',
};

/**
 * CLI entry point for status-update command.
 *
 * Accepts `--dir`, `--phase`, `--step`, `--marker` flags.
 * `--marker` accepts `done` (→ ✅) or `todo` (→ ⬜).
 * Resolves target PRD file from feature dir, then calls updateStatus() from core.
 */
export async function statusUpdate(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  // Required: --phase
  const phase = flags.phase;
  if (!phase || typeof phase !== 'string') {
    console.error('--phase <number> is required.');
    return 1;
  }
  const phaseNum = parseInt(phase, 10);
  if (isNaN(phaseNum) || phaseNum < 1) {
    console.error('--phase must be a positive integer.');
    return 1;
  }

  // Optional: --step (omit for phase-level marker)
  let stepNum: number | undefined;
  if (flags.step && typeof flags.step === 'string') {
    stepNum = parseInt(flags.step, 10);
    if (isNaN(stepNum) || stepNum < 1) {
      console.error('--step must be a positive integer.');
      return 1;
    }
  }

  // Required: --marker
  const markerInput = flags.marker;
  if (!markerInput || typeof markerInput !== 'string') {
    console.error('--marker <done|todo> is required.');
    return 1;
  }
  const marker = MARKER_MAP[markerInput.toLowerCase()];
  if (!marker) {
    console.error(`Invalid --marker value "${markerInput}". Use "done" or "todo".`);
    return 1;
  }

  // Resolve target PRD file
  const targetFile = await resolveTargetPrd(featureDir, phaseNum);
  if (!targetFile) {
    console.error(`Could not find Phase ${phaseNum} in any PRD file under ${featureDir}`);
    return 1;
  }

  const target: StepTarget = { phase: phaseNum, step: stepNum };

  let result: StatusUpdateResult;
  try {
    result = await coreUpdateStatus(targetFile, target, marker);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const stepText = stepNum ? ` step ${stepNum}` : '';
    if (result.changed) {
      console.log(
        `Phase ${phaseNum}${stepText} marked ${markerInput.toLowerCase()} in ${result.file} (line ${result.line})`,
      );
    } else {
      console.log(
        `Phase ${phaseNum}${stepText} already ${markerInput.toLowerCase()} in ${result.file} (line ${result.line})`,
      );
    }
  }

  return 0;
}

/**
 * Resolve which PRD file contains the target phase.
 *
 * Scans `00-master-plan.md` first (primary), then `NN-sub-prd-*.md` files
 * by filename prefix matching.
 */
async function resolveTargetPrd(featureDir: string, phaseNum: number): Promise<string | null> {
  const masterPlanPath = resolve(featureDir, '00-master-plan.md');

  // Check master plan first — it contains `### Phase N:` headers
  try {
    const { readFile } = await import('fs/promises');
    const content = await readFile(masterPlanPath, 'utf-8');
    const phaseRegex = /#{2,3}\s*Phase\s+(\d+)/i;
    let found = false;
    let match: RegExpExecArray | null;
    const regex = new RegExp(phaseRegex.source, 'gi');
    while ((match = regex.exec(content)) !== null) {
      if (parseInt(match[1], 10) === phaseNum) {
        found = true;
        break;
      }
    }
    if (found) return masterPlanPath;
  } catch {
    // Master plan doesn't exist — fall through to sub-PRDs
  }

  // Fall back to sub-PRDs: filename prefix NN maps to phase NN
  try {
    const entries = await readdir(featureDir);
    const subPrdFiles = entries.filter((e) => /^\d+-sub-prd-.*\.md$/.test(e)).sort();
    for (const file of subPrdFiles) {
      const numMatch = file.match(/^(\d+)/);
      if (numMatch && parseInt(numMatch[1], 10) === phaseNum) {
        return resolve(featureDir, file);
      }
    }
  } catch {
    // Directory read failed
  }

  // Final fallback: if master plan exists but no Phase N header, still try it
  // (updateStatus will throw a clear error if phase not found)
  try {
    const { access } = await import('fs/promises');
    await access(masterPlanPath);
    return masterPlanPath;
  } catch {
    return null;
  }
}