import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from 'dev-workflow-core/types';
import type { WatcherCallbacks } from 'dev-workflow-core/live';

// Mock the scan + watcher so the store's live-refresh wiring is exercised with
// no fs and a controllable watcher. sortProjects is identity here — ordering is
// covered by store.test.ts and out of scope. Real timers + vi.waitFor drive the
// assertions: React 19's scheduler flushes passive effects via MessageChannel,
// which fake timers can't pump, so waitFor (real event loop) is what settles the
// rescans deterministically.
vi.mock('dev-workflow-core', () => ({ scanProjects: vi.fn() }));
vi.mock('dev-workflow-core/live', () => ({
  sortProjects: (projects: Project[]) => projects,
  createWatcher: vi.fn(),
}));

import { scanProjects } from 'dev-workflow-core';
import { createWatcher } from 'dev-workflow-core/live';
import { useStore } from '../src/hooks/useStore.js';

const mockScan = vi.mocked(scanProjects);
const mockCreateWatcher = vi.mocked(createWatcher);

const FULL_RESCAN_INTERVAL_MS = 5 * 60 * 1000;

function project(name: string): Project {
  return { name, path: `/repos/${name}`, features: [] };
}

// Renders the store so its effects (scan + watcher) run; the text is unused.
function Harness({ scanDirs }: { scanDirs: string[] }) {
  const store = useStore(scanDirs);
  return <Text>{`${store.phase}:${store.projects.length}:${store.revision}`}</Text>;
}

let capturedCallbacks: WatcherCallbacks | null;
const closeSpy = vi.fn(() => Promise.resolve());

describe('useStore live refresh', () => {
  beforeEach(() => {
    capturedCallbacks = null;
    closeSpy.mockClear();
    mockScan.mockReset();
    mockScan.mockResolvedValue([project('alpha')]);
    mockCreateWatcher.mockReset();
    mockCreateWatcher.mockImplementation((_dirs, callbacks) => {
      capturedCallbacks = callbacks;
      return Promise.resolve({ close: closeSpy });
    });
  });

  it('scans once and starts a single watcher on mount', async () => {
    const { unmount } = render(<Harness scanDirs={['/x']} />);
    await vi.waitFor(() => {
      expect(mockScan).toHaveBeenCalledTimes(1);
      expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      expect(capturedCallbacks).not.toBeNull();
    });
    unmount();
  });

  it('rescans on each watcher event (added / updated / removed)', async () => {
    const { unmount } = render(<Harness scanDirs={['/x']} />);
    await vi.waitFor(() => expect(capturedCallbacks).not.toBeNull());
    await vi.waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));

    capturedCallbacks!.onFeatureUpdated('/x/proj', 'feat', false);
    await vi.waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));

    capturedCallbacks!.onFeatureAdded('/x/proj', 'feat2', false);
    await vi.waitFor(() => expect(mockScan).toHaveBeenCalledTimes(3));

    capturedCallbacks!.onFeatureRemoved('/x/proj', 'feat');
    await vi.waitFor(() => expect(mockScan).toHaveBeenCalledTimes(4));
    unmount();
  });

  it('registers the periodic safety-net rescan and it triggers a full rescan', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { unmount } = render(<Harness scanDirs={['/x']} />);
    await vi.waitFor(() => expect(mockScan).toHaveBeenCalledTimes(1));

    // The store registers exactly one interval at the safety-net cadence (ink's
    // own internals use other delays, so the 5-min delay is a clean fingerprint).
    const periodic = setIntervalSpy.mock.calls.find((c) => c[1] === FULL_RESCAN_INTERVAL_MS);
    expect(periodic).toBeDefined();

    // Firing that registered callback must drive a full rescan (same bump path
    // the watcher events use), without waiting the real five minutes.
    (periodic![0] as () => void)();
    await vi.waitFor(() => expect(mockScan).toHaveBeenCalledTimes(2));

    setIntervalSpy.mockRestore();
    unmount();
  });

  it('closes the watcher on unmount (no leaked fs handles)', async () => {
    const { unmount } = render(<Harness scanDirs={['/x']} />);
    await vi.waitFor(() => expect(mockCreateWatcher).toHaveBeenCalledTimes(1));

    unmount();
    await vi.waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));
  });
});
