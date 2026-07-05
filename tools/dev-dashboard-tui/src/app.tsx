import { Box, Text, useApp, useInput } from 'ink';
import { FILTER_KEYS, filterCounts, useStore } from './hooks/useStore.js';
import { FilterPills } from './components/FilterPills.js';
import { ProjectRail } from './components/ProjectRail.js';
import { FeatureList } from './components/FeatureList.js';

interface Props {
  scanDirs: string[];
}

/**
 * Portfolio root (master-plan Phase 3). Scans `.dev/` via the store and renders
 * the read-only portfolio: filter pills on top, recency-sorted project rail on
 * the left, the selected project's feature list on the right.
 *
 * Interaction here is deliberately minimal — filter hotkeys (so the pills are
 * verifiable) plus up/down rail browsing (so the list reflects selection). The
 * full focus model (rail ↔ list ↔ detail, Tab, j/k, feature selection) and the
 * detail pane land in Phases 4–6. `q` / Ctrl+C keep the proven clean-exit path.
 */
export function App({ scanDirs }: Props) {
  const { exit } = useApp();
  const store = useStore(scanDirs);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    // Filter hotkeys 1–6 → the six pills. Reset the rail cursor so the list
    // always lands on a valid project after the filtered set changes.
    const n = Number.parseInt(input, 10);
    if (Number.isInteger(n) && n >= 1 && n <= FILTER_KEYS.length) {
      store.setFilter(FILTER_KEYS[n - 1]);
      store.setSelectedProjectIndex(0);
      return;
    }

    // Minimal rail browsing (full navigation model is Phase 6).
    if (key.downArrow || input === 'j') {
      store.setSelectedProjectIndex(
        Math.min(store.selectedProjectIndex + 1, store.filteredProjects.length - 1),
      );
    } else if (key.upArrow || input === 'k') {
      store.setSelectedProjectIndex(Math.max(store.selectedProjectIndex - 1, 0));
    }
  });

  if (store.phase === 'loading') {
    return <Text>Scanning {scanDirs.join(', ')} …</Text>;
  }

  if (store.phase === 'error') {
    return <Text color="red">Scan failed: {store.error}</Text>;
  }

  const counts = filterCounts(store.projects);

  return (
    <Box flexDirection="column">
      <FilterPills filter={store.filter} counts={counts} />
      <Box>
        <ProjectRail
          projects={store.filteredProjects}
          selectedIndex={store.selectedProjectIndex}
        />
        {store.selectedProject ? (
          <FeatureList
            title={store.selectedProject.name}
            features={store.selectedProject.features}
            selectedIndex={store.selectedFeatureIndex}
          />
        ) : (
          <Box flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
            <Text dimColor>No features match this filter.</Text>
          </Box>
        )}
      </Box>
      <Box>
        <Text dimColor>↑/↓ project · 1–6 filter · q quit</Text>
      </Box>
    </Box>
  );
}
