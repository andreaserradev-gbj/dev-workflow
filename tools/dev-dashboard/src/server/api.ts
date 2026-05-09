import { access, mkdir, readdir, rename } from 'fs/promises';
import { dirname, resolve } from 'path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type {
  DashboardConfig,
  FeatureDetail,
  Project,
  ReportFeature,
  ReportResponse,
} from '../shared/types.js';
import type { DashboardState } from './state.js';
import { ConfigReadError, readStoredConfig, updateConfig } from './config.js';
import { parseCheckpoint, parseMasterPlan, parseSessionLog, parseSubPrd } from './parser.js';

const execFile = promisify(execFileCb);

type OpenMode = 'open' | 'reveal' | 'terminal';
const VALID_OPEN_MODES: readonly OpenMode[] = ['open', 'reveal', 'terminal'] as const;

interface PlatformOpenCommand {
  cmd: string;
  args: string[];
  cwd?: string;
}

// Per-platform launchers for the three open-externally modes.
// Always invoked via execFile with a discrete arg array — never `exec`,
// never `{ shell: true }` — so paths can never be reinterpreted by a shell.
function buildOpenCommand(
  platform: NodeJS.Platform,
  mode: OpenMode,
  filePath: string,
): PlatformOpenCommand | null {
  const dir = dirname(filePath);
  if (platform === 'darwin') {
    if (mode === 'open') return { cmd: 'open', args: [filePath] };
    if (mode === 'reveal') return { cmd: 'open', args: ['-R', filePath] };
    if (mode === 'terminal') return { cmd: 'open', args: ['-a', 'Terminal', dir] };
  }
  if (platform === 'linux') {
    if (mode === 'open') return { cmd: 'xdg-open', args: [filePath] };
    // xdg-open on a directory opens the file manager at that dir but cannot
    // pre-select the file — documented parity gap with macOS/Windows.
    if (mode === 'reveal') return { cmd: 'xdg-open', args: [dir] };
    // Best-effort: x-terminal-emulator inherits cwd from the spawn options
    // so the new terminal lands in the feature dir. Not all distros ship
    // x-terminal-emulator; failure surfaces as a 500 with the ENOENT message.
    if (mode === 'terminal') return { cmd: 'x-terminal-emulator', args: [], cwd: dir };
  }
  if (platform === 'win32') {
    if (mode === 'open') return { cmd: 'explorer.exe', args: [filePath] };
    if (mode === 'reveal') return { cmd: 'explorer.exe', args: [`/select,${filePath}`] };
    // Best-effort: wt.exe (Windows Terminal) is not preinstalled on every
    // SKU. Without `{ shell: true }` we can't fall through to cmd.exe tricks.
    if (mode === 'terminal') return { cmd: 'wt.exe', args: ['-d', dir] };
  }
  return null;
}

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
    // parseSessionLog returns [] for missing or empty files (fault-tolerant);
    // collapse that to null so the client can render "no history" cleanly.
    const sessionLog = await parseSessionLog(resolve(featureDir, 'session-log.md'));

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
      sessionLog: sessionLog.length > 0 ? sessionLog : null,
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

  app.get('/api/config', async (_request, reply: FastifyReply) => {
    try {
      return await readStoredConfig();
    } catch (error) {
      if (error instanceof ConfigReadError) {
        return reply.status(500).send({
          error: error.message,
          code: error.code,
        });
      }

      throw error;
    }
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

  // ─── Open Externally ─────────────────────────────────────────
  // Opens checkpoint.md in the OS default app, file manager (with the file
  // selected where supported), or a terminal at the feature directory.
  // The client never sends a file path — only a mode. The server resolves
  // the absolute path from authenticated state and invokes a per-platform
  // launcher via execFile with a discrete arg array.

  app.post<{
    Params: { project: string; feature: string };
    Body: { mode?: string };
  }>('/api/projects/:project/features/:feature/open', async (request, reply) => {
    const { project: projectName, feature: featureName } = request.params;
    const mode = request.body?.mode;

    if (!mode || !VALID_OPEN_MODES.includes(mode as OpenMode)) {
      return reply
        .status(400)
        .send({ error: `Invalid mode "${mode ?? ''}". Expected: ${VALID_OPEN_MODES.join(', ')}` });
    }

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
    const checkpointPath = resolve(project.path, devSubdir, featureName, 'checkpoint.md');

    try {
      await access(checkpointPath);
    } catch {
      return reply.status(404).send({ error: `checkpoint.md not found for "${featureName}"` });
    }

    const command = buildOpenCommand(process.platform, mode as OpenMode, checkpointPath);
    if (!command) {
      return reply
        .status(501)
        .send({ error: `Mode "${mode}" not supported on platform "${process.platform}"` });
    }

    try {
      await execFile(command.cmd, command.args, command.cwd ? { cwd: command.cwd } : {});
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open';
      return reply.status(500).send({ error: message });
    }
  });
}

function isInRange(dateStr: string | null, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= from && d <= to;
}
