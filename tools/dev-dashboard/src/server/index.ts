import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, parseCliArgs, watchConfig } from './config.js';
import { scanProjects } from './scanner.js';
import { DashboardState } from './state.js';
import { registerApiRoutes } from './api.js';
import { createWsBroadcaster } from './ws.js';
import { createWatcher } from './watcher.js';
import { parseFeature } from './parser.js';

// Works in both ESM (dev/tsc build) and CJS (esbuild bundle)
const __dirname = import.meta.url
  ? dirname(fileURLToPath(import.meta.url))
  : dirname(process.argv[1]);

async function main(): Promise<void> {
  const cliOverrides = parseCliArgs(process.argv.slice(2));
  const config = await loadConfig(cliOverrides);

  const app = Fastify({ logger: false });
  const state = new DashboardState();

  // Scan projects
  const projects = await scanProjects(config.scanDirs);
  state.setProjects(projects);

  // Mount API routes
  registerApiRoutes(app, state);

  // Serve static frontend (production build)
  const clientDir = resolve(__dirname, '../client');
  try {
    await app.register(fastifyStatic, {
      root: clientDir,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback — serve index.html for non-API routes
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    // dist/client/ may not exist in dev mode — Vite handles frontend
  }

  // Start server
  await app.listen({ port: config.port, host: '0.0.0.0' });

  // WebSocket broadcaster — attach to the running HTTP server
  const broadcaster = createWsBroadcaster(app.server, state);

  // Watcher callbacks — shared between initial and reloaded watchers
  const watcherCallbacks = {
    onFeatureUpdated: async (projectPath: string, featureName: string, archived: boolean) => {
      const subdir = archived ? '.dev-archive' : '.dev';
      const featureDir = resolve(projectPath, subdir, featureName);
      const feature = await parseFeature(featureDir, featureName);
      if (archived) feature.status = 'archived';
      state.updateFeature(projectPath, featureName, feature);
      broadcaster.broadcast({
        type: 'feature_updated',
        project: projectPath,
        feature: featureName,
        data: feature,
      });
    },
    onFeatureAdded: async (projectPath: string, featureName: string, archived: boolean) => {
      const subdir = archived ? '.dev-archive' : '.dev';
      const featureDir = resolve(projectPath, subdir, featureName);
      const feature = await parseFeature(featureDir, featureName);
      if (archived) feature.status = 'archived';
      state.addFeature(projectPath, feature);
      broadcaster.broadcast({
        type: 'feature_added',
        project: projectPath,
        feature,
      });
    },
    onFeatureRemoved: (projectPath: string, featureName: string) => {
      state.removeFeature(projectPath, featureName);
      broadcaster.broadcast({
        type: 'feature_removed',
        project: projectPath,
        feature: featureName,
      });
    },
  };

  // File watcher — re-parse changed features and push updates via WebSocket
  let featureWatcher = await createWatcher(config.scanDirs, watcherCallbacks);

  // Config watcher — reload scanDirs on config file changes
  watchConfig(cliOverrides, config.scanDirs, async (newDirs) => {
    console.log(`Config changed — rescanning: ${newDirs.join(', ')}`);
    await featureWatcher.close();
    const projects = await scanProjects(newDirs);
    state.setProjects(projects);
    featureWatcher = await createWatcher(newDirs, watcherCallbacks);
    broadcaster.broadcast({ type: 'full_refresh', data: { projects: state.getProjects() } });
    console.log(`Reloaded: ${state.projectCount} projects with ${state.featureCount} features`);
  });

  console.log(
    `dev-dashboard running at http://localhost:${config.port} — scanning ${config.scanDirs.length} directories`,
  );
  console.log(`Found ${state.projectCount} projects with ${state.featureCount} features`);
}

main().catch((err) => {
  console.error('Failed to start dev-dashboard:', err);
  process.exit(1);
});
