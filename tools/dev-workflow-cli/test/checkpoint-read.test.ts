import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { checkpointRead } from '../src/commands/checkpoint-read.js';

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

describe('checkpoint-read', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
  });

  it('outputs full checkpoint as JSON', async () => {
    const code = await checkpointRead(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.branch).toBe('feature/auth-system');
    expect(json.lastCommit).toBe('Add JWT signing and verification');
    expect(json.uncommittedChanges).toBe(false);
    expect(json.checkpointed).toMatch(/^2026-03-20T14:30:00/);
    expect(json.nextAction).toContain('refresh token rotation');
    expect(json.decisions).toHaveLength(2);
    expect(json.decisions[0]).toContain('RS256');
    expect(json.blockers).toHaveLength(1);
    expect(json.blockers[0]).toContain('Redis');
    expect(json.notes).toHaveLength(1);
  });

  it('outputs checkpoint-only fixture as JSON', async () => {
    const code = await checkpointRead(['--dir', resolve(FIXTURES, 'checkpoint-only'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.branch).toBe('feature/data-migration');
    expect(json.uncommittedChanges).toBe(true);
    expect(json.nextAction).toContain('Map legacy columns');
  });

  it('outputs text format for full-feature', async () => {
    const code = await checkpointRead(['--dir', resolve(FIXTURES, 'full-feature')]);

    expect(code).toBe(0);
    const text = output.lines.join('\n');
    expect(text).toContain('Branch: feature/auth-system');
    expect(text).toContain('Last commit: Add JWT signing and verification');
    expect(text).toContain('Uncommitted: false');
    expect(text).toContain('Next action:');
    expect(text).toContain('refresh token rotation');
    expect(text).toContain('Decisions:');
    expect(text).toContain('RS256');
    expect(text).toContain('Blockers:');
    expect(text).toContain('Redis');
  });

  it('returns exit code 1 for missing checkpoint', async () => {
    const code = await checkpointRead(['--dir', resolve(FIXTURES, 'gate-feature')]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('No checkpoint found');
  });

  it('returns exit code 1 when no dir specified', async () => {
    const code = await checkpointRead([]);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });
});
