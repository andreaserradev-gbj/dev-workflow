import { describe, it, expect } from 'vitest';
import { getStatusConfig } from '../src/client/utils/statusConfig.js';

describe('getStatusConfig', () => {
  const KNOWN = [
    ['gate', 'Gate'],
    ['active', 'Active'],
    ['complete', 'Complete'],
    ['stale', 'Stale'],
    ['checkpoint-only', 'Checkpoint'],
    ['no-prd', 'No PRD'],
    ['empty', 'Empty'],
    ['archived', 'Archived'],
  ] as const;

  it.each(KNOWN)('maps %s to its config (label "%s")', (status, label) => {
    const config = getStatusConfig(status);
    expect(config).toEqual({
      label,
      badge: expect.any(String),
      bar: expect.any(String),
    });
    expect(config.badge).not.toBe('');
    expect(config.bar).not.toBe('');
  });

  it('falls back to the no-prd config for an unknown status', () => {
    expect(getStatusConfig('totally-bogus')).toBe(getStatusConfig('no-prd'));
  });

  it('falls back to the no-prd config for an empty string', () => {
    expect(getStatusConfig('')).toBe(getStatusConfig('no-prd'));
  });
});
