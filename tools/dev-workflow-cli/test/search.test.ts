import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { search } from '../src/commands/search.js';

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

const PLAN_WITH_AUTH = `# Auth Feature

**Last Updated**: 2099-01-01

## Executive Summary

OAuth2 authentication with Google and GitHub providers for the API server.

### Phase 1: Provider Setup

1. ✅ Configure Google OAuth
2. ⬜ Configure GitHub OAuth

⏸️ **GATE**: Phase 1 complete.
`;

const PLAN_WITH_MIGRATION = `# Migration Feature

**Last Updated**: 2099-01-01

## Executive Summary

Database migration tooling for PostgreSQL schema updates.

### Phase 1: Schema Diff

1. ⬜ Parse current schema
2. ⬜ Generate diff

⏸️ **GATE**: Phase 1 complete.
`;

const CHECKPOINT_FRESH = `---
branch: feature/auth
last_commit: abc123
uncommitted_changes: false
checkpointed: 2099-01-01T10:00:00Z
---

<context>Working on auth</context>
<next_action>Configure GitHub OAuth provider</next_action>
`;

let tempScan: string;

beforeAll(() => {
  tempScan = mkdtempSync(join(tmpdir(), 'search-test-'));

  // project-alpha/.dev/auth-oauth
  const alphaAuthDir = join(tempScan, 'project-alpha', '.dev', 'auth-oauth');
  mkdirSync(alphaAuthDir, { recursive: true });
  writeFileSync(join(alphaAuthDir, '00-master-plan.md'), PLAN_WITH_AUTH);
  writeFileSync(join(alphaAuthDir, 'checkpoint.md'), CHECKPOINT_FRESH);

  // project-alpha/.dev/db-migration
  const alphaMigDir = join(tempScan, 'project-alpha', '.dev', 'db-migration');
  mkdirSync(alphaMigDir, { recursive: true });
  writeFileSync(join(alphaMigDir, '00-master-plan.md'), PLAN_WITH_MIGRATION);

  // project-beta/.dev/auth-tokens
  const betaAuthDir = join(tempScan, 'project-beta', '.dev', 'auth-tokens');
  mkdirSync(betaAuthDir, { recursive: true });
  writeFileSync(
    join(betaAuthDir, '00-master-plan.md'),
    PLAN_WITH_AUTH.replace('Auth Feature', 'Token Feature')
      .replace('auth-oauth', 'auth-tokens')
      .replace('OAuth2 authentication', 'Token management and OAuth2 refresh'),
  );
});

afterAll(() => {
  rmSync(tempScan, { recursive: true, force: true });
});

describe('search command', () => {
  it('requires --query flag', async () => {
    const out = captureOutput();
    try {
      const code = await search(['--scan', tempScan]);
      expect(code).toBe(1);
      expect(out.errorLines.join(' ')).toContain('--query is required');
    } finally {
      out.restore();
    }
  });

  it('returns exit 0 with results, exit 1 without', async () => {
    const out = captureOutput();
    try {
      const code = await search(['--scan', tempScan, '--query', 'oauth']);
      expect(code).toBe(0);
    } finally {
      out.restore();
    }

    const out2 = captureOutput();
    try {
      const code = await search(['--scan', tempScan, '--query', 'nonexistentthing']);
      expect(code).toBe(1);
    } finally {
      out2.restore();
    }
  });

  it('outputs valid JSON with --json', async () => {
    const out = captureOutput();
    try {
      const code = await search(['--scan', tempScan, '--query', 'oauth', '--json']);
      expect(code).toBe(0);

      const payload = JSON.parse(out.lines.join('\n'));
      expect(payload.query).toBe('oauth');
      expect(Array.isArray(payload.hits)).toBe(true);
      expect(payload.hits.length).toBeGreaterThanOrEqual(1);

      const hit = payload.hits[0];
      expect(hit).toHaveProperty('projectName');
      expect(hit).toHaveProperty('name');
      expect(hit).toHaveProperty('snippet');
      expect(hit).toHaveProperty('matches');
    } finally {
      out.restore();
    }
  });

  it('filters by --project', async () => {
    const out = captureOutput();
    try {
      const code = await search([
        '--scan', tempScan,
        '--query', 'oauth',
        '--project', 'project-alpha',
        '--json',
      ]);
      expect(code).toBe(0);

      const payload = JSON.parse(out.lines.join('\n'));
      for (const hit of payload.hits) {
        expect(hit.projectName).toBe('project-alpha');
      }
    } finally {
      out.restore();
    }
  });

  it('filters by --status', async () => {
    const out = captureOutput();
    try {
      const code = await search([
        '--scan', tempScan,
        '--query', 'oauth',
        '--status', 'gate',
        '--json',
      ]);

      const payload = JSON.parse(out.lines.join('\n'));
      for (const hit of payload.hits) {
        expect(hit.status).toBe('gate');
      }
    } finally {
      out.restore();
    }
  });

  it('rejects invalid --status', async () => {
    const out = captureOutput();
    try {
      const code = await search(['--scan', tempScan, '--query', 'test', '--status', 'invalid']);
      expect(code).toBe(1);
      expect(out.errorLines.join(' ')).toContain('Unknown status');
    } finally {
      out.restore();
    }
  });

  it('text output groups by project', async () => {
    const out = captureOutput();
    try {
      const code = await search(['--scan', tempScan, '--query', 'oauth']);
      expect(code).toBe(0);

      const text = out.lines.join('\n');
      expect(text).toContain('project-alpha');
      expect(text).toContain('hit');
    } finally {
      out.restore();
    }
  });

  it('shows "No results" message for no matches', async () => {
    const out = captureOutput();
    try {
      const code = await search(['--scan', tempScan, '--query', 'zzzznotfound']);
      expect(code).toBe(1);
      expect(out.lines.join(' ')).toContain('No results');
    } finally {
      out.restore();
    }
  });

  it('multi-word AND query narrows results', async () => {
    const out = captureOutput();
    try {
      const code = await search([
        '--scan', tempScan,
        '--query', 'oauth google',
        '--json',
      ]);

      const payload = JSON.parse(out.lines.join('\n'));
      for (const hit of payload.hits) {
        const allSnippets = hit.matches.map((m: { snippet: string }) => m.snippet.toLowerCase()).join(' ');
        expect(allSnippets).toContain('oauth');
      }
    } finally {
      out.restore();
    }
  });
});
