import { Text, useApp, useInput } from 'ink';

/**
 * Walking-skeleton root component (master-plan Phase 2).
 *
 * Deliberately trivial: its only job is to prove the Ink + yoga-layout WASM
 * runtime bundles to the packaged CJS artifact and renders in a real terminal.
 * The real portfolio/detail UI arrives in Phases 3–5. `q` (and Ink's default
 * Ctrl+C) exercise the graceful unmount path we rely on later for watcher
 * teardown.
 */
export function App() {
  const { exit } = useApp();

  useInput((input) => {
    if (input === 'q') exit();
  });

  return <Text>Hello from dev-dashboard-tui (press q to quit)</Text>;
}
