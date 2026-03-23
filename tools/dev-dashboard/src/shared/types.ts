// Feature-level status (derived from session-state + markdown heuristics)
export type FeatureStatus =
  | 'active'
  | 'gate'
  | 'stale'
  | 'complete'
  | 'checkpoint-only'
  | 'no-prd'
  | 'empty';

// Session-state.json status field
export type SessionStatus = 'active' | 'gate' | 'idle';

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

// Live session state (from session-state.json)
export interface SessionState {
  status: SessionStatus;
  phase: number | null;
  gateLabel: string | null;
  since: string;
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
  nextAction: string | null;
  branch: string | null;
  session: SessionState | null;
  summary: string | null;
}

// Project groups features by parent directory
export interface Project {
  name: string;
  path: string;
  features: Feature[];
}

// GET /api/projects response
export interface ProjectsResponse {
  projects: Project[];
}

// Expanded feature detail (GET /api/projects/:project/features/:feature)
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
}

// GET /api/health response
export interface HealthResponse {
  status: 'ok';
  projects: number;
  features: number;
}

// Dashboard config (~/.config/dev-dashboard/config.json)
export interface DashboardConfig {
  scanDirs: string[];
  port: number;
  notifications: boolean;
}

// Status sort order (matches board-template.html)
export const STATUS_ORDER: Record<FeatureStatus, number> = {
  gate: 0,
  active: 1,
  stale: 2,
  'no-prd': 3,
  'checkpoint-only': 4,
  empty: 5,
  complete: 6,
};
