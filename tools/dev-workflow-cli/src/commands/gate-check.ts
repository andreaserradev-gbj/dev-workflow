import { resolve } from 'path';
import { parseMasterPlan, parseSubPrdsAsPhases } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

interface GateOutput {
  feature: string;
  atGate: boolean;
  completedPhase: { number: number; title: string } | null;
  nextPhase: { number: number; title: string } | null;
  allComplete: boolean;
  gateContract?: string;
}

// Skills read gate state and act on it; the contract rides along so the
// expected stop behavior is stated at the moment of stopping, not recalled.
const GATE_CONTRACT =
  'GATE: deliver the recap first — impact, key choices, evidence (file:line + test names), gaps — then ask: continue to the next phase or /dev-checkpoint. External actions (push, PR, merge) stay with the user.';

export async function gateCheck(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  const featureName = flags.feature as string | undefined ?? featureDir.split('/').pop()!;
  const masterPlan = await parseMasterPlan(resolve(featureDir, '00-master-plan.md'));

  if (!masterPlan) {
    console.error(`No master plan found in ${featureDir}`);
    return 1;
  }

  // Use master plan phases; fall back to sub-PRDs when the master plan has no Phase headers
  let phases = masterPlan.phases;
  if (phases.length === 0) {
    phases = await parseSubPrdsAsPhases(featureDir);
  }
  const allComplete = phases.length > 0 && phases.every((p) => p.status === 'complete');
  const hasCompleted = phases.some((p) => p.status === 'complete');
  const hasNotStarted = phases.some((p) => p.status === 'not-started');
  const hasInProgress = phases.some((p) => p.status === 'in-progress');
  const atGate = !allComplete && hasCompleted && hasNotStarted && !hasInProgress;

  // Find the last completed phase and the next not-started phase
  let completedPhase: GateOutput['completedPhase'] = null;
  let nextPhase: GateOutput['nextPhase'] = null;

  if (atGate) {
    const completedPhases = phases.filter((p) => p.status === 'complete');
    const last = completedPhases[completedPhases.length - 1];
    completedPhase = { number: last.number, title: last.title };

    const next = phases.find((p) => p.status === 'not-started');
    if (next) {
      nextPhase = { number: next.number, title: next.title };
    }
  }

  const output: GateOutput = { feature: featureName, atGate, completedPhase, nextPhase, allComplete };
  if (atGate) {
    output.gateContract = GATE_CONTRACT;
  }

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Feature: ${featureName}`);
    if (allComplete) {
      console.log('All phases complete.');
    } else if (atGate) {
      console.log(`AT GATE: Phase ${completedPhase!.number} (${completedPhase!.title}) complete.`);
      console.log(`Next: Phase ${nextPhase!.number} (${nextPhase!.title})`);
      console.log(GATE_CONTRACT);
    } else {
      console.log('Not at a gate.');
      const active = phases.find((p) => p.status === 'in-progress');
      if (active) {
        console.log(`In progress: Phase ${active.number} (${active.title})`);
      }
    }
  }

  return 0;
}
