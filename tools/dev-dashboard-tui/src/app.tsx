import { Box, Text } from 'ink';
import { filterCounts, useStore } from './hooks/useStore.js';
import { useFeatureDetail } from './hooks/useFeatureDetail.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { FilterPills } from './components/FilterPills.js';
import { ProjectRail } from './components/ProjectRail.js';
import { FeatureList, FEATURE_LIST_WIDTH } from './components/FeatureList.js';
import { DetailPane } from './components/DetailPane.js';

interface Props {
  scanDirs: string[];
}

/**
 * Portfolio root. Scans `.dev/` via the store and renders the read-only
 * portfolio: filter pills on top, then a three-pane row — recency-sorted project
 * rail, the selected project's feature list, and the selected feature's detail.
 *
 * The root is pinned to the terminal height so the frame fills the viewport and
 * stays put (lazygit-style) instead of growing/shrinking with the detail
 * content; each pane clips its own overflow (`overflowY: hidden`).
 *
 * Keyboard model (useNavigation): h/l/←/→ move focus across the panes; j/k/↑/↓
 * move the selection within the focused pane; Tab (and 1–6) switch the filter;
 * Space toggles the session history; q / Ctrl+C exit. The focused pane gets a
 * cyan border.
 */
export function App({ scanDirs }: Props) {
  const store = useStore(scanDirs);
  const featureDetail = useFeatureDetail(store.selectedProject, store.selectedFeature);
  const nav = useNavigation(store, featureDetail);
  const { rows } = useTerminalSize();

  if (store.phase === 'loading') {
    return (
      <Box height={rows}>
        <Text>Scanning {scanDirs.join(', ')} …</Text>
      </Box>
    );
  }

  if (store.phase === 'error') {
    return (
      <Box height={rows}>
        <Text color="red">Scan failed: {store.error}</Text>
      </Box>
    );
  }

  const counts = filterCounts(store.projects);

  return (
    <Box flexDirection="column" height={rows}>
      {/* Pills + help are pinned (flexShrink={0}) so only the content row gives
          up space — otherwise tall pane content shrinks these bars to nothing. */}
      <Box flexShrink={0}>
        <FilterPills filter={store.filter} counts={counts} />
      </Box>
      {/* Content row grows to fill the height between the pills and the help
          bar; minHeight={0} lets it (and its panes) clip rather than overflow. */}
      <Box flexGrow={1} minHeight={0}>
        <ProjectRail
          projects={store.filteredProjects}
          selectedIndex={store.selectedProjectIndex}
          focused={nav.focus === 'rail'}
        />
        {store.selectedProject ? (
          <FeatureList
            title={store.selectedProject.name}
            features={store.selectedProject.features}
            selectedIndex={store.selectedFeatureIndex}
            focused={nav.focus === 'list'}
          />
        ) : (
          <Box
            width={FEATURE_LIST_WIDTH}
            flexShrink={1}
            minWidth={28}
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            overflowY="hidden"
          >
            <Text dimColor>No features match this filter.</Text>
          </Box>
        )}
        <DetailPane
          detail={featureDetail.detail}
          loading={featureDetail.loading}
          error={featureDetail.error}
          focused={nav.focus === 'detail'}
          sessionExpanded={nav.sessionExpanded}
          sessionScroll={nav.sessionScroll}
        />
      </Box>
      <Box flexShrink={0}>
        <Text dimColor>jk/↑↓ move · hl/←→ pane · Tab/1–6 filter · Space sessions · q quit</Text>
      </Box>
    </Box>
  );
}
