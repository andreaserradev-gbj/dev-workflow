import { access, readdir } from 'fs/promises';
import { resolve } from 'path';
import type { FastifyInstance } from 'fastify';
import type { FeatureDetail, Project } from '../shared/types.js';
import type { DashboardState } from './state.js';
import { updateConfig } from './config.js';
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

    // Filter out projects whose .dev directories no longer exist on disk,
    // and prune them from state so the watcher doesn't need to catch up
    const alive: Project[] = [];
    for (const project of projects) {
      try {
        await access(resolve(project.path, '.dev'));
        alive.push(project);
      } catch {
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

    const featureDir = resolve(project.path, '.dev', featureName);
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

  app.post<{
    Body: { notifications?: boolean };
  }>('/api/config', async (request) => {
    const { notifications } = request.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof notifications === 'boolean') {
      patch.notifications = notifications;
    }
    const updated = await updateConfig(patch);
    return { notifications: updated.notifications };
  });
}
