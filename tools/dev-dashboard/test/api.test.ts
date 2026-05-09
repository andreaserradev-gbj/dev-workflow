import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { execFile } from 'node:child_process';
import { DashboardState } from '../src/server/state.js';
import { registerApiRoutes } from '../src/server/api.js';
import type { Feature, Project } from '../src/shared/types.js';

// Mock execFile so the open route never actually launches OS processes.
// The factory passes through everything else from node:child_process.
vi.mock('node:child_process', async () => {
  const actual =
    await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn(
      (
        _cmd: string,
        _args: readonly string[] | undefined,
        options: unknown,
        callback?: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const cb = typeof options === 'function' ? options : callback;
        if (cb) cb(null, '', '');
        return undefined as unknown as ReturnType<typeof execFile>;
      },
    ),
  };
});

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

  describe('sessionLog', () => {
    beforeAll(async () => {
      // Two-session fixture exercising both the file-format parser and the
      // server's null-vs-array collapse rule.
      const fixture = `## Session 1 — 2026-04-01T10:00:00Z

<context>
First session context.
</context>

<decisions>
- Decision A1.
- Decision A2.
</decisions>

<blockers>
- Blocker A1.
</blockers>

<notes>
- Note A1.
</notes>

---

## Session 2 — 2026-04-02T11:00:00Z

<context>
Second session context.
</context>

<decisions>
- Decision B1.
</decisions>
`;
      // Ensure the feature dir exists before dropping the fixture in.
      await mkdir(join(apiServerPath, '.dev/auth-system'), { recursive: true });
      await writeFile(
        join(apiServerPath, '.dev/auth-system/session-log.md'),
        fixture,
        'utf-8',
      );
    });

    it('returns sessionLog populated when session-log.md exists', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/api-server/features/auth-system',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sessionLog).toBeInstanceOf(Array);
      expect(body.sessionLog).toHaveLength(2);

      // File order: Session 1 = oldest (first in file).
      expect(body.sessionLog[0].session).toBe(1);
      expect(body.sessionLog[0].date).toBe('2026-04-01T10:00:00Z');
      expect(body.sessionLog[0].context).toContain('First session context');
      expect(body.sessionLog[0].decisions).toEqual(['Decision A1.', 'Decision A2.']);
      expect(body.sessionLog[0].blockers).toEqual(['Blocker A1.']);

      expect(body.sessionLog[1].session).toBe(2);
      expect(body.sessionLog[1].date).toBe('2026-04-02T11:00:00Z');
      expect(body.sessionLog[1].context).toContain('Second session context');
      expect(body.sessionLog[1].decisions).toEqual(['Decision B1.']);
    });

    it('returns sessionLog: null when session-log.md is absent', async () => {
      // notifications has no .dev/notifications/ dir at all → no session-log.md.
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/api-server/features/notifications',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sessionLog).toBeNull();
    });
  });
});

describe('GET /api/config', () => {
  it('creates and returns onboarding-ready defaults on first read', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Persisted config fields
    expect(body).toMatchObject({
      scanDirs: [],
      port: 3141,
      notifications: false,
      scanDirsConfigured: false,
      terminal: {},
    });
    // Wrapper fields
    expect(body.platform).toBe(process.platform);
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
    expect(typeof body.configPath).toBe('string');
    expect(body.configPath).toContain('dev-dashboard');
  });

  it('returns a non-destructive error for malformed config', async () => {
    const configPath = join(process.env.XDG_CONFIG_HOME!, 'dev-dashboard', 'config.json');
    await mkdir(join(process.env.XDG_CONFIG_HOME!, 'dev-dashboard'), { recursive: true });
    await writeFile(configPath, '{ invalid json', 'utf-8');

    const res = await app.inject({ method: 'GET', url: '/api/config' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: `Config file contains invalid JSON at ${configPath}`,
      code: 'invalid_json',
    });
    expect(await readFile(configPath, 'utf-8')).toBe('{ invalid json');
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
    const body = res.json();
    expect(body).toMatchObject({
      scanDirs: ['~/code', '~/work'],
      port: 3141,
      notifications: false,
      scanDirsConfigured: true,
      terminal: {},
    });
    // Wrapper fields ride on every POST response too.
    expect(body.platform).toBe(process.platform);
    expect(typeof body.version).toBe('string');

    const raw = await readFile(
      join(process.env.XDG_CONFIG_HOME!, 'dev-dashboard', 'config.json'),
      'utf-8',
    );
    expect(JSON.parse(raw)).toMatchObject({
      scanDirs: ['~/code', '~/work'],
      scanDirsConfigured: true,
    });
  });

  it('persists notifications: true and round-trips via GET', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/config',
      payload: { notifications: true },
    });
    expect(post.statusCode).toBe(200);
    expect(post.json().notifications).toBe(true);

    const get = await app.inject({ method: 'GET', url: '/api/config' });
    expect(get.json().notifications).toBe(true);
  });

  describe('terminal field', () => {
    it('persists a darwin preset id and round-trips via GET', async () => {
      const post = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { darwin: 'wezterm' } },
      });
      expect(post.statusCode).toBe(200);
      expect(post.json().terminal).toEqual({ darwin: 'wezterm' });

      const get = await app.inject({ method: 'GET', url: '/api/config' });
      expect(get.json().terminal).toEqual({ darwin: 'wezterm' });
    });

    it('merges a second platform without clobbering the first', async () => {
      // darwin already set by the previous test — adding linux must keep darwin.
      const post = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { linux: 'gnome-terminal' } },
      });
      expect(post.statusCode).toBe(200);
      expect(post.json().terminal).toEqual({
        darwin: 'wezterm',
        linux: 'gnome-terminal',
      });
    });

    it('persists a custom { cmd, args } object', async () => {
      const post = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: {
          terminal: {
            win32: { cmd: 'wezterm', args: ['start', '--cwd', '{{cwd}}'] },
          },
        },
      });
      expect(post.statusCode).toBe(200);
      expect(post.json().terminal.win32).toEqual({
        cmd: 'wezterm',
        args: ['start', '--cwd', '{{cwd}}'],
      });
    });

    it('drops invalid terminal shapes via the normalizer (silent-drop semantics)', async () => {
      const post = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: {
          terminal: {
            darwin: { cmd: 'wezterm' /* no args */ } as unknown,
            linux: 42, // wrong type
            win32: 'kitty', // valid, should pass through
          },
        },
      });
      expect(post.statusCode).toBe(200);
      const persisted = post.json().terminal;
      expect(persisted.darwin).toBeUndefined();
      expect(persisted.linux).toBeUndefined();
      expect(persisted.win32).toBe('kitty');
    });

    it('removes a platform when payload sets it to null', async () => {
      // First seed darwin + linux.
      await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { darwin: 'wezterm', linux: 'gnome-terminal' } },
      });
      // Null on darwin should remove it; linux should stay.
      const post = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { darwin: null } },
      });
      expect(post.statusCode).toBe(200);
      expect(post.json().terminal).toMatchObject({ linux: 'gnome-terminal' });
      expect(post.json().terminal.darwin).toBeUndefined();
    });
  });
});

describe('POST /api/projects/:project/features/:feature/open', () => {
  beforeAll(async () => {
    // Real checkpoint.md the access() guard can find.
    await mkdir(join(apiServerPath, '.dev/auth-system'), { recursive: true });
    await writeFile(
      join(apiServerPath, '.dev/auth-system/checkpoint.md'),
      '# fixture\n',
      'utf-8',
    );
  });

  it('returns 404 for unknown project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/unknown-project/features/auth-system/open',
      payload: { mode: 'open' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/Project/);
  });

  it('returns 404 for unknown feature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/api-server/features/nonexistent/open',
      payload: { mode: 'open' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/Feature/);
  });

  it('returns 400 for invalid mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/api-server/features/auth-system/open',
      payload: { mode: 'rm-rf' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Invalid mode/);
  });

  it('returns 400 when mode is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/api-server/features/auth-system/open',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when checkpoint.md is missing', async () => {
    // notifications is in state but its .dev/notifications/ dir was never created.
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/api-server/features/notifications/open',
      payload: { mode: 'open' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/checkpoint\.md not found/);
  });

  it('invokes execFile with the resolved path as a discrete array argument', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockClear();

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/api-server/features/auth-system/open',
      payload: { mode: 'open' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(mockExecFile).toHaveBeenCalledTimes(1);

    const [cmd, args, options] = mockExecFile.mock.calls[0];
    expect(typeof cmd).toBe('string');
    // Args MUST be an array — never a single shell string. This is the
    // injection-defense invariant we want regression-proofed.
    expect(Array.isArray(args)).toBe(true);
    const expectedPath = resolve(apiServerPath, '.dev/auth-system/checkpoint.md');
    expect(args as string[]).toContain(expectedPath);
    // Options must NEVER set { shell: true }.
    if (options && typeof options === 'object') {
      expect(options as Record<string, unknown>).not.toHaveProperty('shell', true);
    }
  });

  it('passes a different command-shape per mode', async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockClear();

    for (const mode of ['open', 'reveal', 'terminal'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/api-server/features/auth-system/open',
        payload: { mode },
      });
      expect(res.statusCode).toBe(200);
    }
    expect(mockExecFile).toHaveBeenCalledTimes(3);
  });

  describe('terminal mode (preset + fallback)', () => {
    const currentPlatform = process.platform as 'darwin' | 'linux' | 'win32';

    it('uses the user-configured preset when terminal config is set for current platform', async () => {
      // wezterm is in all three platforms' registries — works regardless of CI OS.
      await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { [currentPlatform]: 'wezterm' } },
      });

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/api-server/features/auth-system/open',
        payload: { mode: 'terminal' },
      });

      expect(res.statusCode).toBe(200);
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      const [cmd, args] = mockExecFile.mock.calls[0];
      expect(cmd).toBe('wezterm');
      expect(Array.isArray(args)).toBe(true);
      const featureDir = resolve(apiServerPath, '.dev/auth-system');
      expect(args as string[]).toEqual(['start', '--cwd', featureDir]);
    });

    it('substitutes {{cwd}} in custom args before invoking execFile', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: {
          terminal: {
            [currentPlatform]: { cmd: 'echo', args: ['featureDir={{cwd}}'] },
          },
        },
      });

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/api-server/features/auth-system/open',
        payload: { mode: 'terminal' },
      });

      expect(res.statusCode).toBe(200);
      const [cmd, args] = mockExecFile.mock.calls[0];
      expect(cmd).toBe('echo');
      const featureDir = resolve(apiServerPath, '.dev/auth-system');
      expect(args as string[]).toEqual([`featureDir=${featureDir}`]);
    });

    it('falls back to buildOpenCommand when no terminal preset is set for current platform', async () => {
      // Clear current platform's terminal setting.
      await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { [currentPlatform]: null } },
      });

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/api-server/features/auth-system/open',
        payload: { mode: 'terminal' },
      });

      expect(res.statusCode).toBe(200);
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      const [cmd, args, options] = mockExecFile.mock.calls[0];
      // Fallback shape is platform-specific; assert only the security
      // invariants that hold across platforms.
      expect(typeof cmd).toBe('string');
      expect(Array.isArray(args)).toBe(true);
      if (options && typeof options === 'object') {
        expect(options as Record<string, unknown>).not.toHaveProperty('shell', true);
      }
    });

    it('preserves the security invariant — args is always an array, never a shell string', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { terminal: { [currentPlatform]: 'wezterm' } },
      });

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/api-server/features/auth-system/open',
        payload: { mode: 'terminal' },
      });
      expect(res.statusCode).toBe(200);

      const [, args, options] = mockExecFile.mock.calls[0];
      expect(Array.isArray(args)).toBe(true);
      // No single arg should encode an entire command line — the args
      // array should be split on logical token boundaries.
      for (const arg of args as string[]) {
        // Arg may contain a space (e.g. literal path with space) but
        // should NOT match the "binary -flag" command-line shape.
        expect(arg).not.toMatch(/^[a-z]+\s+--?[a-z]/i);
      }
      if (options && typeof options === 'object') {
        expect(options as Record<string, unknown>).not.toHaveProperty('shell', true);
      }
    });

    it('returns the configured cwd from the spawn options for custom mode', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: {
          terminal: {
            [currentPlatform]: { cmd: 'echo', args: ['hi'] },
          },
        },
      });

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/api-server/features/auth-system/open',
        payload: { mode: 'terminal' },
      });
      expect(res.statusCode).toBe(200);

      const [, , options] = mockExecFile.mock.calls[0];
      const featureDir = resolve(apiServerPath, '.dev/auth-system');
      expect(options).toMatchObject({ cwd: featureDir });
    });
  });
});
