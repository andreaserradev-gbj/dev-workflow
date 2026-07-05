import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import type { FeatureDetail, SessionLogEntry } from 'dev-workflow-core/types';
import { getStatusTheme } from '../theme/status.js';
import { getPhaseIcon } from '../theme/phaseIcons.js';

interface Props {
  detail: FeatureDetail | null;
  loading: boolean;
  error: string | null;
  /** Highlights the pane border when it holds keyboard focus (wired in Phase 4 nav). */
  focused?: boolean;
  /** Session History expanded to entries vs. collapsed to just its count. */
  sessionExpanded?: boolean;
  /** Scroll offset into the newest-first session list when expanded. */
  sessionScroll?: number;
}

// How many session rows the scroll window shows at once; the rest page in via
// sessionScroll (driven by keyboard nav). Exported so the nav hook clamps the
// scroll offset to the same window.
export const MAX_VISIBLE_SESSIONS = 4;

/**
 * Right pane: the selected feature's expanded detail — status/phase/progress
 * header, next action, decisions, blockers, phases (with icons), sub-PRDs, and a
 * collapsible, scrollable session history. The terminal analog of the web
 * dashboard's FeaturePanel (read-only; the open/archive actions are out of MVP).
 */
export function DetailPane({
  detail,
  loading,
  error,
  focused = false,
  sessionExpanded = false,
  sessionScroll = 0,
}: Props) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      flexBasis={0}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      overflowY="hidden"
    >
      {loading ? (
        <Text dimColor>Loading…</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : !detail ? (
        <Text dimColor>Select a feature to see its detail.</Text>
      ) : (
        <DetailBody
          detail={detail}
          sessionExpanded={sessionExpanded}
          sessionScroll={sessionScroll}
        />
      )}
    </Box>
  );
}

function DetailBody({
  detail,
  sessionExpanded,
  sessionScroll,
}: {
  detail: FeatureDetail;
  sessionExpanded: boolean;
  sessionScroll: number;
}) {
  const theme = getStatusTheme(detail.status);
  const totalPhases = detail.phases.length;
  const currentPhaseNum = detail.currentPhase?.number ?? null;
  const checkpoint = detail.checkpoint;

  return (
    <>
      <Text bold color={theme.color} wrap="truncate-end">
        {detail.name}
      </Text>
      <Box marginBottom={1}>
        <Text dimColor wrap="truncate-end">
          {theme.label}
          {currentPhaseNum !== null && totalPhases > 0
            ? ` · Phase ${currentPhaseNum}/${totalPhases}`
            : ''}
          {detail.progress ? ` · ${detail.progress.done}/${detail.progress.total}` : ''}
          {detail.branch ? ` · ${detail.branch}` : ''}
        </Text>
      </Box>

      {checkpoint?.nextAction ? (
        <Section title="Next Action" color="cyan">
          <Text>{stripLeadingHeading(checkpoint.nextAction)}</Text>
        </Section>
      ) : null}

      {checkpoint && checkpoint.decisions.length > 0 ? (
        <Section title="Decisions">
          <BulletList items={checkpoint.decisions} />
        </Section>
      ) : null}

      {checkpoint && checkpoint.blockers.length > 0 ? (
        <Section title="Blockers" color="yellow">
          <BulletList items={checkpoint.blockers} color="yellow" />
        </Section>
      ) : null}

      {detail.phases.length > 0 ? (
        <Section title="Phases">
          {detail.phases.map((phase) => (
            <Box key={phase.number}>
              <Text>{getPhaseIcon(phase.status)} </Text>
              <Box width={2} flexShrink={0}>
                <Text dimColor>{phase.number}</Text>
              </Box>
              <Box flexGrow={1} marginRight={1}>
                <Text wrap="truncate-end">{phase.title}</Text>
              </Box>
              {phase.total > 0 ? (
                <Text dimColor>
                  {phase.done}/{phase.total}
                </Text>
              ) : null}
            </Box>
          ))}
        </Section>
      ) : null}

      {detail.subPrds.length > 0 ? (
        <Section title="Sub-PRDs">
          {detail.subPrds.map((sub) => (
            <Box key={sub.id}>
              <Text>{getPhaseIcon(sub.status)} </Text>
              <Box flexGrow={1} marginRight={1}>
                <Text wrap="truncate-end">{sub.title}</Text>
              </Box>
              {sub.total > 0 ? (
                <Text dimColor>
                  {sub.done}/{sub.total}
                </Text>
              ) : null}
            </Box>
          ))}
        </Section>
      ) : null}

      {detail.sessionLog && detail.sessionLog.length > 0 ? (
        <SessionHistory log={detail.sessionLog} expanded={sessionExpanded} scroll={sessionScroll} />
      ) : null}
    </>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color ?? 'gray'}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <>
      {items.map((item, i) => (
        <Box key={i}>
          <Text color={color} dimColor={!color}>
            {'• '}
          </Text>
          <Box flexGrow={1}>
            <Text color={color} wrap="truncate-end">
              {item}
            </Text>
          </Box>
        </Box>
      ))}
    </>
  );
}

function SessionHistory({
  log,
  expanded,
  scroll,
}: {
  log: SessionLogEntry[];
  expanded: boolean;
  scroll: number;
}) {
  // parseSessionLog returns file order (Session 1 = oldest); show newest first.
  const newestFirst = [...log].reverse();
  const header = (
    <Text bold color="blue">
      {`Session History (${log.length})${expanded ? '' : '  ▶'}`}
    </Text>
  );

  if (!expanded) {
    return <Box flexDirection="column">{header}</Box>;
  }

  const maxOffset = Math.max(0, newestFirst.length - MAX_VISIBLE_SESSIONS);
  const offset = Math.min(Math.max(0, scroll), maxOffset);
  const visible = newestFirst.slice(offset, offset + MAX_VISIBLE_SESSIONS);
  const above = offset;
  const below = newestFirst.length - (offset + visible.length);

  return (
    <Box flexDirection="column">
      {header}
      {above > 0 ? <Text dimColor>{`  ▲ ${above} newer`}</Text> : null}
      {visible.map((entry, i) => (
        <SessionRow key={entry.session} entry={entry} isLatest={offset + i === 0} />
      ))}
      {below > 0 ? <Text dimColor>{`  ▼ ${below} older`}</Text> : null}
    </Box>
  );
}

function SessionRow({ entry, isLatest }: { entry: SessionLogEntry; isLatest: boolean }) {
  const prefix = entry.context
    ? entry.context
        .replace(/^##\s+.*\n+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
    : '';
  return (
    <Box>
      <Box width={12} flexShrink={0}>
        <Text color={isLatest ? 'blue' : undefined} dimColor={!isLatest}>
          Session {entry.session}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text dimColor wrap="truncate-end">
          {entry.date}
          {prefix ? ` · ${prefix}` : ''}
        </Text>
      </Box>
      {isLatest ? <Text color="blue"> LATEST</Text> : null}
    </Box>
  );
}

/** Drop a leading Markdown H2 (e.g. "## Next Steps") so the pane isn't headed by a redundant title. */
function stripLeadingHeading(md: string): string {
  return md.replace(/^##\s+.*\n+/, '').trim();
}
