import { Box, Text } from 'ink';
import type { Feature } from 'dev-workflow-core/types';
import { getStatusTheme } from '../theme/status.js';
import { ProgressBar } from './ProgressBar.js';
import { LIST_WIDTH } from '../layout.js';

interface Props {
  /** Header — the selected project's name. */
  title: string;
  features: Feature[];
  /** Index of the highlighted feature. */
  selectedIndex: number;
  /** Outer pane width (border-box); the shell passes `layout.listWidth`. */
  width?: number;
  /** Drop the per-row progress bar and counts when the list is narrow. */
  compact?: boolean;
  /** Cyan border when this pane holds keyboard focus. */
  focused?: boolean;
}

/**
 * Middle pane: the selected project's features — status dot + Unicode progress
 * bar per row. The width comes from the shell (`layout.listWidth`), which also
 * decides when the list is narrow enough for `compact` rows or replaced by the
 * feature strip entirely.
 */
export function FeatureList({
  title,
  features,
  selectedIndex,
  width = LIST_WIDTH,
  compact = false,
  focused = false,
}: Props) {
  return (
    <Box
      flexDirection="column"
      width={width}
      flexShrink={0}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      overflowX="hidden"
      overflowY="hidden"
    >
      <Text bold>{title}</Text>
      {features.length === 0 ? (
        <Text dimColor>No features.</Text>
      ) : (
        features.map((feature, i) => (
          <FeatureRow
            key={feature.name}
            feature={feature}
            selected={i === selectedIndex}
            compact={compact}
          />
        ))
      )}
    </Box>
  );
}

function FeatureRow({
  feature,
  selected,
  compact = false,
}: {
  feature: Feature;
  selected: boolean;
  compact?: boolean;
}) {
  const theme = getStatusTheme(feature.status);
  return (
    <Box>
      {/* Fixed, non-shrinking marker column — a bare Text with a trailing space
          gets its space trimmed when Yoga shrinks the row under width pressure. */}
      <Box width={2} flexShrink={0}>
        <Text color={selected ? 'cyan' : undefined}>{selected ? '›' : ''}</Text>
      </Box>
      {/* Status as a 1-col colored dot rather than the full word: the hue already
          encodes the status (and the filter pill / rail give the context), so the
          former 10-col label is freed for the feature name — the row's key data.
          The status word still spells out in the detail pane. */}
      <Box width={2} flexShrink={0}>
        <Text color={theme.color}>●</Text>
      </Box>
      <Box flexGrow={1} marginRight={1}>
        <Text bold={selected} wrap="truncate-end">
          {feature.name}
        </Text>
      </Box>
      {/* Right-justify the counts in a fixed box so the bar's left edge — and
          thus every row's bar — lands on the same column regardless of digits.
          Compact rows (narrow lists) drop this whole box: the bar and counts
          together need 12 fixed columns, which starves the name. */}
      {compact ? null : feature.progress ? (
        <Box flexShrink={0}>
          <ProgressBar percent={feature.progress.percent} color={theme.color} width={6} />
          <Box width={6} justifyContent="flex-end">
            <Text dimColor>
              {feature.progress.done}/{feature.progress.total}
            </Text>
          </Box>
        </Box>
      ) : (
        <Box width={6} flexShrink={0} justifyContent="flex-end">
          <Text dimColor>—</Text>
        </Box>
      )}
    </Box>
  );
}
