import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { DashboardState } from '../src/server/state.js';
import { registerApiRoutes } from '../src/server/api.js';
import type { Feature, Project } from '../src/shared/types.js';

let app: FastifyInstance;
let state: DashboardState;
let tempDir: string;
let apiServerPath: string;
let webClientPath: string;

const mockFeature: Feature = {
  name: 'auth-system',
  status: 'active',
  progress: { done: 8, total: 13, percent: 62 },
  currentPhase: { number: 2, total: 3, title: 'Token Management' },
  lastCheckpoint: '2026-03-20T14:30:00Z',
  nextAction: 'Implement refresh token rotation',
  branch: 'feature/auth-system',
  summary: 'Multi-provider authentication with OAuth2 and JWT.',
};

const mockStaleFeature: Feature = {
  name: 'notifications',
  status: 'stale',
  progress: { done: 3, total: 6, percent: 50 },
  currentPhase: { number: 2, total: 2, title: 'Push Notifications' },
  lastCheckpoint: null,
  nextAction: null,
  branch: null,
  summary: 'Event-driven notification system.',
};

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'api-test-'));
  apiServerPath = join(tempDir, 'api-server');
  webClientPath = join(tempDir, 'web-client');

  // Create .dev directories so the access check passes
  await mkdir(join(apiServerPath, '.dev'), { recursive: true });
  await mkdir(join(webClientPath, '.dev'), { recursive: true });

  const mockProjects: Project[] = [
    {
      name: 'api-server',
      path: apiServerPath,
      features: [mockFeature, mockStaleFeature],
    },
    {
      name: 'web-client',
      path: webClientPath,
      features: [
        {
          name: 'dashboard-ui',
          status: 'complete',
          progress: { done: 5, total: 5, percent: 100 },
          currentPhase: null,
          lastCheckpoint: '2026-03-15T10:00:00Z',
          nextAction: null,
          branch: 'feature/dashboard-ui',
          summary: 'Dashboard UI components.',
        },
      ],
    },
  ];

  state = new DashboardState();
  state.setProjects(mockProjects);

  app = Fastify();
  registerApiRoutes(app, state);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await rm(tempDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  it('returns status ok with counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.projects).toBe(2);
    expect(body.features).toBe(3);
  });
});

describe('GET /api/projects', () => {
  it('returns all projects with features', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projects).toHaveLength(2);

    const apiServer = body.projects.find((p: Project) => p.name === 'api-server');
    expect(apiServer).toBeDefined();
    expect(apiServer.features).toHaveLength(2);

    const webClient = body.projects.find((p: Project) => p.name === 'web-client');
    expect(webClient).toBeDefined();
    expect(webClient.features).toHaveLength(1);
  });

  it('includes correct feature data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    const body = res.json();

    const apiServer = body.projects.find((p: Project) => p.name === 'api-server');
    const auth = apiServer.features.find((f: Feature) => f.name === 'auth-system');

    expect(auth.status).toBe('active');
    expect(auth.progress).toMatchObject({ done: 8, total: 13 });
    expect(auth.branch).toBe('feature/auth-system');
  });
});

describe('GET /api/projects/:project/features/:feature', () => {
  it('returns a specific feature', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/api-server/features/auth-system',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('auth-system');
    expect(body.status).toBe('active');
    expect(body.project).toBe('api-server');
  });

  it('returns 404 for unknown project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/unknown-project/features/auth-system',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 for unknown feature', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/api-server/features/nonexistent',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBeDefined();
  });
});
