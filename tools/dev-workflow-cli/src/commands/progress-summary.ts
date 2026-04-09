import { resolve } from 'path';
import { parseMasterPlan, parseSubPrd } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';
import { readdir } from 'fs/promises';

interface ProgressOutput {
  feature: string;
  overall: { done: number; total: number; percent: number };
  phases: Array<{ number: number; title: string; done: number; total: number; status: string }>;
  subPrds: Array<{ id: string; title: string; done: number; total: number; status: string }>;
}

export async function progressSummary(args: string[]): Promise<number> {
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

  // Collect sub-PRDs
  let entries: string[];
  try {
    entries = await readdir(featureDir);
  } catch {
    entries = [];
  }
  const subPrdFiles = entries.filter((e) => /^\d+-sub-prd-.*\.md$/.test(e)).sort();

  const subPrds: ProgressOutput['subPrds'] = [];
  for (const file of subPrdFiles) {
    const result = await parseSubPrd(resolve(featureDir, file));
    if (result) {
      subPrds.push({
        id: result.id,
        title: result.title,
        done: result.done,
        total: result.total,
        status: result.status,
      });
    }
  }

  // If master plan has no inline steps, aggregate from sub-PRDs, then phase counts
  let overall = masterPlan.progress;
  if (overall.total === 0 && subPrds.length > 0) {
    const done = subPrds.reduce((sum, s) => sum + s.done, 0);
    const total = subPrds.reduce((sum, s) => sum + s.total, 0);
    overall = { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  }
  if (overall.total === 0 && masterPlan.phases.length > 0) {
    const done = masterPlan.phases.filter((p) => p.status === 'complete').length;
    const total = masterPlan.phases.length;
    overall = { done, total, percent: Math.round((done / total) * 100) };
  }

  const output: ProgressOutput = {
    feature: featureName,
    overall,
    phases: masterPlan.phases.map((p) => ({
      number: p.number,
      title: p.title,
      done: p.done,
      total: p.total,
      status: p.status,
    })),
    subPrds,
  };

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Feature: ${featureName}`);
    console.log(`Overall: ${overall.done}/${overall.total} (${overall.percent}%)`);
    console.log();
    if (output.phases.length > 0) {
      console.log('Phases:');
      for (const p of output.phases) {
        const mark = p.status === 'complete' ? '[done]' : p.status === 'in-progress' ? '[active]' : '[pending]';
        console.log(`  ${p.number}. ${p.title} ${mark} (${p.done}/${p.total})`);
      }
    }
    if (output.subPrds.length > 0) {
      console.log();
      console.log('Sub-PRDs:');
      for (const s of output.subPrds) {
        const mark = s.status === 'complete' ? '[done]' : s.status === 'in-progress' ? '[active]' : '[pending]';
        console.log(`  ${s.id}: ${s.title} ${mark} (${s.done}/${s.total})`);
      }
    }
  }

  return 0;
}
