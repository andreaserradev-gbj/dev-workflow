import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { resumeContext } from '../src/commands/resume-context.js';

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

describe('resume-context', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
  });

  it('produces merged JSON with all fields for full-feature', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-feature'),
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    // Feature section
    expect(json.feature.name).toBe('full-feature');
    expect(json.feature.status).toBeDefined();
    expect(json.feature.currentPhase).toMatchObject({ number: 2, title: 'Token Management' });

    // Checkpoint section
    expect(json.checkpoint.context).toContain('Multi-provider authentication');
    expect(json.checkpoint.nextAction).toContain('refresh token rotation');
    expect(json.checkpoint.decisions).toHaveLength(2);
    expect(json.checkpoint.blockers).toHaveLength(1);

    // Validity section — will vary depending on git state, just check structure
    expect(['fresh', 'stale', 'drifted']).toContain(json.validity);
    expect(json.validityDetails).toHaveProperty('checkpointBranch');
    expect(json.validityDetails).toHaveProperty('currentBranch');

    // Current phase PRD — should contain Phase 2 content
    expect(json.currentPhasePrd).toContain('Phase 2');
    expect(json.currentPhasePrd).toContain('Token Management');

    // Reference files
    expect(json.referenceFiles).toBeInstanceOf(Array);

    // Session history and accumulated decisions — no session-log in fixture
    expect(json.sessionHistory).toEqual([]);
    expect(json.accumulatedDecisions).toEqual([]);
  });

  it('extracts current phase PRD section only', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-feature'),
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    // Phase 2 is the current phase — should NOT contain Phase 1 or Phase 3 content
    expect(json.currentPhasePrd).toContain('Phase 2');
    expect(json.currentPhasePrd).not.toContain('Phase 1: Provider Setup');
    expect(json.currentPhasePrd).not.toContain('Phase 3: Session Management');
  });

  it('handles feature without checkpoint', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'gate-feature'),
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    // Checkpoint should be all-nulls/empty
    expect(json.checkpoint.context).toBeNull();
    expect(json.checkpoint.nextAction).toBeNull();
    expect(json.checkpoint.decisions).toEqual([]);
  });

  it('handles checkpoint-only feature (no master plan)', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'checkpoint-only'),
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    expect(json.feature.status).toBe('checkpoint-only');
    expect(json.checkpoint.context).toContain('Migrate legacy database');
    expect(json.currentPhasePrd).toBeNull();
    expect(json.referenceFiles).toEqual([]);
  });

  it('respects --sessions flag to limit session history', async () => {
    // Use the session-log fixture directory — but resume-context expects a full feature dir
    // So we test with a feature dir that has no session-log, verifying default behavior
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-feature'),
      '--sessions=2',
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    // No session log in this fixture, but the flag should be accepted
    expect(json.sessionHistory).toEqual([]);
  });

  it('returns session history and accumulated decisions from session-log', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-with-sessions'),
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    // Session history — default --sessions=5, 3 sessions available
    expect(json.sessionHistory).toHaveLength(3);
    expect(json.sessionHistory[0].session).toBe(1);
    expect(json.sessionHistory[0].date).toBe('2026-02-15T10:00:00.000Z');
    expect(json.sessionHistory[0].context).toContain('OAuth provider registry');
    expect(json.sessionHistory[1].session).toBe(2);
    expect(json.sessionHistory[2].session).toBe(3);

    // Accumulated decisions — union of all sessions, deduplicated
    expect(json.accumulatedDecisions).toContain('Use OAuth2 for all providers');
    expect(json.accumulatedDecisions).toContain('JSON Web Tokens for session management');
    expect(json.accumulatedDecisions).toContain('RS256 over HS256 for JWT signing');
    expect(json.accumulatedDecisions).toContain('Redis for refresh token storage');
    // Should not contain duplicates
    const unique = new Set(json.accumulatedDecisions);
    expect(unique.size).toBe(json.accumulatedDecisions.length);
  });

  it('respects --sessions N to limit session history', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-with-sessions'),
      '--sessions=2',
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    // Should return only last 2 sessions
    expect(json.sessionHistory).toHaveLength(2);
    expect(json.sessionHistory[0].session).toBe(2);
    expect(json.sessionHistory[1].session).toBe(3);
    // Accumulated decisions should still be from ALL sessions
    expect(json.accumulatedDecisions).toContain('Use OAuth2 for all providers');
  });

  it('respects --sessions=all to return all sessions', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-with-sessions'),
      '--sessions=all',
      '--json',
    ]);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));

    expect(json.sessionHistory).toHaveLength(3);
  });


  it('returns exit code 1 when no dir specified', async () => {
    const code = await resumeContext(['--json']);

    expect(code).toBe(1);
    expect(output.errorLines.join('\n')).toContain('Could not resolve feature directory');
  });

  it('outputs text format when --json not specified', async () => {
    const code = await resumeContext([
      '--dir',
      resolve(FIXTURES, 'full-feature'),
    ]);

    expect(code).toBe(0);
    const text = output.lines.join('\n');
    expect(text).toContain('Feature:');
    expect(text).toContain('Status:');
    expect(text).toContain('Validity:');
  });

});
