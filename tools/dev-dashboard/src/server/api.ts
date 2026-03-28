import { access, mkdir, readdir, rename } from 'fs/promises';
import { resolve } from 'path';
import type { FastifyInstance } from 'fastify';
import type {
  DashboardConfig,
  FeatureDetail,
  Project,
  ReportFeature,
  ReportResponse,
} from '../shared/types.js';
import type { DashboardState } from './state.js';
import { readStoredConfig, updateConfig } from './config.js';
import { parseCheckpoint, parseMasterPlan, parseSubPrd } from './parser.js';

export function registerApiRoutes(app: FastifyInstance, state: DashboardState): void {
  app.get('/api/health', async () => {
    return {
      status: 'ok' as const,
      projects: state.projectCount,
      features: state.featureCount,
    };
  });

  app.get('/api/projects', async () => {
    const projects = state.getProjects();

    // Filter out projects whose .dev or .dev-archive directories no longer exist on disk,
    // and prune them from state so the watcher doesn't need to catch up
    const alive: Project[] = [];
    for (const project of projects) {
      let hasDevDir = false;
      try {
        await access(resolve(project.path, '.dev'));
        hasDevDir = true;
      } catch {
        // .dev doesn't exist
      }
      if (!hasDevDir) {
        try {
          await access(resolve(project.path, '.dev-archive'));
          hasDevDir = true;
        } catch {
          // .dev-archive doesn't exist either
        }
      }
      if (hasDevDir) {
        alive.push(project);
      } else {
        state.removeProject(project.path);
      }
    }

    return { projects: alive };
  });

  app.get<{
    Params: { project: string; feature: string };
  }>('/api/projects/:project/features/:feature', async (request, reply) => {
    const { project: projectName, feature: featureName } = request.params;

    const project = state.getProject(projectName);
    if (!project) {
      return reply.status(404).send({ error: `Project "${projectName}" not found` });
    }

    const feature = project.features.find((f) => f.name === featureName);
    if (!feature) {
      return reply
        .status(404)
        .send({ error: `Feature "${featureName}" not found in "${projectName}"` });
    }

    const devSubdir = feature.status === 'archived' ? '.dev-archive' : '.dev';
    const featureDir = resolve(project.path, devSubdir, featureName);
    const masterPlan = await parseMasterPlan(resolve(featureDir, '00-master-plan.md'));
    const checkpoint = await parseCheckpoint(resolve(featureDir, 'checkpoint.md'));

    // Parse sub-PRDs (files matching NN-sub-prd-*.md)
    const subPrds: FeatureDetail['subPrds'] = [];
    try {
      const entries = await readdir(featureDir);
      const subPrdFiles = entries.filter((e) => /^\d+-sub-prd-.*\.md$/.test(e)).sort();
      for (const file of subPrdFiles) {
        const result = await parseSubPrd(resolve(featureDir, file));
        if (result) subPrds.push(result);
      }
    } catch {
      // Feature dir not readable — subPrds stays empty
    }

    const detail: FeatureDetail = {
      ...feature,
      project: projectName,
      checkpoint: checkpoint
        ? {
            nextAction: checkpoint.nextAction,
            decisions: checkpoint.decisions,
            blockers: checkpoint.blockers,
            notes: checkpoint.notes,
          }
        : null,
      phases: masterPlan?.phases ?? [],
      subPrds,
    };

    return detail;
  });

  app.get<{
    Querystring: { from: string; to: string; project?: string };
  }>('/api/report', async (request, reply) => {
    const fromDate = new Date(request.query.from);
    const toDate = new Date(request.query.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return reply.status(400).send({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Make toDate inclusive (end of day)
    toDate.setHours(23, 59, 59, 999);

    const projects = state.getProjects();
    const filtered = request.query.project
      ? projects.filter((p) => p.name === request.query.project)
      : projects;

    const features: ReportFeature[] = [];
    for (const project of filtered) {
      for (const feature of project.features) {
        if (
          isInRange(feature.lastCheckpoint, fromDate, toDate) ||
          isInRange(feature.created, fromDate, toDate) ||
          isInRange(feature.lastUpdated, fromDate, toDate)
        ) {
          features.push({ ...feature, project: project.name });
        }
      }
    }

    const response: ReportResponse = {
      features,
      from: request.query.from,
      to: request.query.to,
    };
    return reply.send(response);
  });

  app.get('/api/config', async () => {
    return readStoredConfig();
  });

  app.post<{
    Body: { notifications?: boolean; scanDirs?: string[] };
  }>('/api/config', async (request) => {
    const { notifications, scanDirs } = request.body ?? {};
    const patch: Partial<DashboardConfig> = {};
    if (typeof notifications === 'boolean') {
      patch.notifications = notifications;
    }
    if (Array.isArray(scanDirs)) {
      patch.scanDirs = scanDirs;
    }
    const updated = await updateConfig(patch);
    return updated;
  });

  // ─── Archive / Restore ────────────────────────────────────────

  app.post<{
    Params: { project: string; feature: string };
  }>('/api/projects/:project/features/:feature/archive', async (request, reply) => {
    const { project: projectName, feature: featureName } = request.params;
    const project = state.getProject(projectName);
    if (!project) {
      return reply.status(404).send({ error: `Project "${projectName}" not found` });
    }

    const src = resolve(project.path, '.dev', featureName);
    const destDir = resolve(project.path, '.dev-archive');
    const dest = resolve(destDir, featureName);

    try {
      await access(src);
    } catch {
      return reply.status(404).send({ error: `Feature "${featureName}" not found in .dev/` });
    }

    await mkdir(destDir, { recursive: true });
    await rename(src, dest);
    return { ok: true };
  });

  app.post<{
    Params: { project: string; feature: string };
  }>('/api/projects/:project/features/:feature/restore', async (request, reply) => {
    const { project: projectName, feature: featureName } = request.params;
    const project = state.getProject(projectName);
    if (!project) {
      return reply.status(404).send({ error: `Project "${projectName}" not found` });
    }

    const src = resolve(project.path, '.dev-archive', featureName);
    const destDir = resolve(project.path, '.dev');
    const dest = resolve(destDir, featureName);

    try {
      await access(src);
    } catch {
      return reply
        .status(404)
        .send({ error: `Feature "${featureName}" not found in .dev-archive/` });
    }

    await mkdir(destDir, { recursive: true });
    await rename(src, dest);
    return { ok: true };
  });
}

function isInRange(dateStr: string | null, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= from && d <= to;
}
