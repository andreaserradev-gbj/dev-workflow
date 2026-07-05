import { Text } from 'ink';

interface Props {
  /** 0–100; clamped defensively. */
  percent: number;
  /** Ink color for the filled portion (usually the status theme color). */
  color: string;
  /** Total cell width of the bar. */
  width?: number;
}

const FILLED = '█';
const EMPTY = '░';

/** Unicode progress bar — the terminal analog of the web dashboard's rounded bar. */
export function ProgressBar({ percent, color, width = 10 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return (
    <Text>
      <Text color={color}>{FILLED.repeat(filled)}</Text>
      <Text dimColor>{EMPTY.repeat(empty)}</Text>
    </Text>
  );
}
