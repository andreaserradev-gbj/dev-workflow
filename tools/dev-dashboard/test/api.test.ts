import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, readFile, rm } from 'fs/promises';
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
let originalXdgConfigHome: string | undefined;

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

const mockArchivedFeature: Feature = {
  name: 'old-auth',
  status: 'archived',
  progress: { done: 5, total: 5, percent: 100 },
  currentPhase: null,
  lastCheckpoint: '2026-02-01T10:00:00Z',
  nextAction: null,
  branch: null,
  summary: 'Legacy auth system.',
};

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'api-test-'));
  originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = join(tempDir, 'xdg-config');
  apiServerPath = join(tempDir, 'api-server');
  webClientPath = join(tempDir, 'web-client');

  // Create .dev directories so the access check passes
  await mkdir(join(apiServerPath, '.dev'), { recursive: true });
  await mkdir(join(apiServerPath, '.dev-archive/old-auth'), { recursive: true });
  await mkdir(join(webClientPath, '.dev'), { recursive: true });

  const mockProjects: Project[] = [
    {
      name: 'api-server',
      path: apiServerPath,
      features: [mockFeature, mockStaleFeature, mockArchivedFeature],
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
  if (originalXdgConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
  }
  await rm(tempDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  it('returns status ok with counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.projects).toBe(2);
    expect(body.features).toBe(4);
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
    expect(apiServer.features).toHaveLength(3);

    const webClient = body.projects.find((p: Project) => p.name === 'web-client');
    expect(webClient).toBeDefined();
    expect(webClient.features).toHaveLength(1);
  });

  it('keeps project alive if only .dev-archive exists', async () => {
    // Create a project with only .dev-archive (no .dev)
    const archiveOnlyPath = join(tempDir, 'archive-only');
    await mkdir(join(archiveOnlyPath, '.dev-archive'), { recursive: true });

    const archiveOnlyState = new DashboardState();
    archiveOnlyState.setProjects([
      {
        name: 'archive-only',
        path: archiveOnlyPath,
        features: [mockArchivedFeature],
      },
    ]);

    const archiveApp = Fastify();
    registerApiRoutes(archiveApp, archiveOnlyState);
    await archiveApp.ready();

    const res = await archiveApp.inject({ method: 'GET', url: '/api/projects' });
    const body = res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe('archive-only');

    await archiveApp.close();
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

  it('resolves archived feature detail from .dev-archive path', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/api-server/features/old-auth',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('old-auth');
    expect(body.status).toBe('archived');
    expect(body.project).toBe('api-server');
  });
});

describe('GET /api/config', () => {
  it('creates and returns onboarding-ready defaults on first read', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      scanDirs: [],
      port: 3141,
      notifications: false,
      scanDirsConfigured: false,
    });
  });
});

describe('POST /api/config', () => {
  it('persists scan directories and marks onboarding complete', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/config',
      payload: {
        scanDirs: ['~/code', '  ~/work  ', '~/code'],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      scanDirs: ['~/code', '~/work'],
      port: 3141,
      notifications: false,
      scanDirsConfigured: true,
    });

    const raw = await readFile(
      join(process.env.XDG_CONFIG_HOME!, 'dev-dashboard', 'config.json'),
      'utf-8',
    );
    expect(JSON.parse(raw)).toMatchObject({
      scanDirs: ['~/code', '~/work'],
      scanDirsConfigured: true,
    });
  });
});
