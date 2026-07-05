import { Box, Text } from 'ink';
import type { Project } from 'dev-workflow-core/types';

interface Props {
  projects: Project[];
  /** Index of the highlighted project (rail nav lands in Phase 6). */
  selectedIndex: number;
  width?: number;
}

/** Left pane: recency-sorted project rail with per-project feature counts. */
export function ProjectRail({ projects, selectedIndex, width = 28 }: Props) {
  return (
    <Box
      flexDirection="column"
      width={width}
      flexShrink={0}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
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
      <Text color={selected ? 'cyan' : undefined}>{selected ? '› ' : '  '}</Text>
      <Box flexGrow={1} marginRight={1}>
        <Text bold={selected} wrap="truncate-end">
          {project.name}
        </Text>
      </Box>
      <Text dimColor>{project.features.length}</Text>
    </Box>
  );
}
