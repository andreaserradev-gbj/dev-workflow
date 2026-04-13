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
  number: number;
  description: string;
  status: 'done' | 'pending';
}

// Sub-PRD summary
export interface SubPrd {
  id: string;
  title: string;
  done: number;
  total: number;
  status: 'complete' | 'in-progress' | 'not-started';
  steps: SubPrdStep[];
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