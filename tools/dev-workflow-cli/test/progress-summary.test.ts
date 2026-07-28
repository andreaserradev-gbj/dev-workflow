import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { progressSummary } from '../src/commands/progress-summary.js';

const FIXTURES = resolve(__dirname, '../../dev-workflow-core/test/fixtures');

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

describe('progress-summary', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
  });

  it('outputs structured JSON for full-feature', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.feature).toBe('full-feature');
    expect(json.overall).toMatchObject({ done: 8, total: 13 });
    expect(json.phases).toHaveLength(3);
    expect(json.phases[0]).toMatchObject({ number: 1, title: 'Provider Setup', status: 'complete' });
    expect(json.phases[1]).toMatchObject({ number: 2, title: 'Token Management', status: 'in-progress' });
    expect(json.phases[2]).toMatchObject({ number: 3, title: 'Middleware', status: 'not-started' });
  });

  it('includes sub-PRD progress for full-feature', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.subPrds).toHaveLength(1);
    expect(json.subPrds[0]).toMatchObject({
      id: '01-sub-prd-tokens',
      title: 'Token Management',
      done: 3,
      total: 5,
      status: 'in-progress',
    });
  });

  it('outputs text format for gate-feature', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'gate-feature')]);

    expect(code).toBe(0);
    const text = output.lines.join('\n');
    expect(text).toContain('Overall: 3/6 (50%)');
    expect(text).toContain('Email Channel');
    expect(text).toContain('[done]');
    expect(text).toContain('Push Notifications');
    expect(text).toContain('[pending]');
  });

  it('emits sub-PRD unrecognized-marker warnings in JSON', async () => {
    const code = await progressSummary([
      '--dir',
      resolve(FIXTURES, 'subprd-unknown-glyph'),
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    // The row the old parser dropped is now in the denominator.
    expect(json.overall).toMatchObject({ done: 1, total: 2, percent: 50 });
    expect(json.warnings).toHaveLength(1);
    expect(json.warnings[0]).toContain('⚠️');
    expect(json.warnings[0]).toContain('01-sub-prd-foundation.md');
  });

  it('emits master-plan unrecognized-marker warnings in JSON', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'master-unknown-glyph'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.warnings.length).toBeGreaterThan(0);
    expect(json.warnings.join('\n')).toContain('00-master-plan.md');
  });

  it('omits the warnings key entirely for a clean feature', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json).not.toHaveProperty('warnings');
  });

  it('prints warnings to stderr in human mode, leaving stdout parseable', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'subprd-unknown-glyph')]);

    expect(code).toBe(0);
    expect(output.lines.join('\n')).toContain('Overall: 1/2 (50%)');
    // stdout must stay free of warning text — it gets piped.
    expect(output.lines.join('\n')).not.toContain('Warnings:');
    expect(output.lines.join('\n')).not.toContain('⚠️');
    const err = output.errorLines.join('\n');
    expect(err).toContain('Warnings:');
    expect(err).toContain('⚠️');
  });

  it('returns exit code 1 for missing master plan', async () => {
    const code = await progressSummary(['--dir', resolve(FIXTURES, 'checkpoint-only')]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('No master plan found');
  });

  it('returns exit code 1 when no dir specified', async () => {
    const code = await progressSummary([]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });
});
