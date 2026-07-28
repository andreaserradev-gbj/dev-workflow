// Feature-level status (derived from PRD markdown + checkpoint dates)
export type FeatureStatus =
  | 'gate'
  | 'active'
  | 'stale'
  | 'complete'
  | 'checkpoint-only'
  | 'no-prd'
  | 'empty'
  | 'archived';

// Step-level progress
export interface Progress {
  done: number;
  total: number;
  percent: number;
}

// Phase from master plan
export interface Phase {
  number: number;
  title: string;
  done: number;
  total: number;
  status: 'complete' | 'in-progress' | 'not-started';
}

// Sub-PRD step
export interface SubPrdStep {
  /** Step identifier as written in the table — e.g. `"1"`, `"3A"`, `"3A.1"`. */
  number: string;
  description: string;
  /**
   * Deliberately stays a two-value union. A step whose status cell carries an
   * unrecognized glyph reads as `pending` — it is not done, and that is the
   * only question this field answers. Adding an `'unknown'` member would break
   * exhaustive switches in the dashboard and TUI renderers for no user-visible
   * gain; `unrecognizedMarker` carries the extra detail instead.
   */
  status: 'done' | 'pending';
  /**
   * The status cell's glyph when it was not one of the known markers — `''`
   * when the cell was empty or opened with prose. Absent for recognized
   * markers, so existing JSON payloads are unchanged.
   *
   * Present means: this step still counts toward `total`, but its status could
   * not be read, so it was counted as not done.
   */
  unrecognizedMarker?: string;
}

// Sub-PRD summary
export interface SubPrd {
  id: string;
  title: string;
  done: number;
  total: number;
  status: 'complete' | 'in-progress' | 'not-started';
  steps: SubPrdStep[];
  /**
   * Whether this sub-PRD's `done`/`total` step counts are a live progress
   * source. Absent (or `true`) for the normal case. Set to `false` for the
   * redundant-hybrid shape — a feature whose master plan owns the phases and
   * carries its own inline-step progress while the sub-PRDs *also* keep their
   * own Implementation Progress tables. No writer advances those tables
   * (status-update targets the master plan), so their counters are dead;
   * renderers hide the count and fall back to `status` (from the sub-PRD's
   * `**Status**` header). See buildFeatureDetail.
   */
  countsAuthoritative?: boolean;
}

// Feature summary (used in portfolio list view)
export interface Feature {
  name: string;
  status: FeatureStatus;
  progress: Progress | null;
  currentPhase: { number: number; total: number; title: string } | null;
  lastCheckpoint: string | null;
  created: string | null;
  lastUpdated: string | null;
  nextAction: string | null;
  branch: string | null;
  summary: string | null;
  // Searchable/render tags: frontmatter `tags:` ∪ deterministic keyword tags.
  // Always present (defaults to []); never null.
  tags: string[];
  /**
   * Parse-time problems that make this feature's numbers untrustworthy —
   * chiefly steps whose status marker could not be recognized.
   *
   * Structured rather than logged, deliberately: core is imported by the Ink
   * TUI, which renders to stdout while a file watcher re-parses in the
   * background, so a stray `console.warn` splatters the render surface. A
   * dashboard server log is no better — an invisible failure is precisely the
   * mode being fixed here.
   *
   * The key is omitted entirely when there is nothing to report, so payloads
   * for healthy features keep their existing shape.
   */
  warnings?: string[];
}

// Project groups features by parent directory
export interface Project {
  name: string;
  path: string;
  features: Feature[];
}

// Checkpoint write input — camelCase internally, snake_case at YAML boundary
export interface CheckpointWriteInput {
  branch?: string;
  lastCommit?: string;
  uncommittedChanges?: boolean;
  checkpointed?: string; // ISO 8601, defaults to now
  prdFiles?: string[]; // "Read the following PRD files in order" list
  context: string;
  currentState: string;
  nextAction: string;
  keyFiles: string;
  decisions?: string[];
  blockers?: string[];
  notes?: string[];
  continuationPrompt?: string; // final "Please continue with..." line
}

// Session digest write input — camelCase internally, snake_case at YAML boundary.
// Composed by the /dev-checkpoint skill (the LLM); persisted by writeSessionDigest.
export interface SessionDigestWriteInput {
  sessionCount: number; // total sessions in session-log.md at consolidation time
  consolidatedThrough: number; // highest session number folded into the aggregate
  generated?: string; // ISO 8601, defaults to now
  aggregate: string; // distilled narrative of the older session tail
  decisions?: string[]; // bounded decision set carried forward from consolidated sessions
}

// Status update target and result
export interface StepTarget {
  phase: number; // which phase's steps to target
  step?: number; // specific step number (omit for phase-level marker)
}

export type StatusMarker = '✅' | '⬜';

export interface StatusUpdateResult {
  changed: boolean;
  line: number;
  file: string;
}

// Session log entry from session-log.md
export interface SessionLogEntry {
  session: number;
  date: string;
  context: string | null;
  decisions: string[];
  blockers: string[];
  notes: string[];
}

// Expanded feature detail — a Feature plus its parsed checkpoint fields,
// master-plan phases, sub-PRDs, and session log. Assembled by buildFeatureDetail()
// and shared by the dashboard API (GET /api/projects/:project/features/:feature)
// and the TUI detail pane, so the assembly lives in exactly one place.
export interface FeatureDetail extends Feature {
  project: string;
  checkpoint: {
    nextAction: string | null;
    decisions: string[];
    blockers: string[];
    notes: string[];
  } | null;
  phases: Phase[];
  subPrds: SubPrd[];
  // Parsed session-log.md entries in file order (Session 1 = oldest, last = newest).
  // null when session-log.md is absent or empty; populated array otherwise.
  sessionLog: SessionLogEntry[] | null;
}

// Session digest parsed from session-digest.md — a distilled narrative of the
// older session tail plus a bounded decision set, kept in a SEPARATE file from
// session-log.md so the `## Session N` counter is never inflated.
export interface SessionDigest {
  sessionCount: number; // total sessions present when the digest was written
  consolidatedThrough: number; // highest session number folded into the aggregate
  generated: string | null; // ISO 8601 (null when absent/unparseable)
  aggregate: string | null; // distilled narrative of the consolidated older sessions
  decisions: string[]; // bounded, deduplicated decision set carried forward
}

// Search input options
export interface SearchOptions {
  query: string;
  maxResults?: number;
}

// A single search hit with context
export interface SearchHit {
  project: string;
  feature: Feature;
  matches: SearchMatch[];
  score: number;
}

// Where a match was found
export interface SearchMatch {
  field: string;
  snippet: string;
}

// ─── Live dashboard/TUI config shapes ────────────────────────────
// Node-free config-shape types shared by the dashboard server, the live config
// I/O in `./live`, and (future) the terminal UI. Declared here in the node-free
// `./types` barrel so the browser client and type-only consumers never resolve
// the node-only `./live` runtime (which pulls in chokidar).

// User's terminal-launch setting per platform.
//   - string  → preset id (server's terminal-presets registry resolves it).
//   - object  → literal { cmd, args }; args may contain '{{cwd}}' which the
//     server substitutes with the feature dir before execFile.
// The discrete-args invariant is preserved end-to-end — `args` stays an
// array, never a single shell string.
export type TerminalSetting = string | { cmd: string; args: string[] };

export interface TerminalConfig {
  darwin?: TerminalSetting;
  linux?: TerminalSetting;
  win32?: TerminalSetting;
}

// Dashboard config (~/.config/dev-dashboard/config.json)
export interface DashboardConfig {
  scanDirs: string[];
  port: number;
  // Network interface the server binds to. Defaults to '127.0.0.1' (loopback —
  // reachable only from this machine). LAN exposure ('0.0.0.0') is opt-in.
  host: string;
  notifications: boolean;
  scanDirsConfigured: boolean;
  terminal: TerminalConfig;
  wikiDir?: string;
}

// CLI/env overrides layered on top of the persisted config at load time.
export interface CliOverrides {
  scan?: string[];
  port?: number;
  host?: string;
}

// Status sort order — gate first (needs user action), complete last
export const STATUS_ORDER: Record<FeatureStatus, number> = {
  gate: 0,
  active: 1,
  'checkpoint-only': 2,
  stale: 3,
  'no-prd': 4,
  empty: 5,
  complete: 6,
  archived: 7,
};
