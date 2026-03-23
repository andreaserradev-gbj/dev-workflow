import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import {
  parseMasterPlan,
  parseCheckpoint,
  parseSubPrd,
  parseSessionState,
  determineFeatureStatus,
  parseFeature,
} from '../src/server/parser.js';
import type { Feature, FeatureDetail, SessionState } from '../src/shared/types.js';

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
    // Phase 1 has no status markers on steps → 0 countable steps
    // Phase 2 has 1 ✅ and 1 line with just "2." → parser should handle
    expect(result!.phases.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null for missing file', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'checkpoint-only/00-master-plan.md'));
    expect(result).toBeNull();
  });

  it('does not count verification items as steps', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'full-feature/00-master-plan.md'));
    // Phase 1 has 5 numbered steps + 2 verification items (- [x])
    // Should only count the 5 numbered steps
    expect(result!.phases[0].total).toBe(5);
  });

  it('does not count GATE lines as steps', async () => {
    const result = await parseMasterPlan(resolve(FIXTURES, 'full-feature/00-master-plan.md'));
    // Total steps across all phases should be 13, not 16 (3 gates excluded)
    expect(result!.progress.total).toBe(13);
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

    // Malformed YAML → should return null or partial with null fields
    // The key thing is it doesn't throw
    if (result !== null) {
      // If it parses partially, frontmatter fields should be null/undefined
      expect(result.nextAction).toBeNull();
    }
  });

  it('returns null for missing file', async () => {
    const result = await parseCheckpoint(resolve(FIXTURES, 'empty-dev/checkpoint.md'));
    expect(result).toBeNull();
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
});

// ─── Session State Parsing ─────────────────────────────────────────

describe('parseSessionState', () => {
  it('parses active session state', async () => {
    const result = await parseSessionState(resolve(FIXTURES, 'full-feature/session-state.json'));

    expect(result).not.toBeNull();
    expect(result!.status).toBe('active');
    expect(result!.phase).toBeNull();
    expect(result!.gateLabel).toBeNull();
    expect(result!.since).toBe('2026-03-20T14:00:00Z');
  });

  it('parses gate session state', async () => {
    const result = await parseSessionState(resolve(FIXTURES, 'gate-feature/session-state.json'));

    expect(result).not.toBeNull();
    expect(result!.status).toBe('gate');
    expect(result!.phase).toBe(1);
    expect(result!.gateLabel).toContain('Phase 1 complete');
    expect(result!.since).toBe('2026-03-22T16:45:00Z');
  });

  it('returns null for missing file', async () => {
    const result = await parseSessionState(resolve(FIXTURES, 'no-session-state/session-state.json'));
    expect(result).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    const result = await parseSessionState(resolve(FIXTURES, 'malformed/session-state.json'));
    expect(result).toBeNull();
  });
});

// ─── Status Determination ──────────────────────────────────────────

describe('determineFeatureStatus', () => {
  const now = new Date('2026-03-23T04:00:00Z');

  it('returns "gate" when session-state says gate (regardless of age)', () => {
    const session: SessionState = {
      status: 'gate',
      phase: 1,
      gateLabel: 'Phase 1 complete.',
      since: '2026-03-20T00:00:00Z', // 3 days ago — still gate
    };
    expect(determineFeatureStatus({ hasMasterPlan: true, allComplete: false, session, checkpointDate: null, lastUpdated: null, now })).toBe('gate');
  });

  it('returns "active" when session is active and recent', () => {
    const session: SessionState = {
      status: 'active',
      phase: null,
      gateLabel: null,
      since: '2026-03-23T03:45:00Z', // 15 min ago
    };
    expect(determineFeatureStatus({ hasMasterPlan: true, allComplete: false, session, checkpointDate: null, lastUpdated: null, now })).toBe('active');
  });

  it('falls back to markdown heuristics when active session is stale (>30min)', () => {
    const session: SessionState = {
      status: 'active',
      phase: null,
      gateLabel: null,
      since: '2026-03-23T02:00:00Z', // 2 hours ago
    };
    // Has checkpoint within 30 days → "active" from heuristics
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      session,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
    })).toBe('active');
  });

  it('falls back to markdown heuristics when session is idle', () => {
    const session: SessionState = {
      status: 'idle',
      phase: null,
      gateLabel: null,
      since: '2026-03-23T03:50:00Z',
    };
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      session,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
    })).toBe('active');
  });

  it('returns "complete" when all steps are done', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: true,
      session: null,
      checkpointDate: null,
      lastUpdated: '2026-03-20',
      now,
    })).toBe('complete');
  });

  it('returns "stale" when checkpoint is older than 30 days', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      session: null,
      checkpointDate: '2026-02-01T00:00:00Z', // ~50 days ago
      lastUpdated: null,
      now,
    })).toBe('stale');
  });

  it('returns "stale" when no checkpoint and lastUpdated is old', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: true,
      allComplete: false,
      session: null,
      checkpointDate: null,
      lastUpdated: '2026-01-15',
      now,
    })).toBe('stale');
  });

  it('returns "checkpoint-only" when no master plan but has checkpoint', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: false,
      allComplete: false,
      session: null,
      checkpointDate: '2026-03-20T14:30:00Z',
      lastUpdated: null,
      now,
    })).toBe('checkpoint-only');
  });

  it('returns "no-prd" when no master plan and no checkpoint', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: false,
      allComplete: false,
      session: null,
      checkpointDate: null,
      lastUpdated: null,
      now,
    })).toBe('no-prd');
  });

  it('returns "empty" for empty directory', () => {
    expect(determineFeatureStatus({
      hasMasterPlan: false,
      allComplete: false,
      session: null,
      checkpointDate: null,
      lastUpdated: null,
      now,
      isEmpty: true,
    })).toBe('empty');
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
    expect(result.session).not.toBeNull();
  });

  it('parses checkpoint-only feature', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'checkpoint-only'), 'checkpoint-only');

    expect(result.name).toBe('checkpoint-only');
    expect(result.status).toBe('checkpoint-only');
    expect(result.progress).toBeNull();
    expect(result.branch).toBe('feature/data-migration');
    expect(result.nextAction).toContain('Map legacy columns');
  });

  it('parses gate-feature with gate status', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'gate-feature'), 'gate-feature');

    expect(result.name).toBe('gate-feature');
    expect(result.status).toBe('gate');
    expect(result.session).not.toBeNull();
    expect(result.session!.status).toBe('gate');
    expect(result.session!.phase).toBe(1);
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
    // Has PRD + checkpoint within 30 days → active
    expect(result.status).toBe('active');
    expect(result.session).toBeNull();
    expect(result.branch).toBe('feature/rate-limiting');
  });

  it('parses malformed feature without crashing', async () => {
    const result = await parseFeature(resolve(FIXTURES, 'malformed'), 'malformed');

    expect(result.name).toBe('malformed');
    // Should not throw, status should be some valid value
    expect(result.status).toBeDefined();
  });
});
