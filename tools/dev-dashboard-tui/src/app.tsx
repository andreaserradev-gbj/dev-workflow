import { useState } from 'react';
import { Box, Text } from 'ink';
import { filterCounts, useStore } from './hooks/useStore.js';
import { useFeatureDetail } from './hooks/useFeatureDetail.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { FilterPills } from './components/FilterPills.js';
import { ProjectRail } from './components/ProjectRail.js';
import { FeatureList } from './components/FeatureList.js';
import { FeatureStrip } from './components/FeatureStrip.js';
import { DetailPane } from './components/DetailPane.js';
import { resolveLayout } from './layout.js';

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
  const featureDetail = useFeatureDetail(
    store.selectedProject,
    store.selectedFeature,
    store.revision,
  );
  // The detail pane measures its own scroll range and reports it back so the nav
  // hook can bound j/k; seeded at 0 (no scroll until content overflows).
  const [detailScrollMax, setDetailScrollMax] = useState(0);
  // `columns` drives the whole horizontal layout: the resolver owns every pane
  // width, so the panes never rely on Yoga shrinking them.
  const { rows, columns } = useTerminalSize();
  const layout = resolveLayout(columns);
  const nav = useNavigation(store, detailScrollMax, layout.showRail);

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
          up space — otherwise tall pane content shrinks these bars to nothing.
          Both clip horizontally: on a narrow terminal the pill row (74+ columns)
          and the help bar (66) would otherwise spill past the edge. */}
      <Box flexShrink={0} overflowX="hidden">
        <FilterPills filter={store.filter} counts={counts} />
      </Box>
      {/* Below 76 columns the list pane is gone, so the feature strip carries the
          selection instead. Arrangement: a full-width row directly above the
          content row rather than a column beside the detail — the strip would
          otherwise need its own `detailWidth` column, and 2 × 60 columns cannot
          fit in a terminal that is narrower than 76. The strip keeps the
          detail's width so the selector and the pane below it share a left edge. */}
      {layout.showFeatureStrip ? (
        store.selectedProject ? (
          <FeatureStrip
            features={store.selectedProject.features}
            selectedIndex={store.selectedFeatureIndex}
            width={layout.detailWidth}
          />
        ) : null
      ) : null}
      {/* Content row grows to fill the height between the bars and the help
          bar; minHeight={0} lets it (and its panes) clip rather than overflow.
          overflowX clips a row wider than the terminal instead of spilling. */}
      <Box flexGrow={1} minHeight={0} overflowX="hidden">
        {layout.showRail ? (
          <ProjectRail
            projects={store.filteredProjects}
            selectedIndex={store.selectedProjectIndex}
            width={layout.railWidth}
            focused={nav.focus === 'rail'}
          />
        ) : null}
        {layout.showList ? (
          store.selectedProject ? (
            <FeatureList
              title={store.selectedProject.name}
              features={store.selectedProject.features}
              selectedIndex={store.selectedFeatureIndex}
              width={layout.listWidth}
              compact={layout.listCompact}
              focused={nav.focus === 'list'}
            />
          ) : (
            <Box
              width={layout.listWidth}
              flexShrink={0}
              borderStyle="round"
              borderColor="gray"
              paddingX={1}
              overflowY="hidden"
            >
              <Text dimColor>No features match this filter.</Text>
            </Box>
          )
        ) : null}
        <DetailPane
          detail={featureDetail.detail}
          loading={featureDetail.loading}
          error={featureDetail.error}
          focused={nav.focus === 'detail'}
          sessionExpanded={nav.sessionExpanded}
          scroll={nav.detailScroll}
          onScrollMax={setDetailScrollMax}
          width={layout.detailWidth}
        />
      </Box>
      {/* The help bar truncates rather than wrapping: a second row would break
          the pinned height={rows} frame. Narrow terminals get a short variant
          instead of a clipped wide one, so the keys stay readable. */}
      <Box flexShrink={0} overflowX="hidden">
        <Text dimColor wrap="truncate-end">
          {layout.compactBars
            ? 'j/k move · h/l pane · 1-6 filter · q quit'
            : 'jk/↑↓ move · hl/←→ pane · Tab/1–6 filter · Space sessions · q quit'}
        </Text>
      </Box>
    </Box>
  );
}
