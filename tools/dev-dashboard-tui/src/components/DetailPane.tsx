import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Text, measureElement } from 'ink';
import type { DOMElement } from 'ink';
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
  /** Whole-pane vertical scroll offset in rows (j/k when the detail pane is focused). */
  scroll?: number;
  /** Reports the clamped maximum scroll offset up so the nav hook can bound j/k. */
  onScrollMax?: (max: number) => void;
}

/**
 * Right pane: the selected feature's expanded detail — status/phase/progress
 * header, next action, decisions, blockers, phases (with icons), sub-PRDs, and a
 * collapsible session history. The terminal analog of the web dashboard's
 * FeaturePanel (read-only; the open/archive actions are out of MVP).
 *
 * Every prose/list section wraps to the full pane width (nothing is clipped to a
 * single row); because the pane is a fixed height, the whole body scrolls as one
 * unit — j/k when the pane is focused move `scroll`, and the content that
 * overflows the viewport is reachable by scrolling rather than lost off-screen.
 */
export function DetailPane({
  detail,
  loading,
  error,
  focused = false,
  sessionExpanded = false,
  scroll = 0,
  onScrollMax,
}: Props) {
  const viewportRef = useRef<DOMElement | null>(null);
  const contentRef = useRef<DOMElement | null>(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const lastReported = useRef(-1);

  // Ink has no native scroll: after each layout, measure the full content height
  // against the clipped viewport height and derive how far the pane can scroll.
  // The offset is applied as a negative marginTop on the content and the
  // viewport's overflowY:hidden clips the rest. Guarded (equality checks) so the
  // post-render measure settles instead of re-rendering forever.
  useEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const max = Math.max(0, measureElement(ct).height - measureElement(vp).height);
    setMaxScroll((prev) => (prev === max ? prev : max));
    if (lastReported.current !== max) {
      lastReported.current = max;
      onScrollMax?.(max);
    }
  });

  const offset = Math.min(Math.max(0, scroll), maxScroll);

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
        <>
          <Box
            ref={viewportRef}
            flexGrow={1}
            minHeight={0}
            flexDirection="column"
            overflowY="hidden"
          >
            <Box ref={contentRef} flexShrink={0} flexDirection="column" marginTop={-offset}>
              <DetailBody detail={detail} sessionExpanded={sessionExpanded} />
            </Box>
          </Box>
          {maxScroll > 0 ? (
            <Box flexShrink={0} justifyContent="space-between">
              <Text dimColor>{offset > 0 ? '▲ more above' : ' '}</Text>
              <Text dimColor>{offset < maxScroll ? '▼ more below' : ' '}</Text>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}

function DetailBody({
  detail,
  sessionExpanded,
}: {
  detail: FeatureDetail;
  sessionExpanded: boolean;
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
              <Box width={2} flexShrink={0} marginRight={1}>
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
              {sub.total > 0 && sub.countsAuthoritative !== false ? (
                <Text dimColor>
                  {sub.done}/{sub.total}
                </Text>
              ) : null}
            </Box>
          ))}
        </Section>
      ) : null}

      {detail.sessionLog && detail.sessionLog.length > 0 ? (
        <SessionHistory log={detail.sessionLog} expanded={sessionExpanded} />
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

// Bullet rows wrap to the full pane width; the flex layout keeps wrapped lines
// hanging-indented under the text (not under the bullet), since the wrapping
// Text lives in its own box that starts after the "• " marker.
function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <>
      {items.map((item, i) => (
        <Box key={i}>
          <Text color={color} dimColor={!color}>
            {'• '}
          </Text>
          <Box flexGrow={1}>
            <Text color={color}>{item}</Text>
          </Box>
        </Box>
      ))}
    </>
  );
}

function SessionHistory({ log, expanded }: { log: SessionLogEntry[]; expanded: boolean }) {
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

  // Every session renders when expanded — no per-section window; the whole-pane
  // scroll (owned by DetailPane) is what pages through a long history.
  return (
    <Box flexDirection="column">
      {header}
      {newestFirst.map((entry, i) => (
        <SessionRow key={entry.session} entry={entry} isLatest={i === 0} />
      ))}
    </Box>
  );
}

function SessionRow({ entry, isLatest }: { entry: SessionLogEntry; isLatest: boolean }) {
  const summary = sessionSummary(entry.context);
  return (
    <Box>
      <Box width={12} flexShrink={0}>
        <Text color={isLatest ? 'blue' : undefined} dimColor={!isLatest}>
          Session {entry.session}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text dimColor>
          {entry.date}
          {summary ? ` · ${summary}` : ''}
        </Text>
      </Box>
      {isLatest ? (
        <Box flexShrink={0}>
          <Text color="blue"> LATEST</Text>
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * One-line-ish summary of a session's context: drop the leading Markdown heading,
 * collapse whitespace, and cap defensively so a whole multi-paragraph context
 * can't flood the log. The row wraps to the full pane width (no hard 60-char
 * cap), so on wide terminals the summary fills the space instead of stopping short.
 */
function sessionSummary(context: string | null): string {
  if (!context) return '';
  const flat = context
    .replace(/^##\s+.*?\n+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

/** Drop a leading Markdown H2 (e.g. "## Next Steps") so the pane isn't headed by a redundant title. */
function stripLeadingHeading(md: string): string {
  return md.replace(/^##\s+.*\n+/, '').trim();
}
