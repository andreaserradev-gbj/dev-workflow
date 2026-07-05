import { Box, Text } from 'ink';
import { FILTER_KEYS, type FilterKey } from '../hooks/useStore.js';

// Pill labels. The status keys intentionally match getStatusTheme's labels, but
// pills are their own presentation surface (they also carry 'all'), so the small
// stable map lives here rather than reaching into the theme.
const LABELS: Record<FilterKey, string> = {
  all: 'All',
  active: 'Active',
  gate: 'Gate',
  stale: 'Stale',
  complete: 'Complete',
  archived: 'Archived',
};

interface Props {
  filter: FilterKey;
  counts: Record<FilterKey, number>;
}

/** Top bar: the six filter pills with counts; the active one is inverse. Number prefixes are the hotkeys. */
export function FilterPills({ filter, counts }: Props) {
  return (
    <Box>
      {FILTER_KEYS.map((key, i) => {
        const active = key === filter;
        return (
          <Box key={key} marginRight={1}>
            <Text inverse={active} color={active ? undefined : 'gray'}>
              {` ${i + 1}:${LABELS[key]} ${counts[key]} `}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
