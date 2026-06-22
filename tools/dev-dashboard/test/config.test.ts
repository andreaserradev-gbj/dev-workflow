import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { DEFAULT_CONFIG, loadConfig, parseCliArgs } from '../src/server/config.js';

describe('host / bind configuration', () => {
  let tmpDir: string;
  let configPath: string;
  const savedEnv = process.env.DEV_DASHBOARD_HOST;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'config-host-'));
    configPath = join(tmpDir, 'config.json');
    delete process.env.DEV_DASHBOARD_HOST;
  });

  afterEach(async () => {
    if (savedEnv === undefined) delete process.env.DEV_DASHBOARD_HOST;
    else process.env.DEV_DASHBOARD_HOST = savedEnv;
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeStoredHost(host: string): Promise<void> {
    await writeFile(configPath, JSON.stringify({ scanDirs: [], port: 3141, host }) + '\n', 'utf-8');
  }

  it('defaults to loopback (127.0.0.1)', () => {
    expect(DEFAULT_CONFIG.host).toBe('127.0.0.1');
  });

  it('loadConfig defaults to loopback when nothing is configured', async () => {
    const config = await loadConfig({}, configPath);
    expect(config.host).toBe('127.0.0.1');
  });

  it('--lan opts into binding all interfaces', () => {
    expect(parseCliArgs(['--lan']).host).toBe('0.0.0.0');
  });

  it('--host sets an explicit bind address', () => {
    expect(parseCliArgs(['--host', '0.0.0.0']).host).toBe('0.0.0.0');
    expect(parseCliArgs(['--host', '192.168.1.10']).host).toBe('192.168.1.10');
  });

  it('--lan opt-in flows through loadConfig to 0.0.0.0', async () => {
    const config = await loadConfig({ host: '0.0.0.0' }, configPath);
    expect(config.host).toBe('0.0.0.0');
  });

  it('honors a stored host from config.json', async () => {
    await writeStoredHost('0.0.0.0');
    const config = await loadConfig({}, configPath);
    expect(config.host).toBe('0.0.0.0');
  });

  it('DEV_DASHBOARD_HOST env opts in, overriding stored default', async () => {
    process.env.DEV_DASHBOARD_HOST = '0.0.0.0';
    const config = await loadConfig({}, configPath);
    expect(config.host).toBe('0.0.0.0');
  });

  it('CLI host takes precedence over env and stored', async () => {
    await writeStoredHost('10.0.0.9');
    process.env.DEV_DASHBOARD_HOST = '0.0.0.0';
    const config = await loadConfig({ host: '192.168.0.5' }, configPath);
    expect(config.host).toBe('192.168.0.5');
  });

  it('ignores a blank env value and falls back to the stored/default host', async () => {
    process.env.DEV_DASHBOARD_HOST = '   ';
    const config = await loadConfig({}, configPath);
    expect(config.host).toBe('127.0.0.1');
  });
});
