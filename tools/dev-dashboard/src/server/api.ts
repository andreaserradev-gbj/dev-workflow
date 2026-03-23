import type { FastifyInstance } from 'fastify';
import type { DashboardState } from './state.js';

export function registerApiRoutes(app: FastifyInstance, state: DashboardState): void {
  app.get('/api/health', async () => {
    return {
      status: 'ok' as const,
      projects: state.projectCount,
      features: state.featureCount,
    };
  });

  app.get('/api/projects', async () => {
    return { projects: state.getProjects() };
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
      return reply.status(404).send({ error: `Feature "${featureName}" not found in "${projectName}"` });
    }

    return { ...feature, project: projectName };
  });
}
