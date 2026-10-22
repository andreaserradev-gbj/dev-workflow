import { Box, Text } from 'ink';
import type { Feature } from 'dev-workflow-core/types';
import { getStatusTheme } from '../theme/status.js';

interface Props {
  features: Feature[];
  /** Index of the highlighted feature — the strip's centre. */
  selectedIndex: number;
  /** Outer width (border-box); the shell passes `layout.detailWidth`. */
  width: number;
}

/**
 * One-line feature selector shown *instead of* the feature list below 76
 * columns, so the feature stays navigable when the list pane is dropped. Layout:
 * the selected feature sits between its neighbours, which stay dimmed —
 * `‹ previous › selected` — so the position in the list is visible at a glance.
 *
 * It renders from the same `features` / `selectedIndex` the list uses; the
 * selection itself lives in the store, so the strip is not a second source of
 * truth. j/k keep moving it because the list stays the focused pane.
 */
export function FeatureStrip({ features, selectedIndex, width }: Props) {
  const previous = selectedIndex > 0 ? features[selectedIndex - 1] : null;
  const selected = features[selectedIndex] ?? null;
  const next = selectedIndex < features.length - 1 ? features[selectedIndex + 1] : null;
  const theme = selected ? getStatusTheme(selected.status) : null;

  return (
    <Box width={width} flexShrink={0} overflowX="hidden" paddingX={1}>
      {features.length === 0 || !selected || !theme ? (
        <Text dimColor wrap="truncate-end">
          No features match this filter.
        </Text>
      ) : (
        <Text wrap="truncate-end">
          {previous ? <Text dimColor>{`‹ ${previous.name} `}</Text> : null}
          <Text bold color={theme.color}>
            {`› ${selected.name}`}
          </Text>
          {next ? <Text dimColor>{` ${next.name} ›`}</Text> : null}
        </Text>
      )}
    </Box>
  );
}
