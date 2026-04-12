import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import {
  parseMasterPlan,
  parseCheckpoint,
  parseSubPrd,
  parseSubPrdsAsPhases,
  determineFeatureStatus,
  parseFeature,
  parseSessionLog,
} from '../src/parser.js';
import type { Feature } from '../src/types.js';

const FIXTURES = resolve(__dirname, 'fixtures');

// ─── Master Plan Parsing ───────────────────────────────────────────

describe('parseMasterPlan', () => {
  it('extracts phases, steps, and progress from full-feature', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'full-feature/00-master-plan.md'));

    expect(result).not.toBeNull();
    expect(result!.summary).toBe(
      'Multi-provider authentication with OAuth2 and JWT token management for the API server.'
    );

    // 3 phases
    expect(result!.phases).toHaveLength(3);

    // Phase 1: 5 steps, all complete
    expect(result!.phases[0]).toMatchObject({
      number: 1,
      title: 'Provider Setup',
      done: 5,
      total: 5,
      status: 'complete',
    });

    // Phase 2: 5 steps, 3 done, 2 pending
    expect(result!.phases[1]).toMatchObject({
      number: 2,
      title: 'Token Management',
      done: 3,
      total: 5,
      status: 'in-progress',
    });

    // Phase 3: 3 steps, 0 done
    expect(result!.phases[2]).toMatchObject({
      number: 3,
      title: 'Middleware',
      done: 0,
      total: 3,
      status: 'not-started',
    });

    // Overall progress: 8 of 13
    expect(result!.progress).toMatchObject({
      done: 8,
      total: 13,
      percent: Math.round((8 / 13) * 100),
    });
  });

  it('extracts phases from gate-feature', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'gate-feature/00-master-plan.md'));

    expect(result).not.toBeNull();
    expect(result!.phases).toHaveLength(2);

    expect(result!.phases[0]).toMatchObject({
      number: 1,
      title: 'Email Channel',
      done: 3,
      total: 3,
      status: 'complete',
    });

    expect(result!.phases[1]).toMatchObject({
      number: 2,
      title: 'Push Notifications',
      done: 0,
      total: 3,
      status: 'not-started',
    });

    expect(result!.progress).toMatchObject({ done: 3, total: 6, percent: 50 });
  });

  it('extracts phases from no-session-state fixture', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'no-session-state/00-master-plan.md'));

    expect(result).not.toBeNull();
    expect(result!.summary).toBe(
      'Token bucket rate limiter for API endpoints with per-user and per-route limits.'
    );
    expect(result!.phases).toHaveLength(2);
    expect(result!.progress).toMatchObject({ done: 2, total: 7, percent: Math.round((2 / 7) * 100) });
  });

  it('handles malformed master plan gracefully', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'malformed/00-master-plan.md'));

    // Should still extract what it can
    expect(result).not.toBeNull();
    expect(result!.phases.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null for missing file', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'checkpoint-only/00-master-plan.md'));
    expect(result).toBeNull();
  });

  it('does not count verification items as steps', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'full-feature/00-master-plan.md'));
    // Phase 1 has 5 numbered steps + 2 verification items (- [x])
    expect(result!.phases[0].total).toBe(5);
  });

  it('does not count GATE lines as steps', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'full-feature/00-master-plan.md'));
    // Total steps across all phases should be 13
    expect(result!.progress.total).toBe(13);
  });

  it('recognizes **Status** field with [x]/[ ] as phase completion markers', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'status-field/00-master-plan.md'));

    expect(result).not.toBeNull();
    expect(result!.phases).toHaveLength(3);

    // Phases 1 & 2: [x] → complete
    expect(result!.phases[0]).toMatchObject({ number: 1, status: 'complete' });
    expect(result!.phases[1]).toMatchObject({ number: 2, status: 'complete' });

    // Phase 3: [ ] → not-started
    expect(result!.phases[2]).toMatchObject({ number: 3, status: 'not-started' });
  });

  it('handles :white_check_mark: and :white_large_square: emoji shortcodes', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'shortcode-emoji/00-master-plan.md'));

    expect(result).not.toBeNull();
    expect(result!.phases).toHaveLength(1);
    expect(result!.phases[0]).toMatchObject({
      number: 1,
      done: 3,
      total: 3,
      status: 'complete',
    });
    expect(result!.progress).toMatchObject({ done: 3, total: 3, percent: 100 });
  });

  it('counts numbered checkbox steps (plain and backtick-wrapped)', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'numbered-checkbox/00-master-plan.md'));

    expect(result).not.toBeNull();
    expect(result!.phases).toHaveLength(2);

    // Phase 1: 5 numbered steps (4 done), verification items excluded
    expect(result!.phases[0]).toMatchObject({ number: 1, done: 4, total: 5, status: 'in-progress' });

    // Phase 2: 3 numbered backtick-wrapped steps, all pending
    expect(result!.phases[1]).toMatchObject({ number: 2, done: 0, total: 3, status: 'not-started' });

    expect(result!.progress).toMatchObject({ done: 4, total: 8, percent: 50 });
  });
});

// ─── Checkpoint Parsing ────────────────────────────────────────────

describe('parseCheckpoint', () => {
  it('extracts frontmatter and XML tags from full-feature', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'full-feature/checkpoint.md'));

    expect(result).not.toBeNull();

    // Frontmatter
    expect(result!.branch).toBe('feature/auth-system');
    expect(result!.lastCommit).toBe('Add JWT signing and verification');
    expect(result!.uncommittedChanges).toBe(false);
    expect(result!.checkpointed).toMatch(/^2026-03-20T14:30:00/);

    // XML tags
    expect(result!.nextAction).toContain('refresh token rotation');
    expect(result!.decisions).toHaveLength(2);
    expect(result!.decisions[0]).toContain('RS256');
    expect(result!.blockers).toHaveLength(1);
    expect(result!.blockers[0]).toContain('Redis connection pooling');
    expect(result!.notes).toHaveLength(1);
    expect(result!.notes[0]).toContain('PKCE');
  });

  it('extracts frontmatter from checkpoint-only', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'checkpoint-only/checkpoint.md'));

    expect(result).not.toBeNull();
    expect(result!.branch).toBe('feature/data-migration');
    expect(result!.uncommittedChanges).toBe(true);
    expect(result!.checkpointed).toMatch(/^2026-02-10T09:15:00/);
    expect(result!.nextAction).toContain('Map legacy columns');
  });

  it('extracts from no-session-state checkpoint', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'no-session-state/checkpoint.md'));

    expect(result).not.toBeNull();
    expect(result!.branch).toBe('feature/rate-limiting');
    expect(result!.nextAction).toContain('sliding window counter');
  });

  it('handles malformed checkpoint gracefully', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'malformed/checkpoint.md'));

    // Malformed YAML — should return null or partial with null fields
    if (result !== null) {
      expect(result.nextAction).toBeNull();
    }
  });

  it('returns null for missing file', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'empty-dev/checkpoint.md'));
    expect(result).toBeNull();
  });

  // ─── Parser Bug Fix Tests ──────────────────────────────────────

  it('extracts <current_state> section from full-feature', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'full-feature/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.currentState).toContain('Phase 1 complete: All 5 steps done');
    expect(result!.currentState).toContain('✅');
    expect(result!.currentState).toContain('⬜');
  });

  it('extracts <key_files> section from full-feature', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'full-feature/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.keyFiles).toContain('src/auth/token-service.ts');
    expect(result!.keyFiles).toContain('src/auth/jwt-config.ts');
  });

  it('extracts PRD file list from full-feature', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'full-feature/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.prdFiles).toHaveLength(2);
    expect(result!.prdFiles[0]).toBe('.dev/auth-system/00-master-plan.md');
    expect(result!.prdFiles[1]).toBe('.dev/auth-system/01-sub-prd-tokens.md');
  });

  it('extracts PRD file list from checkpoint-only', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'checkpoint-only/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.prdFiles).toHaveLength(1);
    expect(result!.prdFiles[0]).toBe('.dev/data-migration/00-master-plan.md');
  });

  it('extracts continuation prompt from comprehensive fixture', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'edge-case-checkpoints/comprehensive/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.continuationPrompt).toBe('Please continue by monitoring the vendor incident resolution. Check error rate and verify functionality is restored.');
  });

  it('extracts continuation prompt from backticked-xml-tags fixture', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'edge-case-checkpoints/backticked-xml-tags/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.continuationPrompt).toBe('Please continue with Phase 1 implementation.');
  });

  it('returns null continuationPrompt when no --- separator in body', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'full-feature/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.continuationPrompt).toBeNull();
  });

  it('returns empty prdFiles array when no PRD list present', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'edge-case-checkpoints/inline-close-tags/checkpoint.md'));
    expect(result).not.toBeNull();
    expect(result!.prdFiles).toEqual([]);
  });

  it('does not match XML tags inside backtick code (backticked-xml-tags fixture)', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'edge-case-checkpoints/backticked-xml-tags/checkpoint.md'));
    expect(result).not.toBeNull();

    // decisions should contain the actual decisions, not garbage from backtick code
    expect(result!.decisions).toHaveLength(2);
    expect(result!.decisions[0]).toBe('Use gray-matter for YAML stringifying');
    expect(result!.decisions[1]).toBe('Round-trip validation only');

    // notes should contain the actual note text including backtick references
    expect(result!.notes).toHaveLength(1);
    expect(result!.notes[0]).toContain('`<decisions>`');

    // nextAction should preserve backtick code within XML content
    expect(result!.nextAction).toContain('`writeCheckpoint()`');
    expect(result!.nextAction).toContain('`matter.stringify()`');
  });

  it('strips stray close tags from inline-close-tags fixture', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'edge-case-checkpoints/inline-close-tags/checkpoint.md'));
    expect(result).not.toBeNull();

    // Decisions should not have trailing </decisions>
    expect(result!.decisions).toEqual(['RS256 over HS256 for JWT signing', 'Redis for refresh token storage']);
    expect(result!.blockers).toEqual(['Redis connection pooling needs config']);
    expect(result!.notes).toEqual(['Consider adding PKCE for mobile flows']);
  });

  it('extracts currentState and keyFiles from all edge-case checkpoints', async () => {
    const edgeCaseDir = resolve(FIXTURES, 'edge-case-checkpoints');
    const entries = await import('fs/promises').then(m => m.readdir(edgeCaseDir));

    for (const entry of entries) {
      const cpPath = resolve(edgeCaseDir, entry, 'checkpoint.md');
      let content: string;
      try { content = await import('fs/promises').then(m => m.readFile(cpPath, 'utf-8')); } catch { continue; }

      const result = await parseCheckpoint(cpPath);
      if (!result) continue;

      // If file contains <current_state>, it should be extracted
      if (content.includes('<current_state>')) {
        expect(result.currentState).not.toBeNull();
      }
      // If file contains <key_files>, it should be extracted
      if (content.includes('<key_files>')) {
        expect(result.keyFiles).not.toBeNull();
      }
    }
  });
});

// ─── Sub-PRD Parsing ───────────────────────────────────────────────

describe('parseSubPrd', () => {
  it('extracts title and step progress from sub-PRD', async () => {
    const result = await parseSubPrd(resolve(FIXTURES, 'full-feature/01-sub-prd-tokens.md'));

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Token Management');
    expect(result!.done).toBe(3);
    expect(result!.total).toBe(5);
    expect(result!.status).toBe('in-progress');
    expect(result!.steps).toHaveLength(5);
    expect(result!.steps[0]).toMatchObject({ number: 1, status: 'done' });
    expect(result!.steps[3]).toMatchObject({ number: 4, status: 'pending' });
  });

  it('returns null for missing file', async () => {
    const result = await parseSubPrd(resolve(FIXTURES, 'gate-feature/01-sub-prd-fake.md'));
    expect(result).toBeNull();
  });

  it('falls back to **Status** header when no table steps found', async () => {
    const result = await parseSubPrd(resolve(FIXTURES, 'subprd-gate-no-table/01-sub-prd-networking.md'));

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Networking Cleanup');
    expect(result!.total).toBe(0);
    expect(result!.status).toBe('complete');
  });

  it('falls back to not-started from **Status** header', async () => {
    const result = await parseSubPrd(resolve(FIXTURES, 'subprd-gate-no-table/02-sub-prd-storage.md'));

    expect(result).not.toBeNull();
    expect(result!.status).toBe('not-started');
  });
});

// ─── Sub-PRD as Phases (gate fallback) ────────────────────────────

describe('parseSubPrdsAsPhases', () => {
  it('converts sub-PRDs to Phase entries with table-based status', async () => {
    const phases = await parseSubPrdsAsPhases(resolve(FIXTURES, 'subprd-gate'));

    expect(phases).toHaveLength(3);
    expect(phases[0]).toMatchObject({ number: 1, title: 'Cloud Cleanup', status: 'complete' });
    expect(phases[1]).toMatchObject({ number: 2, title: 'Config Cleanup', status: 'not-started' });
    expect(phases[2]).toMatchObject({ number: 3, title: 'Code Removal', status: 'not-started' });
  });

  it('converts sub-PRDs to Phase entries with header-based status', async () => {
    const phases = await parseSubPrdsAsPhases(resolve(FIXTURES, 'subprd-gate-no-table'));

    expect(phases).toHaveLength(2);
    expect(phases[0]).toMatchObject({ number: 1, title: 'Networking Cleanup', status: 'complete' });
    expect(phases[1]).toMatchObject({ number: 2, title: 'Storage Cleanup', status: 'not-started' });
  });

  it('returns empty array when no sub-PRDs exist', async () => {
    const phases = await parseSubPrdsAsPhases(resolve(FIXTURES, 'gate-feature'));
    expect(phases).toHaveLength(0);
  });
});

// ─── Status Determination ──────────────────────────────────────────

describe('determineFeatureStatus', () => {
  const now = new Date('2026-03-23T04:00:00Z');

  it('returns "active" when checkpoint is recent', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
    })).toBe('active');
  });

  it('returns "active" when lastUpdated is recent', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: null,
      lastUpdated: '2026-03-20',
      now,
    })).toBe('active');
  });

  it('returns "complete" when all steps are done', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: true,
      checkpointDate: null,
      lastUpdated: '2026-03-20',
      now,
    })).toBe('complete');
  });

  it('returns "stale" when checkpoint is older than 30 days', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: '2026-02-01T00:00:00Z',
      lastUpdated: null,
      now,
    })).toBe('stale');
  });

  it('returns "stale" when no checkpoint and lastUpdated is old', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: null,
      lastUpdated: '2026-01-15',
      now,
    })).toBe('stale');
  });

  it('returns "stale" when no date reference available', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: null,
      lastUpdated: null,
      now,
    })).toBe('stale');
  });

  it('returns "checkpoint-only" when no master plan but has checkpoint', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: false,
      allComplete: false,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
    })).toBe('checkpoint-only');
  });

  it('returns "no-prd" when no master plan and no checkpoint', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: false,
      allComplete: false,
      checkpointDate: null,
      lastUpdated: null,
      now,
    })).toBe('no-prd');
  });

  it('returns "empty" for empty directory', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: false,
      allComplete: false,
      checkpointDate: null,
      lastUpdated: null,
      now,
      isEmpty: true,
    })).toBe('empty');
  });

  it('returns "gate" when atGate is true', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
      atGate: true,
    })).toBe('gate');
  });

  it('returns "gate" even when checkpoint is stale', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: '2026-01-01T00:00:00Z',
      lastUpdated: null,
      now,
      atGate: true,
    })).toBe('gate');
  });

  it('returns "stale" when 0% progress and no checkpoint', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: null,
      lastUpdated: '2026-03-20',
      now,
      progressDone: 0,
    })).toBe('stale');
  });

  it('returns "active" when 0% progress but has checkpoint', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
      progressDone: 0,
    })).toBe('active');
  });
});

// ─── Full Feature Parsing (integration) ────────────────────────────

describe('parseFeature', () => {
  it('parses full-feature into a complete Feature object', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'full-feature'), 'full-feature');

    expect(result.name).toBe('full-feature');
    expect(result.progress).toMatchObject({ done: 8, total: 13 });
    expect(result.currentPhase).toMatchObject({ number: 2, title: 'Token Management' });
    expect(result.branch).toBe('feature/auth-system');
    expect(result.nextAction).toContain('refresh token rotation');
  });

  it('parses checkpoint-only feature', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'checkpoint-only'), 'checkpoint-only');

    expect(result.name).toBe('checkpoint-only');
    expect(result.status).toBe('checkpoint-only');
    expect(result.progress).toBeNull();
    expect(result.branch).toBe('feature/data-migration');
    expect(result.nextAction).toContain('Map legacy columns');
  });

  it('parses gate-feature with gate status (phase complete, next not started)', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'gate-feature'), 'gate-feature');

    expect(result.name).toBe('gate-feature');
    // Phase 1 complete, Phase 2 not started, no in-progress phase → gate
    expect(result.status).toBe('gate');
    expect(result.progress).toMatchObject({ done: 3, total: 6, percent: 50 });
  });

  it('parses empty-dev as empty', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'empty-dev'), 'empty-dev');

    expect(result.name).toBe('empty-dev');
    expect(result.status).toBe('empty');
    expect(result.progress).toBeNull();
    expect(result.branch).toBeNull();
  });

  it('parses no-session-state with markdown heuristics', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'no-session-state'), 'no-session-state');

    expect(result.name).toBe('no-session-state');
    expect(result.status).toBe('active');
    expect(result.branch).toBe('feature/rate-limiting');
  });

  it('parses malformed feature without crashing', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'malformed'), 'malformed');

    expect(result.name).toBe('malformed');
    expect(result.status).toBeDefined();
  });

  it('parses status-field feature using **Status** [x]/[ ] markers', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'status-field'), 'status-field');

    expect(result.name).toBe('status-field');
    // 2 of 3 phases complete → uses phase-level progress
    expect(result.progress).toMatchObject({ done: 2, total: 3, percent: 67 });
  });

  it('parses shortcode-emoji feature as complete', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'shortcode-emoji'), 'shortcode-emoji');

    expect(result.name).toBe('shortcode-emoji');
    expect(result.status).toBe('complete');
    expect(result.progress).toMatchObject({ done: 3, total: 3, percent: 100 });
  });

  it('detects gate from sub-PRDs when master plan has no Phase headers', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'subprd-gate'), 'subprd-gate');

    expect(result.name).toBe('subprd-gate');
    expect(result.status).toBe('gate');
    // Progress from sub-PRD step counts: 3 of 8
    expect(result.progress).toMatchObject({ done: 3, total: 8 });
  });

  it('detects gate from sub-PRDs with header-only status', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'subprd-gate-no-table'), 'subprd-gate-no-table');

    expect(result.name).toBe('subprd-gate-no-table');
    expect(result.status).toBe('gate');
  });
});

// ─── Session Log Parsing ───────────────────────────────────────────

describe('parseSessionLog', () => {
  const SESSION_LOG_FIXTURE = resolve(FIXTURES, 'session-log');

  it('returns empty array for non-existent file', async () => {
    const result = await parseSessionLog('/nonexistent/session-log.md');
    expect(result).toEqual([]);
  });

  it('parses a well-formed session-log with multiple sessions', async () => {
    const result = await parseSessionLog(resolve(SESSION_LOG_FIXTURE, 'session-log.md'));

    expect(result).toHaveLength(3);

    // Session 1
    expect(result[0].session).toBe(1);
    expect(result[0].date).toBe('2026-04-10T09:00:00.000Z');
    expect(result[0].context).toContain('Phase 1 planning');
    expect(result[0].decisions).toEqual(['Use REST API', 'Skip GraphQL']);
    expect(result[0].blockers).toEqual([]);
    expect(result[0].notes).toEqual(['Token expiry edge case']);

    // Session 2
    expect(result[1].session).toBe(2);
    expect(result[1].date).toBe('2026-04-11T14:00:00.000Z');
    expect(result[1].context).toContain('Implementing auth');
    expect(result[1].decisions).toEqual(['Use JWT']);
    expect(result[1].blockers).toEqual(['Waiting on Redis']);
    expect(result[1].notes).toEqual([]);

    // Session 3
    expect(result[2].session).toBe(3);
    expect(result[2].date).toBe('2026-04-12T10:00:00.000Z');
    expect(result[2].context).toContain('Phase 1 complete');
    expect(result[2].decisions).toEqual(['Use RS256', 'Cache tokens']);
    expect(result[2].blockers).toEqual([]);
    expect(result[2].notes).toEqual(['Watch for clock skew']);
  });

  it('handles session-log with only context (no decisions/blockers/notes)', async () => {
    const result = await parseSessionLog(resolve(SESSION_LOG_FIXTURE, 'session-log-minimal.md'));

    expect(result).toHaveLength(1);
    expect(result[0].session).toBe(1);
    expect(result[0].date).toBe('2026-04-13T08:00:00.000Z');
    expect(result[0].context).toContain('Simple session');
    expect(result[0].decisions).toEqual([]);
    expect(result[0].blockers).toEqual([]);
    expect(result[0].notes).toEqual([]);
  });

  it('handles empty file', async () => {
    const result = await parseSessionLog(resolve(SESSION_LOG_FIXTURE, 'session-log-empty.md'));
    expect(result).toEqual([]);
  });
});