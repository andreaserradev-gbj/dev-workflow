import { readdir } from 'fs/promises';
import { resolve } from 'path';
import type { Feature, FeatureDetail, SubPrd } from './types.js';
import {
  isSubPrdFile,
  parseCheckpoint,
  parseMasterPlan,
  parseSessionLog,
  parseSubPrd,
  subPrdToPhase,
} from './parser.js';

/**
 * Assemble the expanded detail view for a single feature: its checkpoint fields,
 * master-plan phases, sub-PRDs, and session log. Shared by the dashboard API and
 * the TUI detail pane so the assembly lives in exactly one place (keeps the jscpd
 * gate green — the dashboard route previously inlined this).
 *
 * - `featureDir` — resolved path to the feature's directory (under `.dev` or
 *   `.dev-archive`); the caller picks the subdir from `feature.status`.
 * - `feature` — the already-scanned summary the detail is layered on top of.
 * - `projectName` — the owning project's name.
 *
 * Missing or empty files degrade gracefully: the parsers are fault-tolerant, an
 * absent master plan yields no phases, and an unreadable dir yields no sub-PRDs.
 */
export async function buildFeatureDetail(
  featureDir: string,
  feature: Feature,
  projectName: string,
): Promise<FeatureDetail> {
  const masterPlan = await parseMasterPlan(resolve(featureDir, '00-master-plan.md'));
  const checkpoint = await parseCheckpoint(resolve(featureDir, 'checkpoint.md'));
  // parseSessionLog returns [] for missing or empty files (fault-tolerant);
  // collapse that to null so consumers can render "no history" cleanly.
  const sessionLog = await parseSessionLog(resolve(featureDir, 'session-log.md'));

  // Sub-PRDs: numbered NN-<slug>.md siblings of the master plan, in filename
  // order. Matches both the canonical NN-sub-prd-*.md naming and the bare
  // NN-<slug>.md form (see isSubPrdFile).
  const subPrds: SubPrd[] = [];
  try {
    const entries = await readdir(featureDir);
    const subPrdFiles = entries.filter(isSubPrdFile).sort();
    for (const file of subPrdFiles) {
      const result = await parseSubPrd(resolve(featureDir, file));
      if (result) subPrds.push(result);
    }
  } catch {
    // Feature dir not readable — subPrds stays empty
  }

  // Phase list: the master plan's Implementation Order headers, unless the
  // sub-PRDs enumerate more phases (the master + numbered-sub-PRD shape, where
  // the plan collapses/omits per-phase headers) — then the sub-PRDs are the
  // phases. Mirrors parseFeature so the summary card and detail pane agree.
  const planPhases = masterPlan?.phases ?? [];
  const subPrdPhases = subPrds.map(subPrdToPhase);
  const phases = subPrdPhases.length > planPhases.length ? subPrdPhases : planPhases;

  return {
    ...feature,
    project: projectName,
    checkpoint: checkpoint
      ? {
          nextAction: checkpoint.nextAction,
          decisions: checkpoint.decisions,
          blockers: checkpoint.blockers,
          notes: checkpoint.notes,
        }
      : null,
    phases,
    subPrds,
    sessionLog: sessionLog.length > 0 ? sessionLog : null,
  };
}
