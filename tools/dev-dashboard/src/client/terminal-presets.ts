// Client-side terminal preset metadata.
//
// Pure label table — the server owns recipe resolution via
// `KNOWN_TERMINALS` in `src/server/terminal-presets.ts`. The two lists must
// keep their `id` values in sync; if a preset is added/renamed server-side,
// update the matching entry here. The client never resolves recipes itself.

import type { TerminalConfig, TerminalSetting } from '../shared/types.js';

export interface PresetMeta {
  id: string;
  label: string;
}

const TERMINAL_PRESETS: Record<string, PresetMeta[]> = {
  darwin: [
    { id: 'terminal', label: 'Terminal' },
    { id: 'iterm2', label: 'iTerm2' },
    { id: 'wezterm', label: 'WezTerm' },
    { id: 'ghostty', label: 'Ghostty' },
    { id: 'kitty', label: 'Kitty' },
    { id: 'alacritty', label: 'Alacritty' },
    { id: 'warp', label: 'Warp' },
  ],
  linux: [
    { id: 'gnome-terminal', label: 'GNOME Terminal' },
    { id: 'konsole', label: 'Konsole' },
    { id: 'wezterm', label: 'WezTerm' },
    { id: 'kitty', label: 'Kitty' },
    { id: 'alacritty', label: 'Alacritty' },
  ],
  win32: [
    { id: 'wt', label: 'Windows Terminal' },
    { id: 'wezterm', label: 'WezTerm' },
    { id: 'alacritty', label: 'Alacritty' },
  ],
};

export function getPlatformPresets(platform: string): PresetMeta[] {
  return TERMINAL_PRESETS[platform] ?? [];
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    case 'win32':
      return 'Windows';
    default:
      return platform;
  }
}

// Form draft state. `selection === ''` represents "no setting saved" (server
// falls back to default open behavior). `selection === 'custom'` reveals the
// inline cmd + args fields. Anything else is a preset id.
//
// `customCmd` and `customArgs` are preserved across selection toggles so a
// user who picks a preset, switches back to Custom…, gets their typed values
// back instead of empty fields.
export interface TerminalDraft {
  selection: string;
  customCmd: string;
  customArgs: string;
}

export const EMPTY_TERMINAL_DRAFT: TerminalDraft = {
  selection: '',
  customCmd: '',
  customArgs: '',
};

// Build the initial draft from a persisted TerminalConfig (or undefined),
// looking up the entry for `platform`. Unsupported platforms (no entry) yield
// the empty draft.
export function deriveTerminalDraft(
  terminal: TerminalConfig | undefined,
  platform: string,
): TerminalDraft {
  const setting = terminal?.[platform as keyof TerminalConfig];
  if (!setting) {
    return { ...EMPTY_TERMINAL_DRAFT };
  }
  if (typeof setting === 'string') {
    const known = getPlatformPresets(platform).some((p) => p.id === setting);
    if (known) {
      return { selection: setting, customCmd: '', customArgs: '' };
    }
    // Unknown preset id (e.g. preset removed from registry, or hand-edited
    // config). Surface as Custom… with cmd populated from the literal id so
    // the user sees their own value rather than silent reset.
    return { selection: 'custom', customCmd: setting, customArgs: '' };
  }
  return {
    selection: 'custom',
    customCmd: setting.cmd,
    customArgs: setting.args.join('\n'),
  };
}

// Convert a draft to the persisted shape. Returns:
//   - null  → unset this platform's setting (sent in POST body to clear)
//   - string → preset id
//   - { cmd, args } → custom literal
//
// Throws on Custom… with empty cmd; the form-level validation catches that
// before reaching this function, but the throw documents the invariant.
export function draftToSetting(draft: TerminalDraft): TerminalSetting | null {
  if (draft.selection === '') {
    return null;
  }
  if (draft.selection === 'custom') {
    const cmd = draft.customCmd.trim();
    if (!cmd) {
      throw new Error('Command is required when Custom… is selected.');
    }
    const args = draft.customArgs
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { cmd, args };
  }
  return draft.selection;
}

// Compare a draft to the persisted setting for the same platform. True when
// the draft would change the saved value if submitted.
export function isTerminalDraftDirty(
  draft: TerminalDraft,
  terminal: TerminalConfig | undefined,
  platform: string,
): boolean {
  const persisted = terminal?.[platform as keyof TerminalConfig];
  let next: TerminalSetting | null;
  try {
    next = draftToSetting(draft);
  } catch {
    // Invalid draft (e.g. Custom… with empty cmd) — treat as dirty so Save
    // is enabled and the form-level validation can surface the error.
    return true;
  }
  if (next === null && persisted === undefined) return false;
  if (next === null || persisted === undefined) return true;
  if (typeof next === 'string' || typeof persisted === 'string') {
    return next !== persisted;
  }
  if (next.cmd !== persisted.cmd) return true;
  if (next.args.length !== persisted.args.length) return true;
  return next.args.some((a, i) => a !== persisted.args[i]);
}
