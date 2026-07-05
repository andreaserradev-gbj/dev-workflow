import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
}

// Sensible fallbacks when stdout isn't a TTY (e.g. under the test harness) or
// hasn't reported a size yet.
const FALLBACK: TerminalSize = { columns: 80, rows: 24 };

/**
 * Live terminal dimensions. Seeds from stdout's current size and re-reads on
 * every `resize` event so the fixed-height layout tracks the viewport. Guards
 * against a non-EventEmitter stdout (the ink-testing-library harness).
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const read = (): TerminalSize => ({
    columns: stdout?.columns || FALLBACK.columns,
    rows: stdout?.rows || FALLBACK.rows,
  });
  const [size, setSize] = useState<TerminalSize>(read);

  useEffect(() => {
    if (typeof stdout?.on !== 'function') return;
    const onResize = () => setSize(read);
    stdout.on('resize', onResize);
    return () => {
      stdout.off?.('resize', onResize);
    };
  }, [stdout]);

  return size;
}
