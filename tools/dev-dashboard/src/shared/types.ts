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

// Feature annotated with project name (for cross-project report view)
export interface ReportFeature extends Feature {
  project: string;
}

// GET /api/report response
export interface ReportResponse {
  features: ReportFeature[];
  from: string;
  to: string;
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

// WebSocket event types pushed to clients
export type WsEvent =
  | { type: 'feature_updated'; project: string; feature: string; data: Feature }
  | { type: 'feature_added'; project: string; feature: Feature }
  | { type: 'feature_removed'; project: string; feature: string }
  | { type: 'full_refresh'; data: ProjectsResponse };

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
