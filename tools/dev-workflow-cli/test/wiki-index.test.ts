import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { wikiIndex } from '../src/commands/wiki-index.js';

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

const MASTER_PLAN = `# Feature

**Last Updated**: 2099-01-01

## Executive Summary

A test feature for wiki-index tests.

### Phase 1: Setup

1. ✅ First step
2. ⬜ Second step

⏸️ **GATE**: Phase 1 complete.
`;

let tempScan: string;
let tempOut: string;

beforeAll(() => {
  tempScan = mkdtempSync(join(tmpdir(), 'wiki-index-test-'));
  tempOut = mkdtempSync(join(tmpdir(), 'wiki-out-test-'));

  // project-a/.dev/feature-one/00-master-plan.md
  mkdirSync(join(tempScan, 'project-a', '.dev', 'feature-one'), { recursive: true });
  writeFileSync(join(tempScan, 'project-a', '.dev', 'feature-one', '00-master-plan.md'), MASTER_PLAN);

  // project-a/.dev-archive/old-feature/00-master-plan.md
  mkdirSync(join(tempScan, 'project-a', '.dev-archive', 'old-feature'), { recursive: true });
  writeFileSync(join(tempScan, 'project-a', '.dev-archive', 'old-feature', '00-master-plan.md'), MASTER_PLAN);

  // project-b/.dev/feature-two/00-master-plan.md
  mkdirSync(join(tempScan, 'project-b', '.dev', 'feature-two'), { recursive: true });
  writeFileSync(join(tempScan, 'project-b', '.dev', 'feature-two', '00-master-plan.md'), MASTER_PLAN);
});

afterAll(() => {
  rmSync(tempScan, { recursive: true, force: true });
  rmSync(tempOut, { recursive: true, force: true });
});

describe('wiki-index', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });
  afterEach(() => {
    output.restore();
  });

  it('--json with empty scan dir returns valid JSON with 0 entries', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'wiki-empty-'));
    const code = await wikiIndex(['--json', '--scan', emptyDir]);
    rmSync(emptyDir, { recursive: true, force: true });

    expect(code).toBe(0);
    const parsed = JSON.parse(output.lines.join('\n'));
    expect(parsed.projects).toBe(0);
    expect(parsed.features).toBe(0);
    expect(parsed.generated).toBe(false);
    expect(parsed.entries).toEqual([]);
  });

  it('--json with fixture projects returns correct entries', async () => {
    const code = await wikiIndex(['--json', '--scan', tempScan]);
    expect(code).toBe(0);

    const parsed = JSON.parse(output.lines.join('\n'));
    expect(parsed.projects).toBe(2);
    expect(parsed.features).toBe(3);
    expect(parsed.entries.length).toBe(3);

    const names = parsed.entries.map((e: { name: string }) => e.name).sort();
    expect(names).toEqual(['feature-one', 'feature-two', 'old-feature']);
  });

  it('--generate writes wiki files to output directory', async () => {
    const outDir = join(tempOut, 'gen-test');
    const code = await wikiIndex(['--generate', '--scan', tempScan, '--out', outDir]);
    expect(code).toBe(0);

    expect(existsSync(join(outDir, 'index.md'))).toBe(true);
    expect(existsSync(join(outDir, 'log.md'))).toBe(true);
    expect(existsSync(join(outDir, 'README.md'))).toBe(true);

    const index = readFileSync(join(outDir, 'index.md'), 'utf-8');
    expect(index).toContain('# Dev Wiki Index');
    expect(index).toContain('project-a');
    expect(index).toContain('project-b');
  });

  it('--generate creates symlinks in projects/ directory', async () => {
    const outDir = join(tempOut, 'symlink-test');
    await wikiIndex(['--generate', '--scan', tempScan, '--out', outDir]);

    const projectsDir = join(outDir, 'projects');
    expect(existsSync(projectsDir)).toBe(true);

    const entries = readdirSync(projectsDir);
    expect(entries).toContain('project-a');
    expect(entries).toContain('project-b');
    expect(lstatSync(join(projectsDir, 'project-a')).isSymbolicLink()).toBe(true);
  });

  it('--generate --json returns JSON with generated: true', async () => {
    const outDir = join(tempOut, 'gen-json-test');
    const code = await wikiIndex(['--generate', '--json', '--scan', tempScan, '--out', outDir]);
    expect(code).toBe(0);

    const parsed = JSON.parse(output.lines.join('\n'));
    expect(parsed.generated).toBe(true);
    expect(parsed.projects).toBe(2);
  });

  it('text output contains project names and feature counts', async () => {
    const code = await wikiIndex(['--scan', tempScan]);
    expect(code).toBe(0);

    const text = output.lines.join('\n');
    expect(text).toContain('project-a');
    expect(text).toContain('project-b');
    expect(text).toContain('Dev Wiki Index');
    expect(text).toContain('--generate');
  });
});
