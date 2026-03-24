import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { watchConfig, type ConfigWatcher } from '../src/server/config.js';

describe('watchConfig', () => {
  let tmpDir: string;
  let configPath: string;
  let watcher: ConfigWatcher | null;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'config-watcher-'));
    configPath = join(tmpDir, 'config.json');
    watcher = null;
  });

  afterEach(async () => {
    if (watcher) await watcher.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeConfig(scanDirs: string[]): Promise<void> {
    await writeFile(
      configPath,
      JSON.stringify({ scanDirs, port: 3141, notifications: false }, null, 2) + '\n',
      'utf-8'
    );
  }

  it('calls onScanDirsChanged when scanDirs change', async () => {
    await writeConfig(['/original']);

    const received: string[][] = [];
    watcher = watchConfig({}, ['/original'], (dirs) => received.push(dirs), configPath);

    await writeConfig(['/updated']);

    // Wait for chokidar + debounce
    await new Promise((r) => setTimeout(r, 1500));

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(['/updated']);
  });

  it('does not fire when scanDirs stay the same', async () => {
    await writeConfig(['/same']);

    const received: string[][] = [];
    watcher = watchConfig({}, ['/same'], (dirs) => received.push(dirs), configPath);

    // Write same dirs but change port
    await writeFile(
      configPath,
      JSON.stringify({ scanDirs: ['/same'], port: 9999 }, null, 2) + '\n',
      'utf-8'
    );

    await new Promise((r) => setTimeout(r, 1500));

    expect(received.length).toBe(0);
  });

  it('ignores file changes when CLI overrides scan dirs', async () => {
    await writeConfig(['/original']);

    const received: string[][] = [];
    watcher = watchConfig(
      { scan: ['/cli-override'] },
      ['/cli-override'],
      (dirs) => received.push(dirs),
      configPath
    );

    await writeConfig(['/new-dir']);

    await new Promise((r) => setTimeout(r, 1500));

    expect(received.length).toBe(0);
  });

  it('ignores invalid JSON', async () => {
    await writeConfig(['/original']);

    const received: string[][] = [];
    watcher = watchConfig({}, ['/original'], (dirs) => received.push(dirs), configPath);

    await writeFile(configPath, '{ invalid json }}}', 'utf-8');

    await new Promise((r) => setTimeout(r, 1500));

    expect(received.length).toBe(0);
  });

  it('fires on consecutive changes', async () => {
    await writeConfig(['/first']);

    const received: string[][] = [];
    watcher = watchConfig({}, ['/first'], (dirs) => received.push(dirs), configPath);

    await writeConfig(['/second']);
    await new Promise((r) => setTimeout(r, 1500));

    await writeConfig(['/third']);
    await new Promise((r) => setTimeout(r, 1500));

    expect(received.length).toBe(2);
    expect(received[0]).toEqual(['/second']);
    expect(received[1]).toEqual(['/third']);
  });
});
