import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { featureShow } from '../src/commands/feature-show.js';

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

describe('feature-show', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
  });

  it('shows full-feature summary in text mode', async () => {
    const code = await featureShow(['--dir', resolve(FIXTURES, 'full-feature')]);

    expect(code).toBe(0);
    expect(output.lines.join('\n')).toContain('Feature: full-feature');
    expect(output.lines.join('\n')).toContain('Status:  active');
    expect(output.lines.join('\n')).toContain('8/13');
    expect(output.lines.join('\n')).toContain('Phase:   2/3');
  });

  it('outputs valid JSON with --json', async () => {
    const code = await featureShow(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.name).toBe('full-feature');
    expect(json.status).toBe('active');
    expect(json.progress).toMatchObject({ done: 8, total: 13 });
    expect(json.currentPhase).toMatchObject({ number: 2, title: 'Token Management' });
    expect(json.branch).toBe('feature/auth-system');
  });

  it('shows gate-feature with gate status', async () => {
    const code = await featureShow(['--dir', resolve(FIXTURES, 'gate-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.status).toBe('gate');
    expect(json.progress).toMatchObject({ done: 3, total: 6 });
  });

  it('shows checkpoint-only feature', async () => {
    const code = await featureShow(['--dir', resolve(FIXTURES, 'checkpoint-only'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.status).toBe('checkpoint-only');
    expect(json.branch).toBe('feature/data-migration');
  });

  it('shows empty-dev feature', async () => {
    const code = await featureShow(['--dir', resolve(FIXTURES, 'empty-dev'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.status).toBe('empty');
  });

  it('returns exit code 1 when no dir or feature specified', async () => {
    const code = await featureShow([]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });
});
