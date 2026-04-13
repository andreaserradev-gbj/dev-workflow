import { describe, it, expect } from 'vitest';
import { parseFlags } from '../src/index.js';

describe('parseFlags', () => {
  it('parses boolean flags', () => {
    const { flags, positional } = parseFlags(['--json', '--stdin']);
    expect(flags.json).toBe(true);
    expect(flags.stdin).toBe(true);
    expect(positional).toEqual([]);
  });

  it('parses --flag value syntax', () => {
    const { flags } = parseFlags(['--dir', '/tmp/feature', '--phase', '2']);
    expect(flags.dir).toBe('/tmp/feature');
    expect(flags.phase).toBe('2');
  });

  it('parses --flag=value syntax', () => {
    const { flags } = parseFlags(['--dir=/tmp/feature', '--phase=2']);
    expect(flags.dir).toBe('/tmp/feature');
    expect(flags.phase).toBe('2');
  });

  it('treats --flag= (empty value) as boolean', () => {
    const { flags } = parseFlags(['--verbose=']);
    expect(flags.verbose).toBe(true);
  });

  it('preserves falsy string values in --flag=value syntax', () => {
    const { flags } = parseFlags(['--sessions=0']);
    expect(flags.sessions).toBe('0');
    expect(typeof flags.sessions).toBe('string');
  });

  it('preserves "false" as a string value, not boolean', () => {
    const { flags } = parseFlags(['--enabled=false']);
    expect(flags.enabled).toBe('false');
    expect(typeof flags.enabled).toBe('string');
  });

  it('handles --sessions=all correctly', () => {
    const { flags } = parseFlags(['--sessions=all']);
    expect(flags.sessions).toBe('all');
  });

  it('does not consume next arg as value when it starts with --', () => {
    const { flags } = parseFlags(['--json', '--dir', '/path', '--stdin']);
    expect(flags.json).toBe(true);
    expect(flags.dir).toBe('/path');
    expect(flags.stdin).toBe(true);
  });

  it('collects positional arguments', () => {
    const { flags, positional } = parseFlags(['feature-name', 'extra', '--json']);
    expect(flags.json).toBe(true);
    expect(positional).toEqual(['feature-name', 'extra']);
  });

  it('treats non-flag arg after --flag as the value', () => {
    const { flags, positional } = parseFlags(['--json', 'extra']);
    // 'extra' is consumed as the value of --json, not as positional
    expect(flags.json).toBe('extra');
    expect(positional).toEqual([]);
  });

  it('returns empty results for empty args', () => {
    const { flags, positional } = parseFlags([]);
    expect(flags).toEqual({});
    expect(positional).toEqual([]);
  });

  it('handles mixed --flag=value and --flag value syntax', () => {
    const { flags } = parseFlags(['--sessions=0', '--dir', '/tmp', '--json']);
    expect(flags.sessions).toBe('0');
    expect(flags.dir).toBe('/tmp');
    expect(flags.json).toBe(true);
  });
});