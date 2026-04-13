import { parseFeature } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

export async function featureShow(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  const featureName = flags.feature as string | undefined ?? featureDir.split('/').pop()!;
  const feature = await parseFeature(featureDir, featureName);

  if (json) {
    console.log(JSON.stringify(feature, null, 2));
  } else {
    console.log(`Feature: ${feature.name}`);
    console.log(`Status:  ${feature.status}`);
    if (feature.progress) {
      console.log(`Progress: ${feature.progress.done}/${feature.progress.total} (${feature.progress.percent}%)`);
    }
    if (feature.currentPhase) {
      console.log(`Phase:   ${feature.currentPhase.number}/${feature.currentPhase.total} — ${feature.currentPhase.title}`);
    }
    if (feature.lastCheckpoint) {
      console.log(`Checkpoint: ${feature.lastCheckpoint}`);
    }
    if (feature.nextAction) {
      console.log(`Next: ${feature.nextAction}`);
    }
    if (feature.summary) {
      console.log(`Summary: ${feature.summary}`);
    }
  }

  return 0;
}
