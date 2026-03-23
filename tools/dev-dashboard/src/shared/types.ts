// Feature-level status (derived from PRD markdown + checkpoint dates)
export type FeatureStatus =
  | 'active'
  | 'stale'
  | 'complete'
  | 'checkpoint-only'
  | 'no-prd'
  | 'empty';

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
  active: 0,
  stale: 1,
  'no-prd': 2,
  'checkpoint-only': 3,
  empty: 4,
  complete: 5,
};
