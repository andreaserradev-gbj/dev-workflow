import { resolve } from 'path';
import { readdir } from 'fs/promises';
import { isSubPrdFile, parseMasterPlan, updateStatus as coreUpdateStatus } from 'dev-workflow-core';
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
 * Resolve which PRD file holds the steps for a phase.
 *
 * The master plan owns the phase only when its `### Phase N` section carries
 * inline steps. A stub header that delegates to a sub-PRD (the master +
 * numbered-sub-PRD shape — a collapsed range, or a Goal+GATE pointer with no
 * steps) must NOT shadow the `NN-<slug>.md` sub-PRD file that actually holds the
 * steps, so those phases resolve to the sub-PRD file (which `updateStatus` then
 * edits via its Implementation Progress table). Falls back to the master plan
 * for phases it does own, or a clear "not found" error otherwise.
 */
async function resolveTargetPrd(featureDir: string, phaseNum: number): Promise<string | null> {
  const masterPlanPath = resolve(featureDir, '00-master-plan.md');
  const masterPlan = await parseMasterPlan(masterPlanPath);

  // Master plan owns the phase iff its `### Phase N` section has inline steps.
  if (masterPlan?.phases.some((p) => p.number === phaseNum && p.total > 0)) {
    return masterPlanPath;
  }

  // Otherwise prefer the sub-PRD file whose NN prefix matches the phase.
  try {
    const entries = await readdir(featureDir);
    const subPrdFiles = entries.filter(isSubPrdFile).sort();
    for (const file of subPrdFiles) {
      const numMatch = file.match(/^(\d+)/);
      if (numMatch && parseInt(numMatch[1], 10) === phaseNum) {
        return resolve(featureDir, file);
      }
    }
  } catch {
    // Directory read failed
  }

  // Final fallback: the master plan (a stub Phase N heading for a phase-level
  // marker, or a clear "not found" error from updateStatus).
  return masterPlan ? masterPlanPath : null;
}