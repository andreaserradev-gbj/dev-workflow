import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { list } from '../src/commands/list.js';

function captureOutput() {
  const lines: string[] = [];
  const errorLines: string[] = [];
  const warnLines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => errorLines.push(args.map(String).join(' '));
  console.warn = (...args: unknown[]) => warnLines.push(args.map(String).join(' '));
  return {
    lines,
    errorLines,
    warnLines,
    restore() {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    },
  };
}

const ACTIVE_PLAN = `# Feature

**Last Updated**: 2099-01-01

### Phase 1: Setup

1. ✅ Scaffold
2. ⬜ Wire it up

⏸️ **GATE**: Phase 1 complete.

### Phase 2: Polish

1. ⬜ Buff

⏸️ **GATE**: Phase 2 complete.
`;

const COMPLETE_PLAN = `# Feature

**Last Updated**: 2099-01-01

### Phase 1: Setup

1. ✅ Scaffold

⏸️ **GATE**: Phase 1 complete.
`;

const FRESH_CHECKPOINT = `---
branch: feature/test
last_commit: abc123
uncommitted_changes: false
checkpointed: 2099-01-01T10:00:00Z
---

<context>noop</context>
<next_action>do thing</next_action>
`;

let tempScan: string;

beforeAll(() => {
  // Build a temp scan tree:
  //   tempScan/
  //     project-alpha/.dev/
  //       runnable/   active, currentPhase pending, fresh checkpoint
  //     project-alpha/.dev-archive/
  //       old-feature/   archived
  //     project-beta/.dev/
  //       complete/   complete feature, no pending phase
  tempScan = mkdtempSync(join(tmpdir(), 'list-test-'));

  const alpha = join(tempScan, 'project-alpha');
  const alphaDev = join(alpha, '.dev');
  mkdirSync(alphaDev, { recursive: true });

  mkdirSync(join(alphaDev, 'runnable'), { recursive: true });
  writeFileSync(join(alphaDev, 'runnable', '00-master-plan.md'), ACTIVE_PLAN);
  writeFileSync(join(alphaDev, 'runnable', 'checkpoint.md'), FRESH_CHECKPOINT);

  const alphaArchive = join(alpha, '.dev-archive', 'old-feature');
  mkdirSync(alphaArchive, { recursive: true });
  writeFileSync(join(alphaArchive, '00-master-plan.md'), ACTIVE_PLAN);

  const betaDev = join(tempScan, 'project-beta', '.dev', 'complete');
  mkdirSync(betaDev, { recursive: true });
  writeFileSync(join(betaDev, '00-master-plan.md'), COMPLETE_PLAN);
});

afterAll(() => {
  rmSync(tempScan, { recursive: true, force: true });
});

describe('list', () => {
  let output: ReturnType<typeof captureOutput>;
  let origCwd: string;
  let origXdg: string | undefined;

  beforeEach(() => {
    output = captureOutput();
    origCwd = process.cwd();
    origXdg = process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    output.restore();
    process.chdir(origCwd);
    if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = origXdg;
  });

  describe('--scan', () => {
    it('lists all active features grouped by project (text output)', async () => {
      const code = await list(['--scan', tempScan]);
      const text = output.lines.join('\n');

      expect(code).toBe(0);
      expect(text).toContain('Project: project-alpha');
      expect(text).toContain('Project: project-beta');
      expect(text).toContain('runnable');
      expect(text).toContain('complete');
      // archived hidden by default
      expect(text).not.toContain('old-feature');
    });

    it('--all includes archived features', async () => {
      const code = await list(['--scan', tempScan, '--all']);
      const text = output.lines.join('\n');

      expect(code).toBe(0);
      expect(text).toContain('old-feature');
      expect(text).toContain('archived');
    });

    it('--status archived shows only archived features', async () => {
      const code = await list(['--scan', tempScan, '--status', 'archived']);
      const text = output.lines.join('\n');

      expect(code).toBe(0);
      expect(text).toContain('old-feature');
      expect(text).not.toContain('runnable');
      expect(text).not.toContain('complete');
    });

    it('--project filters to a single project', async () => {
      const code = await list(['--scan', tempScan, '--project', 'project-beta']);
      const text = output.lines.join('\n');

      expect(code).toBe(0);
      expect(text).toContain('project-beta');
      expect(text).not.toContain('project-alpha');
    });

    it('--status with unknown value returns exit 1', async () => {
      const code = await list(['--scan', tempScan, '--status', 'bogus']);
      expect(code).toBe(1);
      expect(output.errorLines.join('\n')).toContain('Unknown status: bogus');
    });
  });

  describe('--json', () => {
    it('emits stable JSON per feature', async () => {
      const code = await list(['--scan', tempScan, '--json']);
      const json = JSON.parse(output.lines.join('\n'));

      expect(code).toBe(0);
      expect(json.scanDirs).toEqual([tempScan]);
      expect(Array.isArray(json.projects)).toBe(true);

      const alpha = json.projects.find((p: { name: string }) => p.name === 'project-alpha');
      expect(alpha).toBeDefined();

      const runnable = alpha.features.find((f: { name: string }) => f.name === 'runnable');
      expect(runnable).toBeDefined();
      expect(runnable.name).toBe('runnable');
      expect(runnable.path).toContain('runnable');
      expect(runnable.status).toBeDefined();
      expect(runnable.progress).toBeDefined();
      expect(runnable.currentPhase).toBeDefined();
      // afk classification removed
      expect(runnable.afk).toBeUndefined();

      const beta = json.projects.find((p: { name: string }) => p.name === 'project-beta');
      const complete = beta.features.find((f: { name: string }) => f.name === 'complete');
      expect(complete).toBeDefined();
      expect(complete.status).toBe('complete');
      expect(complete.afk).toBeUndefined();
    });
  });

  describe('scan-dir resolution', () => {
    it('falls back to process.cwd() when no --scan and no dashboard config', async () => {
      const xdgDir = mkdtempSync(join(tmpdir(), 'list-xdg-empty-'));
      process.env.XDG_CONFIG_HOME = xdgDir;
      process.chdir(tempScan);
      try {
        const code = await list([]);
        const text = output.lines.join('\n');
        expect(code).toBe(0);
        expect(text).toContain('project-alpha');
      } finally {
        rmSync(xdgDir, { recursive: true, force: true });
      }
    });

    it('uses dashboard config scanDirs when present and --scan omitted', async () => {
      const xdgDir = mkdtempSync(join(tmpdir(), 'list-xdg-config-'));
      const cfgDir = join(xdgDir, 'dev-dashboard');
      mkdirSync(cfgDir, { recursive: true });
      writeFileSync(
        join(cfgDir, 'config.json'),
        JSON.stringify({ scanDirs: [tempScan] }),
      );
      process.env.XDG_CONFIG_HOME = xdgDir;
      // chdir somewhere unrelated so cwd fallback would fail
      process.chdir(tmpdir());
      try {
        const code = await list(['--json']);
        const json = JSON.parse(output.lines.join('\n'));
        expect(code).toBe(0);
        expect(json.scanDirs).toEqual([tempScan]);
        expect(json.projects.length).toBeGreaterThan(0);
      } finally {
        rmSync(xdgDir, { recursive: true, force: true });
      }
    });

    it('--scan overrides dashboard config', async () => {
      const xdgDir = mkdtempSync(join(tmpdir(), 'list-xdg-override-'));
      const cfgDir = join(xdgDir, 'dev-dashboard');
      mkdirSync(cfgDir, { recursive: true });
      writeFileSync(
        join(cfgDir, 'config.json'),
        JSON.stringify({ scanDirs: ['/nonexistent/path'] }),
      );
      process.env.XDG_CONFIG_HOME = xdgDir;
      try {
        const code = await list(['--scan', tempScan, '--json']);
        const json = JSON.parse(output.lines.join('\n'));
        expect(code).toBe(0);
        expect(json.scanDirs).toEqual([tempScan]);
      } finally {
        rmSync(xdgDir, { recursive: true, force: true });
      }
    });

    it('warns and falls back to cwd when dashboard config is invalid JSON', async () => {
      const xdgDir = mkdtempSync(join(tmpdir(), 'list-xdg-invalid-'));
      const cfgDir = join(xdgDir, 'dev-dashboard');
      mkdirSync(cfgDir, { recursive: true });
      writeFileSync(join(cfgDir, 'config.json'), '{not json');
      process.env.XDG_CONFIG_HOME = xdgDir;
      process.chdir(tempScan);
      try {
        const code = await list([]);
        expect(code).toBe(0);
        expect(output.warnLines.join('\n')).toContain('invalid JSON');
        expect(output.lines.join('\n')).toContain('project-alpha');
      } finally {
        rmSync(xdgDir, { recursive: true, force: true });
      }
    });
  });

  describe('empty scan results', () => {
    it('exits 0 with a clear message when no features are found', async () => {
      const empty = mkdtempSync(join(tmpdir(), 'list-empty-'));
      try {
        const code = await list(['--scan', empty]);
        expect(code).toBe(0);
        expect(output.lines.join('\n')).toContain('No features found');
      } finally {
        rmSync(empty, { recursive: true, force: true });
      }
    });
  });
});
