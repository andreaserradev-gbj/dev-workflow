import { EventEmitter } from 'node:events';
import { render as inkRender } from 'ink';
import type { ReactNode } from 'react';

/**
 * Render a tree at an arbitrary terminal width.
 *
 * `ink-testing-library` hard-codes `columns = 100` and offers no options, so the
 * responsive layout's breakpoints are unreachable through it. This harness drives
 * ink's own `render()` with a fake stdout that reports any `columns`/`rows` (and
 * can change them mid-run via `setColumns`, which emits `resize`), plus a fake
 * stdin that satisfies ink's raw-mode requirements — a real `EventEmitter` with
 * `isTTY = true`, since ink throws "Raw mode is not supported on the stdin
 * provided to Ink" otherwise.
 */

class FakeStdout extends EventEmitter {
  columns: number;
  rows: number;
  isTTY = true;
  frames: string[] = [];
  private last?: string;

  constructor(columns: number, rows: number) {
    super();
    this.columns = columns;
    this.rows = rows;
  }

  write = (frame: string): void => {
    this.frames.push(frame);
    this.last = frame;
  };

  lastFrame = (): string | undefined => this.last;
}

class FakeStdin extends EventEmitter {
  isTTY = true;
  private buffer: string | null = null;

  write = (data: string): void => {
    this.buffer = data;
    this.emit('readable');
    this.emit('data', data);
  };

  read = (): string | null => {
    const data = this.buffer;
    this.buffer = null;
    return data;
  };

  setEncoding(): void {}
  setRawMode(): void {}
  resume(): void {}
  pause(): void {}
  ref(): void {}
  unref(): void {}
}

export interface RenderAtWidth {
  frames: string[];
  stdin: FakeStdin;
  /** Resize the fake terminal (emits `resize`, like a real TTY). */
  setColumns: (columns: number) => void;
  /** Most recent frame, or '' before the first render. */
  lastFrame: () => string;
  unmount: () => void;
}

/** Mount `tree` against a fake TTY of `columns` × `rows` (default 24). */
export function renderAtWidth(tree: ReactNode, columns: number, rows = 24): RenderAtWidth {
  const stdout = new FakeStdout(columns, rows);
  const stdin = new FakeStdin();

  const instance = inkRender(tree, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });

  return {
    frames: stdout.frames,
    stdin,
    setColumns: (next: number) => {
      stdout.columns = next;
      stdout.emit('resize');
    },
    lastFrame: () => stdout.lastFrame() ?? '',
    unmount: () => instance.unmount(),
  };
}
