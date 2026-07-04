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
  SessionLogEntry,
  TerminalSetting,
  TerminalConfig,
  DashboardConfig,
} from 'dev-workflow-core/types';
export { STATUS_ORDER } from 'dev-workflow-core/types';

// ─── Dashboard-only types (API/UI concerns) ──────────────────────

import type {
  DashboardConfig,
  Feature,
  Phase,
  Project,
  SessionLogEntry,
  SubPrd,
} from 'dev-workflow-core/types';

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
  // Parsed session-log.md entries in file order (Session 1 = oldest, last = newest).
  // null when session-log.md is absent or empty; populated array otherwise.
  sessionLog: SessionLogEntry[] | null;
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

// TerminalSetting, TerminalConfig, and DashboardConfig are re-exported above from
// the node-free `dev-workflow-core/types` barrel (the core is their single owner).

// GET /api/config response wrapper. Carries the persisted DashboardConfig
// alongside platform/version/configPath so the client About tab and the
// platform-aware Terminal tab can read them in one round-trip.
export interface DashboardConfigResponse extends DashboardConfig {
  platform: NodeJS.Platform;
  version: string;
  configPath: string;
}

// GET /api/search response
export interface DashboardSearchHit {
  name: string;
  projectName: string;
  status: string;
  progress: { done: number; total: number } | null;
  currentPhase: string | null;
  snippet: string | null;
  matchedFields: string[];
}

export interface SearchResponse {
  query: string;
  hits: DashboardSearchHit[];
}

// WebSocket event types pushed to clients
export type WsEvent =
  | { type: 'feature_updated'; project: string; feature: string; data: Feature }
  | { type: 'feature_added'; project: string; feature: Feature }
  | { type: 'feature_removed'; project: string; feature: string }
  | { type: 'full_refresh'; data: ProjectsResponse };
