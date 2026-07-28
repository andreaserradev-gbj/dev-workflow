import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'path';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
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

  it('reports not at gate for in-progress feature (exit 0)', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'full-feature'), '--json']);

    expect(code).toBe(0);
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

    expect(code).toBe(0);
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

  it('detects gate from sub-PRDs when master plan has no Phase headers (exit 0)', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'subprd-gate'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.atGate).toBe(true);
    expect(json.completedPhase).toMatchObject({ number: 1, title: 'Cloud Cleanup' });
    expect(json.nextPhase).toMatchObject({ number: 2, title: 'Config Cleanup' });
    expect(json.allComplete).toBe(false);
  });

  it('detects gate from sub-PRDs with header-only status (exit 0)', async () => {
    const code = await gateCheck(['--dir', resolve(FIXTURES, 'subprd-gate-no-table'), '--json']);

    expect(code).toBe(0);
    const json = JSON.parse(output.lines.join('\n'));
    expect(json.atGate).toBe(true);
    expect(json.completedPhase).toMatchObject({ number: 1, title: 'Networking Cleanup' });
    expect(json.nextPhase).toMatchObject({ number: 2, title: 'Storage Cleanup' });
  });

  // Regression: an unrecognized glyph used to drop out of BOTH numerator and
  // denominator, so a phase whose only outstanding step carried one reported
  // itself complete — and gate-check waved the agent through to the next phase.
  // These shapes are purpose-built rather than fixture-based: the unknown glyph
  // has to be the *sole* thing standing between the feature and "complete", or
  // the assertion would pass for the wrong reason.
  describe('unknown glyphs never read as complete', () => {
    let tempDirs: string[];

    beforeEach(() => {
      tempDirs = [];
    });

    afterEach(() => {
      for (const dir of tempDirs) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    });

    function tempFeature(files: Record<string, string>): string {
      const dir = mkdtempSync(join(tmpdir(), 'gc-test-'));
      for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(dir, name), content, 'utf-8');
      }
      tempDirs.push(dir);
      return dir;
    }

    it('does not report allComplete when the last outstanding inline step is unknown', async () => {
      const dir = tempFeature({
        '00-master-plan.md': `# Feature: Almost Done

## Implementation Order

### Phase 1: Only Phase

1. ✅ Really done
2. ⚠️ Written, unverifiable

⏸️ **GATE**: Phase complete.
`,
      });

      const code = await gateCheck(['--dir', dir, '--json']);

      expect(code).toBe(0);
      const json = JSON.parse(output.lines.join('\n'));
      expect(json.allComplete).toBe(false);
      expect(json.atGate).toBe(false);
    });

    it('does not report atGate when the phase behind the gate has an unknown step', async () => {
      const dir = tempFeature({
        '00-master-plan.md': `# Feature: Not At A Gate

## Implementation Order

### Phase 1: First

1. ✅ Really done
2. ⚠️ Written, unverifiable

⏸️ **GATE**: Phase complete.

### Phase 2: Second

1. ⬜ Not started

⏸️ **GATE**: Phase complete.
`,
      });

      const code = await gateCheck(['--dir', dir, '--json']);

      expect(code).toBe(0);
      const json = JSON.parse(output.lines.join('\n'));
      expect(json.atGate).toBe(false);
      expect(json.allComplete).toBe(false);
      expect(json.completedPhase).toBeNull();
      expect(json.nextPhase).toBeNull();
    });

    it('does not report allComplete when the unknown step lives in a sub-PRD table', async () => {
      const dir = tempFeature({
        '00-master-plan.md': `# Feature: SubPRD Almost Done

## Implementation Order

See sub-PRDs for details.
`,
        '01-sub-prd-setup.md': `# Sub-PRD: Setup

**Status**: In Progress

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Really done | ✅ Done |
| **2** | Written, unverifiable | ⚠️ Unverifiable |
`,
      });

      const code = await gateCheck(['--dir', dir, '--json']);

      expect(code).toBe(0);
      const json = JSON.parse(output.lines.join('\n'));
      expect(json.allComplete).toBe(false);
      expect(json.atGate).toBe(false);
    });
  });
});
