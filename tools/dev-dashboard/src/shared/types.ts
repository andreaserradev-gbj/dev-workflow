// Shared workflow types — re-exported from the core package's types-only
// subpath so the Vite client build never pulls in Node.js code.
export type {
  FeatureStatus,
  Progress,
  Phase,
  SubPrdStep,
  SubPrd,
  Feature,
  Project,
} from 'dev-workflow-core/types';
export { STATUS_ORDER } from 'dev-workflow-core/types';

// ─── Dashboard-only types (API/UI concerns) ──────────────────────

import type { Feature, Phase, Project, SubPrd } from 'dev-workflow-core/types';

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
  scanDirsConfigured: boolean;
}

// WebSocket event types pushed to clients
export type WsEvent =
  | { type: 'feature_updated'; project: string; feature: string; data: Feature }
  | { type: 'feature_added'; project: string; feature: Feature }
  | { type: 'feature_removed'; project: string; feature: string }
  | { type: 'full_refresh'; data: ProjectsResponse };
