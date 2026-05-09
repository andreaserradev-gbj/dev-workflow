// Server-side terminal preset registry.
//
// Each preset names a terminal application and carries a pure recipe
// (cwd: string) => { cmd, args, cwd? } that the open-route handler invokes
// to launch that terminal at a feature directory. The user picks a preset
// id (e.g. 'wezterm') in the UI; the server resolves it through this
// registry to discrete cmd + args before execFile. The user never composes
// a shell command line, so the discrete-args invariant from the parent
// feature is preserved end-to-end.
//
// `Custom…` mode bypasses the registry — the user provides
// { cmd, args } directly and the server substitutes literal '{{cwd}}'
// occurrences in args with the resolved feature dir.

import type { TerminalSetting } from '../shared/types.js';

export interface TerminalCommand {
  cmd: string;
  args: string[];
  cwd?: string;
}

export interface PresetRecipe {
  id: string;
  label: string;
  recipe: (cwd: string) => TerminalCommand;
}

type SupportedPlatform = 'darwin' | 'linux' | 'win32';

export const KNOWN_TERMINALS: Record<SupportedPlatform, PresetRecipe[]> = {
  darwin: [
    {
      id: 'terminal',
      label: 'Terminal',
      recipe: (cwd) => ({ cmd: 'open', args: ['-a', 'Terminal', cwd] }),
    },
    {
      id: 'iterm2',
      label: 'iTerm2',
      recipe: (cwd) => ({ cmd: 'open', args: ['-a', 'iTerm', cwd] }),
    },
    {
      id: 'wezterm',
      label: 'WezTerm',
      recipe: (cwd) => ({ cmd: 'wezterm', args: ['start', '--cwd', cwd] }),
    },
    {
      id: 'ghostty',
      label: 'Ghostty',
      recipe: (cwd) => ({ cmd: 'open', args: ['-a', 'Ghostty', cwd] }),
    },
    {
      id: 'kitty',
      label: 'Kitty',
      recipe: (cwd) => ({ cmd: 'kitty', args: ['--directory', cwd] }),
    },
    {
      id: 'alacritty',
      label: 'Alacritty',
      recipe: (cwd) => ({ cmd: 'alacritty', args: ['--working-directory', cwd] }),
    },
    {
      id: 'warp',
      label: 'Warp',
      recipe: (cwd) => ({ cmd: 'open', args: ['-a', 'Warp', cwd] }),
    },
  ],
  linux: [
    {
      id: 'gnome-terminal',
      label: 'GNOME Terminal',
      recipe: (cwd) => ({ cmd: 'gnome-terminal', args: [`--working-directory=${cwd}`] }),
    },
    {
      id: 'konsole',
      label: 'Konsole',
      recipe: (cwd) => ({ cmd: 'konsole', args: ['--workdir', cwd] }),
    },
    {
      id: 'wezterm',
      label: 'WezTerm',
      recipe: (cwd) => ({ cmd: 'wezterm', args: ['start', '--cwd', cwd] }),
    },
    {
      id: 'kitty',
      label: 'Kitty',
      recipe: (cwd) => ({ cmd: 'kitty', args: ['--directory', cwd] }),
    },
    {
      id: 'alacritty',
      label: 'Alacritty',
      recipe: (cwd) => ({ cmd: 'alacritty', args: ['--working-directory', cwd] }),
    },
  ],
  win32: [
    {
      id: 'wt',
      label: 'Windows Terminal',
      recipe: (cwd) => ({ cmd: 'wt.exe', args: ['-d', cwd] }),
    },
    {
      id: 'wezterm',
      label: 'WezTerm',
      recipe: (cwd) => ({ cmd: 'wezterm', args: ['start', '--cwd', cwd] }),
    },
    {
      id: 'alacritty',
      label: 'Alacritty',
      recipe: (cwd) => ({ cmd: 'alacritty', args: ['--working-directory', cwd] }),
    },
  ],
};

function isSupportedPlatform(platform: NodeJS.Platform): platform is SupportedPlatform {
  return platform === 'darwin' || platform === 'linux' || platform === 'win32';
}

// Resolve a TerminalSetting (preset id or literal {cmd, args}) into the
// concrete shape execFile expects. Returns null when the setting is absent,
// references an unknown preset, or targets an unsupported platform — the
// caller falls back to buildOpenCommand in those cases.
export function resolveTerminalCommand(
  setting: TerminalSetting | undefined,
  platform: NodeJS.Platform,
  cwd: string,
): TerminalCommand | null {
  if (!setting) return null;
  if (!isSupportedPlatform(platform)) return null;

  if (typeof setting === 'string') {
    const preset = KNOWN_TERMINALS[platform].find((p) => p.id === setting);
    if (!preset) return null;
    return preset.recipe(cwd);
  }

  return {
    cmd: setting.cmd,
    args: setting.args.map((a) => a.replace(/\{\{cwd\}\}/g, cwd)),
    cwd,
  };
}
