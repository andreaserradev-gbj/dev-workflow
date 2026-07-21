import { readdir } from 'fs/promises';
import { resolve } from 'path';
import type { Feature, FeatureDetail, SubPrd } from './types.js';
import type { SubPrdResult } from './parser.js';
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
  const subPrdResults: SubPrdResult[] = [];
  try {
    const entries = await readdir(featureDir);
    const subPrdFiles = entries.filter(isSubPrdFile).sort();
    for (const file of subPrdFiles) {
      const result = await parseSubPrd(resolve(featureDir, file));
      if (result) subPrdResults.push(result);
    }
  } catch {
    // Feature dir not readable — subPrds stays empty
  }

  // Phase list: the master plan's Implementation Order headers, unless the
  // sub-PRDs enumerate more phases (the master + numbered-sub-PRD shape, where
  // the plan collapses/omits per-phase headers) — then the sub-PRDs are the
  // phases. Mirrors parseFeature so the summary card and detail pane agree.
  const planPhases = masterPlan?.phases ?? [];
  const subPrdPhases = subPrdResults.map(subPrdToPhase);
  const subPrdsAuthoritative = subPrdPhases.length > planPhases.length;
  const phases = subPrdsAuthoritative ? subPrdPhases : planPhases;

  // Redundant-hybrid detection: the master plan owns the phases (the sub-PRDs
  // don't outnumber them) AND carries its own inline-step progress, yet the
  // sub-PRDs ALSO keep their own Implementation Progress tables. Nothing writes
  // those tables — status-update targets the master plan — so their done/total
  // counters are dead, frozen at whatever they were authored as. Mark them
  // non-authoritative so the renderers hide the misleading count and defer to
  // the sub-PRD's own `**Status**` header. The range shape (sub-PRDs
  // authoritative) and the stub-master shape (step-less master, progress.total
  // === 0) are both left untouched — their sub-PRD tables ARE the source.
  const redundantHybrid = !subPrdsAuthoritative && (masterPlan?.progress.total ?? 0) > 0;
  const subPrds: SubPrd[] = subPrdResults.map((r) => {
    const suppress = redundantHybrid && r.total > 0;
    return {
      id: r.id,
      title: r.title,
      done: r.done,
      total: r.total,
      status: suppress ? (r.headerStatus ?? r.status) : r.status,
      steps: r.steps,
      ...(suppress ? { countsAuthoritative: false } : {}),
    };
  });

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
