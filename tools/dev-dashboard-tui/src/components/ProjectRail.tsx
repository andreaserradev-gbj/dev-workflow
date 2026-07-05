import { Box, Text } from 'ink';
import type { Project } from 'dev-workflow-core/types';

interface Props {
  projects: Project[];
  /** Index of the highlighted project. */
  selectedIndex: number;
  width?: number;
  /** Cyan border when this pane holds keyboard focus. */
  focused?: boolean;
}

/** Left pane: recency-sorted project rail with per-project feature counts. */
export function ProjectRail({ projects, selectedIndex, width = 28, focused = false }: Props) {
  return (
    <Box
      flexDirection="column"
      width={width}
      flexShrink={0}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      overflowY="hidden"
    >
      <Text bold>Projects</Text>
      {projects.length === 0 ? (
        <Text dimColor>None.</Text>
      ) : (
        projects.map((project, i) => (
          <ProjectRow key={project.path} project={project} selected={i === selectedIndex} />
        ))
      )}
    </Box>
  );
}

function ProjectRow({ project, selected }: { project: Project; selected: boolean }) {
  return (
    <Box>
      {/* Fixed marker column (see FeatureRow) — keeps the '›' from losing its
          trailing space when a long project name shrinks the row. */}
      <Box width={2} flexShrink={0}>
        <Text color={selected ? 'cyan' : undefined}>{selected ? '›' : ''}</Text>
      </Box>
      <Box flexGrow={1} marginRight={1}>
        <Text bold={selected} wrap="truncate-end">
          {project.name}
        </Text>
      </Box>
      <Text dimColor>{project.features.length}</Text>
    </Box>
  );
}
