import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sessionConsolidate, doSessionConsolidate } from '../src/commands/session-consolidate.js';
import { parseSessionDigest } from 'dev-workflow-core';

function captureOutput() {
  const lines: string[] = [];
  const errorLines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => errorLines.push(args.map(String).join(' '));
  return {
    lines,
    errorLines,
    restore() {
      console.log = origLog;
      console.error = origErr;
    },
  };
}

function createTempFeatureDir(): string {
  return mkdtempSync(join(tmpdir(), 'sc-test-'));
}

describe('session-consolidate', () => {
  let output: ReturnType<typeof captureOutput>;
  let tempDirs: string[];

  beforeEach(() => {
    output = captureOutput();
    tempDirs = [];
  });

  afterEach(() => {
    output.restore();
    for (const dir of tempDirs) {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('writes a digest and parses back identically (doSessionConsolidate)', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const result = await doSessionConsolidate(dir, {
      sessionCount: 12,
      consolidatedThrough: 7,
      generated: '2026-05-12T11:00:00.000Z',
      aggregate: 'Sessions 1–7 established the provider registry and token storage.',
      decisions: ['OAuth2 for all providers', 'Redis for refresh tokens'],
    });

    expect(result.success).toBe(true);
    expect(result.file).toBe(join(dir, 'session-digest.md'));

    const parsed = await parseSessionDigest(join(dir, 'session-digest.md'));
    expect(parsed).not.toBeNull();
    expect(parsed!.sessionCount).toBe(12);
    expect(parsed!.consolidatedThrough).toBe(7);
    expect(parsed!.generated).toBe('2026-05-12T11:00:00.000Z');
    expect(parsed!.aggregate).toContain('provider registry');
    expect(parsed!.decisions).toEqual(['OAuth2 for all providers', 'Redis for refresh tokens']);
  });

  it('writes the digest to a SEPARATE file with no `## Session N` heading', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    await doSessionConsolidate(dir, {
      sessionCount: 11,
      consolidatedThrough: 6,
      aggregate: 'Older tail summary.',
    });

    const content = readFileSync(join(dir, 'session-digest.md'), 'utf-8');
    expect(content).not.toMatch(/^## Session\s+\d+/m);
  });

  it('reads a composed digest from --input-file and persists it', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const inputData = {
      sessionCount: 14,
      consolidatedThrough: 9,
      generated: '2026-05-14T10:00:00.000Z',
      // Multi-line aggregate — the exact shape that breaks `echo '...' | node`.
      aggregate: '## Aggregate\n\nSessions 1–9 covered:\n- registry\n- storage\n\tindented note.',
      decisions: ['Keep rotation server-side'],
    };
    const inputPath = join(dir, '.digest-input.json');
    writeFileSync(inputPath, JSON.stringify(inputData, null, 2), 'utf-8');

    const code = await sessionConsolidate(['--dir', dir, '--input-file', inputPath, '--json']);

    expect(code).toBe(0);
    expect(output.errorLines.join('\n')).toBe('');

    const parsed = await parseSessionDigest(join(dir, 'session-digest.md'));
    expect(parsed).not.toBeNull();
    expect(parsed!.sessionCount).toBe(14);
    expect(parsed!.consolidatedThrough).toBe(9);
    expect(parsed!.aggregate).toContain('indented note');
    expect(parsed!.decisions).toEqual(['Keep rotation server-side']);
  });

  it('returns exit code 1 when required fields are missing', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    // Missing aggregate / consolidatedThrough.
    const inputPath = join(dir, '.digest-input.json');
    writeFileSync(inputPath, JSON.stringify({ sessionCount: 10 }), 'utf-8');

    const code = await sessionConsolidate(['--dir', dir, '--input-file', inputPath]);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Missing or invalid required fields');
  });

  it('returns exit code 1 when neither --stdin nor --input-file is provided', async () => {
    const code = await sessionConsolidate(['--dir', '/tmp/test']);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Must pass either --stdin or --input-file');
  });

  it('returns exit code 1 when --stdin and --input-file are both provided', async () => {
    const code = await sessionConsolidate(['--dir', '/tmp/test', '--stdin', '--input-file', '/tmp/x.json']);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('mutually exclusive');
  });

  it('returns exit code 1 when no dir specified', async () => {
    const code = await sessionConsolidate(['--input-file', '/tmp/x.json']);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });

  it('returns exit code 1 when --input-file contains invalid JSON', async () => {
    const dir = createTempFeatureDir();
    tempDirs.push(dir);

    const inputPath = join(dir, '.digest-input.json');
    writeFileSync(inputPath, '{not valid json', 'utf-8');

    const code = await sessionConsolidate(['--dir', dir, '--input-file', inputPath]);
    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Failed to read input file');
  });
});
