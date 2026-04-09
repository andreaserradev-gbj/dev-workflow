import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { gateCheck } from '../src/commands/gate-check.js';

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

describe('gate-check', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
  });

  it('detects gate in gate-feature (exit 0)', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'gate-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.atGate).toBe(true);
    expect(json.completedPhase).toMatchObject({ number: 1, title: 'Email Channel' });
    expect(json.nextPhase).toMatchObject({ number: 2, title: 'Push Notifications' });
    expect(json.allComplete).toBe(false);
  });

  it('reports not at gate for in-progress feature (exit 2)', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(2);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.atGate).toBe(false);
    expect(json.completedPhase).toBeNull();
    expect(json.nextPhase).toBeNull();
  });

  it('reports all complete for shortcode-emoji feature (exit 0)', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'shortcode-emoji')]);

    expect(code).toBe(0);
    const text = output.lines.join('\n');
    expect(text).toContain('All phases complete');
  });

  it('shows text output for gate-feature', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'gate-feature')]);

    expect(code).toBe(0);
    const text = output.lines.join('\n');
    expect(text).toContain('AT GATE');
    expect(text).toContain('Phase 1');
    expect(text).toContain('Email Channel');
    expect(text).toContain('Phase 2');
    expect(text).toContain('Push Notifications');
  });

  it('shows not at gate text for in-progress feature', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'full-feature')]);

    expect(code).toBe(2);
    const text = output.lines.join('\n');
    expect(text).toContain('Not at a gate');
    expect(text).toContain('In progress: Phase 2');
  });

  it('returns exit code 1 for missing master plan', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'checkpoint-only')]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('No master plan found');
  });

  it('returns exit code 1 when no dir specified', async () => {
    const code = await gateCheck([]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });
});
