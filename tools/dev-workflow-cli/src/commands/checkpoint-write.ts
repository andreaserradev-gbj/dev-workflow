import { resolve } from 'path';
import { readFile, appendFile } from 'fs/promises';
import { parseCheckpoint, writeCheckpoint } from 'dev-workflow-core';
import type { CheckpointWriteInput } from 'dev-workflow-core';
import { resolveFeatureDir } from '../resolve.js';
import { parseFlags } from '../index.js';

/** Read all of stdin as a string. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/** Format an existing checkpoint as a session-log entry. */
async function formatSessionEntry(
  checkpoint: {
    checkpointed: string | null;
    context: string | null;
    decisions: string[];
    blockers: string[];
    notes: string[];
  },
  sessionLogPath: string,
): Promise<string> {
  // Count existing session headings to determine N
  let sessionCount = 0;
  try {
    const existing = await readFile(sessionLogPath, 'utf-8');
    const sessionHeadings = existing.match(/^## Session\s+\d+/gm);
    sessionCount = sessionHeadings ? sessionHeadings.length : 0;
  } catch {
    // File doesn't exist yet — start at 0
  }

  const n = sessionCount + 1;
  const timestamp = checkpoint.checkpointed ?? new Date().toISOString();

  let entry = `\n## Session ${n} — ${timestamp}\n\n`;

  if (checkpoint.context) {
    entry += `<context>\n${checkpoint.context}\n</context>\n\n`;
  }

  if (checkpoint.decisions && checkpoint.decisions.length > 0) {
    entry += `<decisions>\n`;
    for (const d of checkpoint.decisions) {
      entry += `- ${d}\n`;
    }
    entry += `</decisions>\n\n`;
  }

  if (checkpoint.blockers && checkpoint.blockers.length > 0) {
    entry += `<blockers>\n`;
    for (const b of checkpoint.blockers) {
      entry += `- ${b}\n`;
    }
    entry += `</blockers>\n\n`;
  }

  if (checkpoint.notes && checkpoint.notes.length > 0) {
    entry += `<notes>\n`;
    for (const n of checkpoint.notes) {
      entry += `- ${n}\n`;
    }
    entry += `</notes>\n\n`;
  }

  entry += `---\n`;

  return entry;
}

/**
 * Write a checkpoint and optionally append the previous checkpoint to session-log.
 * Separated from CLI entry point for testability.
 */
export async function doCheckpointWrite(
  featureDir: string,
  inputData: CheckpointWriteInput,
): Promise<{ success: boolean; file: string }> {
  const checkpointPath = resolve(featureDir, 'checkpoint.md');
  const sessionLogPath = resolve(featureDir, 'session-log.md');

  // Before writing: read existing checkpoint and append to session-log.md
  const existingCheckpoint = await parseCheckpoint(checkpointPath);
  if (existingCheckpoint) {
    const sessionEntry = await formatSessionEntry(existingCheckpoint, sessionLogPath);
    await appendFile(sessionLogPath, sessionEntry, 'utf-8');
  }

  // Write the new checkpoint
  await writeCheckpoint(checkpointPath, inputData);

  return { success: true, file: checkpointPath };
}

/**
 * CLI entry point for checkpoint-write command.
 *
 * Accepts `--dir`, `--json`, `--stdin` flags.
 * Reads CheckpointWriteInput JSON from stdin when --stdin is provided.
 */
export async function checkpointWrite(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;
  const useStdin = flags.stdin === true;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  // --stdin is required — checkpoint data must be piped as JSON
  if (!useStdin) {
    console.error('--stdin flag is required. Pipe CheckpointWriteInput JSON via stdin.');
    return 1;
  }

  // Read JSON input from stdin
  let inputData: CheckpointWriteInput;
  try {
    const stdinContent = await readStdin();
    inputData = JSON.parse(stdinContent);
  } catch (err) {
    console.error(`Failed to parse stdin JSON: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  // Validate required fields
  if (!inputData.context || !inputData.currentState || !inputData.nextAction || !inputData.keyFiles) {
    console.error('Missing required fields: context, currentState, nextAction, keyFiles');
    return 1;
  }

  const result = await doCheckpointWrite(featureDir, inputData);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Checkpoint written to ${result.file}`);
  }

  return 0;
}