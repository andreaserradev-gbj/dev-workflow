import { Box, Text } from 'ink';
import type { Feature } from 'dev-workflow-core/types';
import { getStatusTheme } from '../theme/status.js';
import { ProgressBar } from './ProgressBar.js';

interface Props {
  /** Header — the selected project's name. */
  title: string;
  features: Feature[];
  /** Index of the highlighted feature (feature-level nav lands in Phase 6). */
  selectedIndex: number;
}

/** Right pane: the selected project's features — status badge + Unicode progress bar per row. */
export function FeatureList({ title, features, selectedIndex }: Props) {
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
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
      <Text color={selected ? 'cyan' : undefined}>{selected ? '› ' : '  '}</Text>
      <Box width={10} flexShrink={0}>
        <Text color={theme.color}>{theme.label}</Text>
      </Box>
      <Box flexGrow={1} marginRight={1}>
        <Text bold={selected} wrap="truncate-end">
          {feature.name}
        </Text>
      </Box>
      {feature.progress ? (
        <Box flexShrink={0}>
          <ProgressBar percent={feature.progress.percent} color={theme.color} width={10} />
          <Text dimColor>
            {' '}
            {feature.progress.done}/{feature.progress.total}
          </Text>
        </Box>
      ) : (
        <Text dimColor>—</Text>
      )}
    </Box>
  );
}
