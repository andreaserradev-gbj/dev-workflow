import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { writeSessionDigest } from 'dev-workflow-core';
import type { SessionDigestWriteInput } from 'dev-workflow-core';
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

/** Read a JSON input file as a UTF-8 string. */
async function readInputFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Persist a composed session digest to session-digest.md (WRITE-only).
 * Separated from the CLI entry point for testability.
 */
export async function doSessionConsolidate(
  featureDir: string,
  inputData: SessionDigestWriteInput,
): Promise<{ success: boolean; file: string }> {
  const digestPath = resolve(featureDir, 'session-digest.md');
  await writeSessionDigest(digestPath, inputData);
  return { success: true, file: digestPath };
}

/**
 * CLI entry point for the session-consolidate command.
 *
 * WRITE-only: the /dev-checkpoint skill (the LLM) composes the two-tier digest
 * and hands it here as JSON; this command formats and persists it to
 * session-digest.md. The digest is never written into session-log.md, so the
 * `## Session N` counter is preserved.
 *
 * Accepts `--dir`, `--json`, `--stdin`, `--input-file <path>` flags. Reads the
 * SessionDigestWriteInput JSON from stdin (`--stdin`) or a file (`--input-file`).
 * Exactly one of the two must be provided. `--input-file` is preferred from
 * inside skills — it avoids the shell-escaping pitfalls of piping multi-line JSON.
 */
export async function sessionConsolidate(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const json = flags.json === true;
  const useStdin = flags.stdin === true;
  const inputFile = typeof flags['input-file'] === 'string' ? (flags['input-file'] as string) : null;

  const featureDir = resolveFeatureDir(flags);
  if (!featureDir) {
    console.error('Could not resolve feature directory. Use --dir <path> or --feature <name>.');
    return 1;
  }

  // Exactly one of --stdin or --input-file must be provided.
  if (useStdin && inputFile) {
    console.error('--stdin and --input-file are mutually exclusive. Pass exactly one.');
    return 1;
  }
  if (!useStdin && !inputFile) {
    console.error('Must pass either --stdin or --input-file <path> with SessionDigestWriteInput JSON.');
    return 1;
  }

  // Read JSON input from stdin or from the file on disk.
  let inputData: SessionDigestWriteInput;
  try {
    const raw = useStdin ? await readStdin() : await readInputFile(inputFile!);
    inputData = JSON.parse(raw);
  } catch (err) {
    const source = useStdin ? 'stdin' : `input file (${inputFile})`;
    console.error(`Failed to read ${source} JSON: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  // Validate required fields
  if (
    typeof inputData.aggregate !== 'string' ||
    typeof inputData.sessionCount !== 'number' ||
    typeof inputData.consolidatedThrough !== 'number'
  ) {
    console.error('Missing or invalid required fields: aggregate (string), sessionCount (number), consolidatedThrough (number)');
    return 1;
  }

  const result = await doSessionConsolidate(featureDir, inputData);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Session digest written to ${result.file}`);
  }

  return 0;
}
