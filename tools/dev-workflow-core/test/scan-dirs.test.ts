import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  expandHome,
  resolveScanDirs,
  readDashboardWikiDir,
  ensureScanDir,
  matchesProject,
} from '../src/scan-dirs.js';

// Each test runs against an isolated XDG_CONFIG_HOME so it never reads or
// writes the real ~/.config/dev-dashboard/config.json on the machine.
function captureWarn() {
  const warnLines: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => warnLines.push(args.map(String).join(' '));
  return {
    warnLines,
    restore() {
      console.warn = origWarn;
    },
  };
}

/** Point XDG at a fresh temp dir and write a dashboard config.json with `content`. */
function writeDashboardConfig(xdgDir: string, content: string): void {
  const cfgDir = join(xdgDir, 'dev-dashboard');
  mkdirSync(cfgDir, { recursive: true });
  writeFileSync(join(cfgDir, 'config.json'), content);
}

describe('scan-dirs', () => {
  let xdgDir: string;
  let origXdg: string | undefined;
  let origCwd: string;
  let warn: ReturnType<typeof captureWarn>;

  beforeEach(() => {
    origXdg = process.env.XDG_CONFIG_HOME;
    origCwd = process.cwd();
    xdgDir = mkdtempSync(join(tmpdir(), 'scan-dirs-xdg-'));
    process.env.XDG_CONFIG_HOME = xdgDir;
    warn = captureWarn();
  });

  afterEach(() => {
    warn.restore();
    process.chdir(origCwd);
    if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = origXdg;
    rmSync(xdgDir, { recursive: true, force: true });
  });

  describe('expandHome', () => {
    it('returns the home directory for a bare ~', () => {
      expect(expandHome('~')).toBe(homedir());
    });

    it('expands a leading ~/ to a path under home', () => {
      expect(expandHome('~/projects/foo')).toBe(resolve(homedir(), 'projects/foo'));
    });

    it('resolves a relative path against cwd', () => {
      expect(expandHome('./sub')).toBe(resolve(process.cwd(), 'sub'));
    });

    it('leaves an absolute path absolute', () => {
      expect(expandHome('/tmp/abs')).toBe(resolve('/tmp/abs'));
    });
  });

  describe('resolveScanDirs', () => {
    it('uses an explicit flag, expanding ~', async () => {
      await expect(resolveScanDirs('~/work')).resolves.toEqual([resolve(homedir(), 'work')]);
    });

    it('flag wins over the dashboard config', async () => {
      writeDashboardConfig(xdgDir, JSON.stringify({ scanDirs: ['/from/config'] }));
      await expect(resolveScanDirs('/explicit')).resolves.toEqual([resolve('/explicit')]);
    });

    it('falls back to the dashboard config scanDirs when no flag', async () => {
      const a = mkdtempSync(join(tmpdir(), 'scan-a-'));
      const b = mkdtempSync(join(tmpdir(), 'scan-b-'));
      try {
        writeDashboardConfig(xdgDir, JSON.stringify({ scanDirs: [a, b] }));
        await expect(resolveScanDirs(null)).resolves.toEqual([a, b]);
      } finally {
        rmSync(a, { recursive: true, force: true });
        rmSync(b, { recursive: true, force: true });
      }
    });

    it('de-dupes and skips non-string config entries', async () => {
      writeDashboardConfig(
        xdgDir,
        JSON.stringify({ scanDirs: ['/dup', '/dup', 42, '/other'] }),
      );
      await expect(resolveScanDirs(null)).resolves.toEqual([resolve('/dup'), resolve('/other')]);
    });

    it('falls back to cwd when no flag and no config', async () => {
      const here = mkdtempSync(join(tmpdir(), 'scan-cwd-'));
      try {
        process.chdir(here);
        // mkdtemp may resolve through a symlink (e.g. /var -> /private/var on macOS).
        await expect(resolveScanDirs(null)).resolves.toEqual([process.cwd()]);
      } finally {
        rmSync(here, { recursive: true, force: true });
      }
    });

    it('warns and falls back to cwd when the config is invalid JSON', async () => {
      writeDashboardConfig(xdgDir, '{not valid json');
      const here = mkdtempSync(join(tmpdir(), 'scan-bad-'));
      try {
        process.chdir(here);
        await expect(resolveScanDirs(null)).resolves.toEqual([process.cwd()]);
        expect(warn.warnLines.join('\n')).toContain('invalid JSON');
      } finally {
        rmSync(here, { recursive: true, force: true });
      }
    });
  });

  describe('readDashboardWikiDir', () => {
    it('returns the expanded wikiDir from the dashboard config', async () => {
      writeDashboardConfig(xdgDir, JSON.stringify({ wikiDir: '~/my-wiki' }));
      await expect(readDashboardWikiDir()).resolves.toBe(resolve(homedir(), 'my-wiki'));
    });

    it('returns null when there is no config file', async () => {
      await expect(readDashboardWikiDir()).resolves.toBeNull();
    });

    it('returns null when the config is invalid JSON (no warn — scan path owns that)', async () => {
      writeDashboardConfig(xdgDir, '{nope');
      await expect(readDashboardWikiDir()).resolves.toBeNull();
      expect(warn.warnLines).toEqual([]);
    });

    it('returns null when wikiDir is absent or not a string', async () => {
      writeDashboardConfig(xdgDir, JSON.stringify({ scanDirs: ['/x'], wikiDir: 123 }));
      await expect(readDashboardWikiDir()).resolves.toBeNull();
    });
  });

  describe('ensureScanDir', () => {
    const configPathOf = (xdg: string) => join(xdg, 'dev-dashboard', 'config.json');

    it('creates the config when none exists yet', async () => {
      const root = mkdtempSync(join(tmpdir(), 'ensure-new-'));
      try {
        await ensureScanDir(root);
        const parsed = JSON.parse(readFileSync(configPathOf(xdgDir), 'utf-8'));
        expect(parsed.scanDirs).toEqual([resolve(root)]);
        expect(parsed.scanDirsConfigured).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('appends while preserving other keys (wikiDir, port)', async () => {
      writeDashboardConfig(
        xdgDir,
        JSON.stringify({ scanDirs: ['/existing/root'], wikiDir: '~/my-wiki', port: 4317 }),
      );
      await ensureScanDir('/new/root');
      const parsed = JSON.parse(readFileSync(configPathOf(xdgDir), 'utf-8'));
      expect(parsed.scanDirs).toEqual(['/existing/root', resolve('/new/root')]);
      expect(parsed.wikiDir).toBe('~/my-wiki');
      expect(parsed.port).toBe(4317);
      expect(parsed.scanDirsConfigured).toBe(true);
    });

    it('is idempotent, treating ~ and absolute paths as the same root', async () => {
      writeDashboardConfig(xdgDir, JSON.stringify({ scanDirs: ['~/repos/app'] }));
      await ensureScanDir(join(homedir(), 'repos', 'app'));
      const parsed = JSON.parse(readFileSync(configPathOf(xdgDir), 'utf-8'));
      // The existing ~ entry is preserved verbatim; no duplicate appended.
      expect(parsed.scanDirs).toEqual(['~/repos/app']);
    });

    it('leaves an invalid-JSON config untouched and warns', async () => {
      writeDashboardConfig(xdgDir, '{not valid json');
      await ensureScanDir('/some/root');
      expect(readFileSync(configPathOf(xdgDir), 'utf-8')).toBe('{not valid json');
      expect(warn.warnLines.join('\n')).toContain('invalid JSON');
    });

    it('stores the expanded absolute path for a ~ root', async () => {
      await ensureScanDir('~/work/project');
      const parsed = JSON.parse(readFileSync(configPathOf(xdgDir), 'utf-8'));
      expect(parsed.scanDirs).toEqual([resolve(homedir(), 'work/project')]);
    });
  });

  describe('matchesProject', () => {
    it('matches on exact project name', () => {
      expect(matchesProject({ name: 'alpha', path: '/repos/alpha' }, 'alpha')).toBe(true);
    });

    it('matches on resolved path (including ~ expansion)', () => {
      const p = { name: 'alpha', path: resolve(homedir(), 'repos/alpha') };
      expect(matchesProject(p, '~/repos/alpha')).toBe(true);
    });

    it('returns false when neither name nor path match', () => {
      expect(matchesProject({ name: 'alpha', path: '/repos/alpha' }, 'beta')).toBe(false);
    });
  });
});
