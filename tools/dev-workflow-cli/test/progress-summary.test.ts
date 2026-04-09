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
