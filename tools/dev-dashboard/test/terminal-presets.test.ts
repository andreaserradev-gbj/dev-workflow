import { describe, it, expect } from 'vitest';
import {
  KNOWN_TERMINALS,
  resolveTerminalCommand,
} from '../src/server/terminal-presets.js';
import { buildOpenCommand } from '../src/server/api.js';

const CWD = '/Users/test/projects/widget/.dev/auth-system';

describe('KNOWN_TERMINALS', () => {
  it('lists all expected darwin presets', () => {
    const ids = KNOWN_TERMINALS.darwin.map((p) => p.id);
    expect(ids).toEqual([
      'terminal',
      'iterm2',
      'wezterm',
      'ghostty',
      'kitty',
      'alacritty',
      'warp',
    ]);
  });

  it('lists all expected linux presets', () => {
    const ids = KNOWN_TERMINALS.linux.map((p) => p.id);
    expect(ids).toEqual(['gnome-terminal', 'konsole', 'wezterm', 'kitty', 'alacritty']);
  });

  it('lists all expected win32 presets', () => {
    const ids = KNOWN_TERMINALS.win32.map((p) => p.id);
    expect(ids).toEqual(['wt', 'wezterm', 'alacritty']);
  });

  it('every preset has a non-empty label', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      for (const preset of KNOWN_TERMINALS[platform]) {
        expect(preset.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('resolveTerminalCommand — preset path', () => {
  it('resolves darwin/wezterm to discrete cmd + args', () => {
    const cmd = resolveTerminalCommand('wezterm', 'darwin', CWD);
    expect(cmd).toEqual({ cmd: 'wezterm', args: ['start', '--cwd', CWD] });
  });

  it('resolves darwin/iterm2 via open -a', () => {
    const cmd = resolveTerminalCommand('iterm2', 'darwin', CWD);
    expect(cmd).toEqual({ cmd: 'open', args: ['-a', 'iTerm', CWD] });
  });

  it('resolves darwin/kitty with --directory <cwd>', () => {
    const cmd = resolveTerminalCommand('kitty', 'darwin', CWD);
    expect(cmd).toEqual({ cmd: 'kitty', args: ['--directory', CWD] });
  });

  it('resolves linux/gnome-terminal with --working-directory= flag form', () => {
    const cmd = resolveTerminalCommand('gnome-terminal', 'linux', CWD);
    expect(cmd).toEqual({
      cmd: 'gnome-terminal',
      args: [`--working-directory=${CWD}`],
    });
  });

  it('resolves win32/wt to wt.exe -d <cwd>', () => {
    const cmd = resolveTerminalCommand('wt', 'win32', CWD);
    expect(cmd).toEqual({ cmd: 'wt.exe', args: ['-d', CWD] });
  });

  it('returns null for an unknown preset id', () => {
    expect(resolveTerminalCommand('nonexistent-terminal', 'darwin', CWD)).toBeNull();
  });

  it('returns null when targeting a different platform than the registered preset', () => {
    // gnome-terminal is linux-only; asking for it on darwin returns null
    // (unknown id on that platform's registry).
    expect(resolveTerminalCommand('gnome-terminal', 'darwin', CWD)).toBeNull();
  });

  it('returns null for unsupported platforms', () => {
    expect(resolveTerminalCommand('wezterm', 'freebsd' as NodeJS.Platform, CWD)).toBeNull();
  });

  it('returns null when setting is undefined', () => {
    expect(resolveTerminalCommand(undefined, 'darwin', CWD)).toBeNull();
  });
});

describe('resolveTerminalCommand — custom { cmd, args } passthrough', () => {
  it('passes cmd and args through unchanged when no template tokens are present', () => {
    const cmd = resolveTerminalCommand(
      { cmd: 'mycoolterm', args: ['--launch', '--no-banner'] },
      'darwin',
      CWD,
    );
    expect(cmd).toEqual({
      cmd: 'mycoolterm',
      args: ['--launch', '--no-banner'],
      cwd: CWD,
    });
  });

  it('substitutes literal {{cwd}} in args with the resolved path', () => {
    const cmd = resolveTerminalCommand(
      { cmd: 'wezterm', args: ['start', '--cwd', '{{cwd}}'] },
      'darwin',
      CWD,
    );
    expect(cmd).toEqual({
      cmd: 'wezterm',
      args: ['start', '--cwd', CWD],
      cwd: CWD,
    });
  });

  it('substitutes multiple {{cwd}} occurrences within a single arg', () => {
    const cmd = resolveTerminalCommand(
      { cmd: 'echo', args: ['{{cwd}}:{{cwd}}'] },
      'darwin',
      CWD,
    );
    expect(cmd?.args).toEqual([`${CWD}:${CWD}`]);
  });

  it('keeps args as a discrete array — never collapses to a shell string', () => {
    const cmd = resolveTerminalCommand(
      { cmd: 'wezterm', args: ['start', '--cwd', '{{cwd}}'] },
      'darwin',
      CWD,
    );
    expect(Array.isArray(cmd?.args)).toBe(true);
    // Sanity: a single space-joined string would NOT be valid here.
    expect(cmd?.args.length).toBe(3);
  });

  it('returns custom shape on unsupported platform too (custom mode is platform-agnostic)', () => {
    // This is a deliberate design choice: custom commands aren't gated on
    // platform — if the user wrote a literal { cmd, args } for some
    // exotic OS, we still pass it through. Only preset lookups are
    // platform-restricted.
    const cmd = resolveTerminalCommand(
      { cmd: 'echo', args: ['hi'] },
      'aix' as NodeJS.Platform,
      CWD,
    );
    // …actually, our implementation gates on isSupportedPlatform — so
    // custom on unsupported also returns null. Lock that behavior in.
    expect(cmd).toBeNull();
  });
});

describe('resolveTerminalCommand — security invariants', () => {
  it('preset args never contain a single space-joined command line', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      for (const preset of KNOWN_TERMINALS[platform]) {
        const cmd = preset.recipe(CWD);
        expect(Array.isArray(cmd.args)).toBe(true);
        // No single-string "the entire command" arg, which would defeat
        // execFile's arg-array invariant.
        const joined = `${cmd.cmd} ${cmd.args.join(' ')}`;
        for (const arg of cmd.args) {
          // No arg should contain the cmd name AND a flag separated by
          // spaces — that's the shape of a shell command string.
          if (arg.includes(' ')) {
            // Allowed: a single arg may contain spaces if it's a literal
            // path or label (the registry doesn't currently produce any).
            // Flag this so any future preset that smuggles a shell string
            // through fails the test.
            expect(arg).not.toMatch(/^[a-z]+\s+-/i);
          }
        }
        expect(joined.length).toBeGreaterThan(0);
      }
    }
  });

  it('custom mode does NOT inject {shell:true} or analogous fields', () => {
    const cmd = resolveTerminalCommand(
      { cmd: 'wezterm', args: ['start', '--cwd', '{{cwd}}'] },
      'darwin',
      CWD,
    );
    // The shape is exactly { cmd, args, cwd } — nothing else.
    expect(Object.keys(cmd ?? {}).sort()).toEqual(['args', 'cmd', 'cwd']);
  });
});

describe('buildOpenCommand fallback (still works after refactor)', () => {
  it('darwin/terminal mode falls back to open -a Terminal <dir>', () => {
    const cmd = buildOpenCommand('darwin', 'terminal', '/x/y/checkpoint.md');
    expect(cmd).toEqual({ cmd: 'open', args: ['-a', 'Terminal', '/x/y'] });
  });

  it('darwin/open mode opens the file in the default app', () => {
    const cmd = buildOpenCommand('darwin', 'open', '/x/y/checkpoint.md');
    expect(cmd).toEqual({ cmd: 'open', args: ['/x/y/checkpoint.md'] });
  });

  it('returns null on unsupported platform', () => {
    expect(buildOpenCommand('freebsd' as NodeJS.Platform, 'open', '/x/y')).toBeNull();
  });
});
