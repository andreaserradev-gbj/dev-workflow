import { resolve } from 'path';
import { parseCheckpoint } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

export async function checkpointRead(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  const checkpoint = await parseCheckpoint(resolve(featureDir, 'checkpoint.md'));

  if (!checkpoint) {
    console.error(`No checkpoint found in ${featureDir}`);
    return 1;
  }

  if (json) {
    console.log(JSON.stringify(checkpoint, null, 2));
  } else {
    if (checkpoint.branch) console.log(`Branch: ${checkpoint.branch}`);
    if (checkpoint.lastCommit) console.log(`Last commit: ${checkpoint.lastCommit}`);
    if (checkpoint.uncommittedChanges !== null) console.log(`Uncommitted: ${checkpoint.uncommittedChanges}`);
    if (checkpoint.checkpointed) console.log(`Checkpointed: ${checkpoint.checkpointed}`);
    if (checkpoint.context) {
      console.log();
      console.log('Context:');
      console.log(checkpoint.context);
    }
    if (checkpoint.currentState) {
      console.log();
      console.log('Current state:');
      console.log(checkpoint.currentState);
    }
    if (checkpoint.nextAction) {
      console.log();
      console.log('Next action:');
      console.log(checkpoint.nextAction);
    }
    if (checkpoint.keyFiles) {
      console.log();
      console.log('Key files:');
      console.log(checkpoint.keyFiles);
    }
    if (checkpoint.prdFiles.length > 0) {
      console.log();
      console.log('PRD files:');
      for (const f of checkpoint.prdFiles) console.log(`  ${f}`);
    }
    if (checkpoint.continuationPrompt) {
      console.log();
      console.log('Continuation:');
      console.log(checkpoint.continuationPrompt);
    }
    if (checkpoint.decisions.length > 0) {
      console.log();
      console.log('Decisions:');
      for (const d of checkpoint.decisions) console.log(`  - ${d}`);
    }
    if (checkpoint.blockers.length > 0) {
      console.log();
      console.log('Blockers:');
      for (const b of checkpoint.blockers) console.log(`  - ${b}`);
    }
    if (checkpoint.notes.length > 0) {
      console.log();
      console.log('Notes:');
      for (const n of checkpoint.notes) console.log(`  - ${n}`);
    }
  }

  return 0;
}
