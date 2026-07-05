import { Box, Text } from 'ink';
import type { Feature } from 'dev-workflow-core/types';
import { getStatusTheme } from '../theme/status.js';
import { ProgressBar } from './ProgressBar.js';

// Stable width for the feature-list column. Fixed (not flex) so the pane never
// swings with the detail pane's content — the detail pane absorbs width changes.
// flexShrink lets it give way on cramped terminals down to minWidth.
export const FEATURE_LIST_WIDTH = 46;

interface Props {
  /** Header — the selected project's name. */
  title: string;
  features: Feature[];
  /** Index of the highlighted feature. */
  selectedIndex: number;
  /** Cyan border when this pane holds keyboard focus. */
  focused?: boolean;
}

/** Middle pane: the selected project's features — status badge + Unicode progress bar per row. */
export function FeatureList({ title, features, selectedIndex, focused = false }: Props) {
  return (
    <Box
      flexDirection="column"
      width={FEATURE_LIST_WIDTH}
      flexShrink={1}
      minWidth={28}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      overflowY="hidden"
    >
      <Text bold>{title}</Text>
      {features.length === 0 ? (
        <Text dimColor>No features.</Text>
      ) : (
        features.map((feature, i) => (
          <FeatureRow key={feature.name} feature={feature} selected={i === selectedIndex} />
        ))
      )}
    </Box>
  );
}

function FeatureRow({ feature, selected }: { feature: Feature; selected: boolean }) {
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
          thus every row's bar — lands on the same column regardless of digits. */}
      {feature.progress ? (
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
