import { readFile, readdir } from 'fs/promises';
import { resolve, basename } from 'path';
import matter from 'gray-matter';
import type {
  Feature,
  FeatureStatus,
  Phase,
  Progress,
  SubPrdStep,
  SessionLogEntry,
  SessionDigest,
} from './types.js';

// ─── Emoji Shortcode Normalization ──────────────────────────────────

/** Replace common GitHub emoji shortcodes with their Unicode equivalents. */
export function normalizeEmoji(text: string): string {
  return text
    .replace(/:white_check_mark:/g, '✅')
    .replace(/:white_large_square:/g, '⬜')
    .replace(/:next_track_button:|:track_next:/g, '⏭️')
    .replace(/:stop_button:/g, '⏹️');
}

// ─── Master Plan ───────────────────────────────────────────────────

export interface MasterPlanResult {
  summary: string | null;
  /** Author-specified frontmatter `tags:` only (authoritative). */
  tags: string[];
  /** Deterministic keyword tags derived from the plan body. */
  keywordTags: string[];
  phases: Phase[];
  progress: Progress;
  lastUpdated: string | null;
  created: string | null;
}

export async function parseMasterPlan(filePath: string): Promise<MasterPlanResult | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const summary = extractSummary(content);
  const lastUpdated = extractFrontmatterField(content, 'Last Updated');
  const created = extractFrontmatterField(content, 'Created');
  const phases = extractPhases(content);

  let done = 0;
  let total = 0;
  for (const phase of phases) {
    done += phase.done;
    total += phase.total;
  }

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const tags = extractFrontmatterTags(content);
  const keywordTags = deriveKeywordTags(content);

  return {
    summary,
    tags,
    keywordTags,
    phases,
    progress: { done, total, percent },
    lastUpdated,
    created,
  };
}

/** Union of two tag lists, preserving order with the first list authoritative,
 *  deduped case-insensitively (first occurrence's casing wins). */
function mergeTags(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...primary, ...secondary]) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Read an author-specified `tags:` array from a master plan's YAML
 *  frontmatter, if present. Mirrors `parseCheckpoint`'s gray-matter usage.
 *  Master plans usually have no YAML frontmatter (they open with `# Title`),
 *  in which case gray-matter returns empty data and this yields `[]`.
 *  Non-array or malformed frontmatter is ignored (also `[]`). Author casing is
 *  preserved; values are trimmed and empties dropped. */
function extractFrontmatterTags(content: string): string[] {
  let data: Record<string, unknown>;
  try {
    data = matter(content).data;
  } catch {
    return [];
  }
  if (!Array.isArray(data.tags)) return [];
  return data.tags
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Extract a one-line summary for a master plan, trying in order:
 *   1. `## Executive Summary` section's first line
 *   2. `## Overview`, `## Summary`, `## Background` (first that exists)
 *   3. The first prose paragraph (skipping frontmatter, headings, metadata,
 *      lists, tables, rules, and gate markers)
 *   4. The H1 title text
 * Returns `null` only when the document has no prose at all. This kills the
 * blank summary cards that appeared whenever a plan lacked an Executive Summary.
 */
function extractSummary(content: string): string | null {
  for (const heading of ['Executive Summary', 'Overview', 'Summary', 'Background']) {
    const para = extractHeadingParagraph(content, heading);
    if (para) return para;
  }
  return extractFirstProse(content) ?? extractH1(content);
}

/** First non-empty content line of a `## <heading>` section, or null. */
function extractHeadingParagraph(content: string, heading: string): string | null {
  const regex = new RegExp(`^##\\s+${heading}\\s*\\n(?:[ \\t]*\\n)*([^\\n#].*)`, 'im');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/** Text of the first level-1 heading (`# Title`), or null. */
function extractH1(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** First prose paragraph, skipping frontmatter, headings, metadata key-value
 *  lines, lists, tables, horizontal rules, blockquotes, and gate markers. */
function extractFirstProse(content: string): string | null {
  const lines = content.split('\n');
  let i = 0;

  // Skip a leading YAML frontmatter fence (--- ... ---), if present.
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    if (i < lines.length) i++; // consume closing fence
  }

  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (t.startsWith('#')) continue; // heading
    if (/^([-*_])\1{2,}$/.test(t)) continue; // horizontal rule (---, ***, ___)
    if (/^\*\*[^*]+\*\*\s*:/.test(t)) continue; // **Field**: metadata
    if (/^[-*+]\s/.test(t)) continue; // bullet list
    if (/^\d+\.\s/.test(t)) continue; // numbered list
    if (t.startsWith('|')) continue; // table row
    if (t.startsWith('>')) continue; // blockquote
    if (t.startsWith('⏸️')) continue; // gate marker
    return t;
  }

  return null;
}

// ─── Keyword Tag Derivation ────────────────────────────────────────

/** Words that never make useful tags: English function words, a handful of
 *  imperative verbs that can head a section, the structural boilerplate of
 *  dev-workflow PRDs, and the canonical workflow filenames. */
const TAG_STOPWORDS = new Set<string>([
  // English function words
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'for',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'into',
  'is',
  'are',
  'be',
  'was',
  'were',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'as',
  'all',
  'any',
  'via',
  'per',
  'not',
  'no',
  'we',
  'you',
  'will',
  'can',
  'could',
  'should',
  'would',
  'must',
  'may',
  'when',
  'then',
  'than',
  'also',
  'if',
  'so',
  'out',
  'up',
  'down',
  'over',
  'under',
  'about',
  'each',
  'both',
  'first',
  'second',
  'third',
  'next',
  'new',
  'only',
  'one',
  'two',
  // imperative verbs that can head a heading
  'add',
  'build',
  'write',
  'run',
  'use',
  'using',
  'make',
  'create',
  'update',
  'implement',
  'extend',
  'define',
  'support',
  'edit',
  'fix',
  'check',
  // PRD structural boilerplate
  'phase',
  'phases',
  'step',
  'steps',
  'goal',
  'goals',
  'summary',
  'executive',
  'implementation',
  'order',
  'verification',
  'verify',
  'gate',
  'status',
  'created',
  'updated',
  'plan',
  'overview',
  'background',
  'notes',
  'note',
  'decisions',
  'blockers',
  'context',
  'todo',
  'done',
  'test',
  'tests',
  'fixture',
  'fixtures',
  'part',
  'reference',
  'references',
  'file',
  'files',
  // canonical workflow filenames
  'master-plan',
  '00-master-plan',
  'sub-prd',
  'checkpoint',
  'session-log',
  'readme',
]);

const TAG_LIMIT = 8;
const PATH_EXT = /\.(ts|tsx|js|cjs|mjs|jsx|md|json|sh|yml|yaml|css|html)$/i;

/** Derive up to {@link TAG_LIMIT} deterministic keyword tags from master-plan
 *  markdown. Sources: section headings, backtick-quoted file paths (reduced to
 *  their stem), and capitalized/code-style identifiers (tokens with two or more
 *  uppercase letters — `JWT`, `OAuth2`, `MasterPlanResult` — which excludes
 *  sentence-initial verbs like `Add`/`Edit`). Pure: no LLM, no I/O. Candidates
 *  are lowercased, stopword-filtered, deduped, and ranked by frequency (ties
 *  broken by first appearance) before the cap is applied. */
export function deriveKeywordTags(content: string): string[] {
  const candidates = new Map<string, { count: number; first: number }>();

  const consider = (raw: string, index: number): void => {
    const tag = raw
      .toLowerCase()
      .trim()
      .replace(/^[-_.]+|[-_.]+$/g, '');
    if (tag.length < 2) return;
    if (/^\d+$/.test(tag)) return; // pure numbers
    if (TAG_STOPWORDS.has(tag)) return;
    const hit = candidates.get(tag);
    if (hit) hit.count++;
    else candidates.set(tag, { count: 1, first: index });
  };

  // 1. Section headings (## … ######): split into word tokens, dropping the
  //    "Phase N:" / "Phase N —" prefix so structural numbering never leaks in.
  const headingRe = /^#{2,6}\s+(.+)$/gm;
  let h: RegExpExecArray | null;
  while ((h = headingRe.exec(content)) !== null) {
    const text = h[1].replace(/^Phase\s+\d+\s*[:\-—–]\s*/i, '');
    for (const word of text.match(/[A-Za-z][A-Za-z0-9]+/g) ?? []) {
      consider(word, h.index);
    }
  }

  // 2. Backtick-quoted file paths → stem (basename minus extension). A span is a
  //    path when it has a code extension or an embedded "/" that is not a
  //    leading slash (which would mark a slash-command like `/dev-checkpoint`).
  const codeRe = /`([^`]+)`/g;
  let c: RegExpExecArray | null;
  while ((c = codeRe.exec(content)) !== null) {
    const span = c[1].trim();
    const looksLikePath = PATH_EXT.test(span) || (span.includes('/') && !span.startsWith('/'));
    if (!looksLikePath) continue;
    const base = span.split('/').pop() ?? span;
    consider(base.replace(PATH_EXT, ''), c.index);
  }

  // 3. Capitalized / code-style identifiers: tokens with ≥2 uppercase letters.
  const idRe = /\b[A-Za-z][A-Za-z0-9]+\b/g;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(content)) !== null) {
    const upper = m[0].match(/[A-Z]/g)?.length ?? 0;
    if (upper >= 2) consider(m[0], m.index);
  }

  return [...candidates.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
    .slice(0, TAG_LIMIT)
    .map(([tag]) => tag);
}

function extractFrontmatterField(content: string, field: string): string | null {
  const regex = new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`);
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractPhases(rawContent: string): Phase[] {
  const content = normalizeEmoji(rawContent);
  const phases: Phase[] = [];

  // Split by phase headers: ### Phase N: Title  or  ## Phase N — Title
  const phaseRegex = /###?\s*Phase\s+(\d+)[:\s—–-]+\s*(.+)/g;
  const headers: { number: number; title: string; index: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = phaseRegex.exec(content)) !== null) {
    headers.push({
      number: parseInt(match[1], 10),
      title: match[2].trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : content.length;
    const section = content.slice(start, end);

    // Detect phase-level status marker from the title (e.g., "### Phase 1: Title ✅")
    let title = headers[i].title;
    let titleMarker: '✅' | '⬜' | null = null;
    if (title.includes('✅')) {
      titleMarker = '✅';
      title = title.replace(/\s*✅\s*/, '').trim();
    } else if (title.includes('⬜')) {
      titleMarker = '⬜';
      title = title.replace(/\s*⬜\s*/, '').trim();
    }

    const { done, total } = countSteps(section);
    let status: Phase['status'];
    if (total > 0) {
      // Use step counts when available
      status = done === total ? 'complete' : done > 0 ? 'in-progress' : 'not-started';
    } else if (titleMarker) {
      // Fall back to phase-level marker when no individual steps found
      status = titleMarker === '✅' ? 'complete' : 'not-started';
    } else {
      // Master+sub-PRD shape: phase body is a pointer to a sub-PRD with the
      // status written as a leading prose line, e.g. `✅ **DONE** (date): …`.
      // Recognize that as the phase status before falling back to **Status**.
      const proseMarker = extractInlineStatusMarker(section);
      const sectionStatus = extractSectionStatus(section);
      status = proseMarker ?? sectionStatus ?? 'not-started';
    }

    phases.push({
      number: headers[i].number,
      title,
      done,
      total,
      status,
    });
  }

  return phases;
}

function countSteps(section: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  let inVerification = false;

  const lines = section.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Track verification sections — checkboxes here are not steps
    if (/^\*\*Verification\*\*/.test(trimmed)) {
      inVerification = true;
      continue;
    }
    // Exit verification section on blank line, heading, or non-list content
    if (inVerification && (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('⏸️'))) {
      inVerification = false;
    }
    if (inVerification) continue;

    // Skip GATE lines
    if (trimmed.includes('⏸️') && trimmed.includes('GATE')) continue;

    // Skip headings, table rows, and other non-step lines
    if (trimmed.startsWith('#') || trimmed.startsWith('|')) continue;

    // Numbered steps: "1. ✅ ..." or "1. ⬜ ..." (⏭️ Skipped / ⛔ Dropped / ⏹️ Deferred all count as resolved)
    const numberedMatch = trimmed.match(/^\d+\.\s*(✅|⬜|⏭️|⛔|⏹️)/);
    if (numberedMatch) {
      total++;
      if (numberedMatch[1] !== '⬜') done++;
      continue;
    }

    // Numbered checkbox steps: "1. [x] ..." or "1. `[x]` ..."
    const numberedCheckbox = trimmed.match(/^\d+\.\s+`?\[(x| )\]`?/);
    if (numberedCheckbox) {
      total++;
      if (numberedCheckbox[1] === 'x') done++;
      continue;
    }

    // Bullet steps: "- ✅ ..." or "- ⬜ ..." (⏭️ Skipped / ⛔ Dropped / ⏹️ Deferred all count as resolved)
    const bulletMatch = trimmed.match(/^-\s+(✅|⬜|⏭️|⛔|⏹️)/);
    if (bulletMatch) {
      total++;
      if (bulletMatch[1] !== '⬜') done++;
      continue;
    }

    // Checkbox steps: "- [x] ..." or "- [ ] ..."
    const checkboxMatch = trimmed.match(/^-\s+\[(x| )\]/);
    if (checkboxMatch) {
      total++;
      if (checkboxMatch[1] === 'x') done++;
      continue;
    }
  }

  return { done, total };
}

/** Check for a **Status** field indicating phase completion (e.g., "- **Status**: `[x]` done"). */
function extractSectionStatus(section: string): Phase['status'] | null {
  const match = section.match(/\*\*Status\*\*:\s*`?\[( |x)\]`?/i);
  if (!match) return null;
  return match[1] === 'x' ? 'complete' : 'not-started';
}

/** Detect a phase-level prose status marker placed as a leading line inside the
 *  section, used by the master + sub-PRD shape where a phase delegates to a
 *  sub-PRD and the master plan records status as text instead of enumerated
 *  steps. Examples that resolve to `complete`:
 *
 *      ✅ **DONE** (2026-05-21): all three tracks shipped.
 *      ✅ **SHIPPED**
 *      ✅ **MERGED** end-to-end.
 *      ✅ **CLOSED** — effort wrapped up.
 *      ❌ **DROPPED** — superseded by sub-PRD 01.
 *      ⏭️ **SKIPPED**
 *      ⏹️ **DEFERRED** — parked for a future, regression-gated PRD.
 *
 *  Examples that resolve to `not-started`:
 *
 *      ⬜ **NOT STARTED**
 *      ⬜ **TODO**
 *
 *  Examples that resolve to `in-progress`:
 *
 *      ⬜ **IN PROGRESS**
 *
 *  Only the first content line after the heading is inspected (skipping
 *  blank lines and a single `See [link]` pointer), so unrelated emoji deeper
 *  in the section don't accidentally retag the phase. */
function extractInlineStatusMarker(section: string): Phase['status'] | null {
  const lines = section.split('\n');
  let i = 0;

  // Skip the heading line.
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].trim().startsWith('#')) i++;

  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (t.startsWith('#')) return null; // next heading — no marker
    if (t.startsWith('⏸️')) return null; // hit the GATE line first
    if (/^\d+\.\s/.test(t)) return null; // numbered step
    if (/^-\s/.test(t)) return null; // bullet
    if (t.startsWith('|')) return null; // table

    // "See [sub-prd-link]" pointer common in master+sub-PRD shape — skip past it.
    if (/^See\s+\[/i.test(t)) continue;

    // Match: leading emoji + (optional bold) status word.
    const m = t.match(
      /^(✅|⬜|❌|⏭️|⏹️)\s*\**\s*(DONE|SHIPPED|MERGED|CLOSED|COMPLETE|COMPLETED|DROPPED|SKIPPED|DEFERRED|NOT[\s-]?STARTED|TODO|IN[\s-]?PROGRESS)\b/i,
    );
    if (!m) return null;

    const emoji = m[1];
    const word = m[2].toUpperCase().replace(/[\s-]/g, '');

    if (word === 'INPROGRESS') return 'in-progress';
    if (word === 'NOTSTARTED' || word === 'TODO') return 'not-started';
    // DONE / SHIPPED / MERGED / CLOSED / COMPLETE / COMPLETED / DROPPED / SKIPPED / DEFERRED → resolved
    if (emoji === '⬜') return 'not-started'; // mismatched emoji + word: trust emoji
    return 'complete';
  }

  return null;
}

// ─── Checkpoint ────────────────────────────────────────────────────

export interface CheckpointResult {
  branch: string | null;
  lastCommit: string | null;
  uncommittedChanges: boolean | null;
  checkpointed: string | null;
  nextAction: string | null;
  decisions: string[];
  blockers: string[];
  notes: string[];
  context: string | null;
  currentState: string | null;
  keyFiles: string | null;
  prdFiles: string[];
  continuationPrompt: string | null;
}

export async function parseCheckpoint(filePath: string): Promise<CheckpointResult | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  let frontmatter: Record<string, unknown> = {};
  let body = content;
  try {
    const parsed = matter(content);
    frontmatter = parsed.data;
    body = parsed.content;
  } catch {
    // Malformed YAML — continue with empty frontmatter
  }

  const branch = typeof frontmatter.branch === 'string' ? frontmatter.branch : null;
  const lastCommit = typeof frontmatter.last_commit === 'string' ? frontmatter.last_commit : null;
  const uncommittedChanges =
    typeof frontmatter.uncommitted_changes === 'boolean' ? frontmatter.uncommitted_changes : null;
  const checkpointed =
    typeof frontmatter.checkpointed === 'string'
      ? frontmatter.checkpointed
      : frontmatter.checkpointed instanceof Date
        ? frontmatter.checkpointed.toISOString()
        : null;

  const nextAction = extractXmlTag(content, 'next_action');
  const decisions = extractXmlListItems(content, 'decisions');
  const blockers = extractXmlListItems(content, 'blockers');
  const notes = extractXmlListItems(content, 'notes');
  const context = extractXmlTag(content, 'context');
  const currentState = extractXmlTag(content, 'current_state');
  const keyFiles = extractXmlTag(content, 'key_files');
  const prdFiles = extractPrdFiles(content);
  const continuationPrompt = extractContinuationPromptFromBody(body);

  return {
    branch,
    lastCommit,
    uncommittedChanges,
    checkpointed,
    nextAction,
    decisions,
    blockers,
    notes,
    context,
    currentState,
    keyFiles,
    prdFiles,
    continuationPrompt,
  };
}

function extractXmlTag(content: string, tag: string): string | null {
  // Last-match semantics: when a document contains multiple `<tag>...</tag>`
  // blocks (e.g., the AFK runner's stdout where a SKILL.md or rubric quotes
  // example `<verdict>` blocks before the implementer emits its own as the
  // final block), the last occurrence governs.
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');

  // Fast path: no backticks means no risk of matching tags inside inline code
  if (!content.includes('`')) {
    const matches = [...content.matchAll(regex)];
    const match = matches[matches.length - 1];
    return match ? match[1].trim() : null;
  }

  // Replace inline code spans with placeholders to prevent XML tags
  // inside backtick code (e.g., `<decisions>`) from being matched.
  const placeholders: { placeholder: string; original: string }[] = [];
  let counter = 0;
  const stripped = content.replace(/`[^`]*`/g, (m) => {
    const placeholder = `\x00INLINE_CODE_${counter++}\x00`;
    placeholders.push({ placeholder, original: m });
    return placeholder;
  });

  const matches = [...stripped.matchAll(regex)];
  const match = matches[matches.length - 1];
  if (!match) return null;

  let result = match[1].trim();
  for (const { placeholder, original } of placeholders) {
    result = result.replace(placeholder, original);
  }
  return result;
}

function extractXmlListItems(content: string, tag: string): string[] {
  const block = extractXmlTag(content, tag);
  if (!block) return [];

  const items: string[] = [];
  const lines = block.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match list items: "- item text"
    const listMatch = trimmed.match(/^-\s+(.+)/);
    if (listMatch) {
      // Strip stray close tags from list items (legacy format where
      // e.g. "- text</decisions>" appears on the last item before the closing tag)
      const item = listMatch[1]
        .replace(
          /<\/(?:decisions|blockers|notes|context|current_state|next_action|key_files)>$/i,
          '',
        )
        .trim();
      items.push(item);
    }
  }

  return items;
}

// ─── PRD File List ────────────────────────────────────────────────

/** Extract the PRD file list from the "Read the following PRD files in order:" section. */
function extractPrdFiles(content: string): string[] {
  const match = content.match(/Read the following PRD files in order:\s*\n([\s\S]*?)(?:\n\n|\n<)/i);
  if (!match) return [];

  const files: string[] = [];
  const lines = match[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match numbered list items: "1. path/to/file.md"
    const fileMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (fileMatch) {
      files.push(fileMatch[1].trim());
    }
  }

  return files;
}

// ─── Continuation Prompt ──────────────────────────────────────────

/** Extract the continuation prompt from the body (frontmatter already stripped). */
function extractContinuationPromptFromBody(body: string): string | null {
  const separatorRegex = /^---\s*$/gm;
  let lastSeparatorIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = separatorRegex.exec(body)) !== null) {
    lastSeparatorIndex = m.index;
  }

  if (lastSeparatorIndex === -1) return null;

  const after = body.slice(lastSeparatorIndex + 3).trim();
  if (!after) return null;

  return after;
}

// ─── Sub-PRD ───────────────────────────────────────────────────────

export interface SubPrdResult {
  id: string;
  title: string;
  done: number;
  total: number;
  status: 'complete' | 'in-progress' | 'not-started';
  steps: SubPrdStep[];
}

export async function parseSubPrd(filePath: string): Promise<SubPrdResult | null> {
  let content: string;
  try {
    content = normalizeEmoji(await readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }

  const id = basename(filePath, '.md');

  // Extract title from "# Sub-PRD: Title" heading
  const titleMatch = content.match(/^#\s+Sub-PRD:\s*(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : id;

  // Extract steps from Implementation Progress table
  const steps: SubPrdStep[] = [];
  const tableRegex =
    /## Implementation Progress[\s\S]*?\|[\s\S]*?\|[\s\S]*?\|([\s\S]*?)(?=\n---|\n##|$)/;
  const tableMatch = content.match(tableRegex);

  if (tableMatch) {
    const tableBody = tableMatch[1];
    // Step rows. The identifier may be bold or plain (`1` or `**1**`) and need
    // not be purely numeric — track-lettered/dotted IDs like `3A`, `3A.1`, `3G`
    // are all valid step labels; we only require it to start with a digit so the
    // `| Step |` header and `|---|` separator rows never match. The status cell's
    // first glyph is the marker; `⏭️` (Skipped), `⛔` (Dropped), and `⏹️` (Deferred)
    // all count as resolved, like `✅`. Only `⬜` is pending.
    const rowRegex = /\|\s*\*{0,2}(\d[\w.]*)\*{0,2}\s*\|([^|]*)\|\s*(✅|⬜|⏭️|⛔|⏹️)[^|]*\|/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const marker = rowMatch[3];
      steps.push({
        number: rowMatch[1],
        description: rowMatch[2].trim(),
        status: marker === '⬜' ? 'pending' : 'done',
      });
    }
  }

  const done = steps.filter((s) => s.status === 'done').length;
  const total = steps.length;
  const status: SubPrdResult['status'] =
    total === 0
      ? (extractSubPrdHeaderStatus(content) ?? 'not-started')
      : done === total
        ? 'complete'
        : done > 0
          ? 'in-progress'
          : 'not-started';

  return { id, title, done, total, status, steps };
}

/** Extract status from the **Status** frontmatter field in a sub-PRD (e.g., "**Status**: Complete"). */
function extractSubPrdHeaderStatus(content: string): SubPrdResult['status'] | null {
  const match = content.match(/\*\*Status\*\*:\s*(.+)/i);
  if (!match) return null;
  const val = match[1].trim().toLowerCase();
  const resolved = [
    'complete',
    'completed',
    'done',
    'shipped',
    'merged',
    'closed',
    'deferred',
    'dropped',
    'skipped',
  ];
  if (resolved.includes(val)) return 'complete';
  if (val.startsWith('in progress') || val.startsWith('in-progress')) return 'in-progress';
  if (val === 'not started' || val === 'not-started' || val === 'pending') return 'not-started';
  return null;
}

// ─── Status Determination ──────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface StatusInput {
  hasMasterPlan: boolean;
  allComplete: boolean;
  checkpointDate: string | null;
  lastUpdated: string | null;
  now: Date;
  isEmpty?: boolean;
  atGate?: boolean;
  progressDone?: number;
}

export function determineFeatureStatus(input: StatusInput): FeatureStatus {
  const {
    hasMasterPlan,
    allComplete,
    checkpointDate,
    lastUpdated,
    now,
    isEmpty,
    atGate,
    progressDone,
  } = input;

  // Empty directory
  if (isEmpty) return 'empty';

  // No master plan
  if (!hasMasterPlan) {
    if (checkpointDate) return 'checkpoint-only';
    return 'no-prd';
  }

  // All steps complete
  if (allComplete) return 'complete';

  // At a phase gate — completed phase(s) with next phase not started, no in-progress phase
  if (atGate) return 'gate';

  // Staleness check
  const referenceDate = checkpointDate || lastUpdated;
  if (referenceDate) {
    const refMs = new Date(referenceDate).getTime();
    const ageMs = now.getTime() - refMs;
    if (ageMs > THIRTY_DAYS_MS) return 'stale';
    // No work started and no checkpoint — treat as stale (planned but not active)
    if (progressDone === 0 && !checkpointDate) return 'stale';
    return 'active';
  }

  // No date reference available — treat as stale
  return 'stale';
}

// ─── Full Feature Parser ──────────────────────────────────────────

export async function parseFeature(featureDir: string, name: string): Promise<Feature> {
  // Check if directory is empty (only .gitkeep or truly empty)
  const isEmpty = await isEmptyFeatureDir(featureDir);

  const masterPlan = await parseMasterPlan(resolve(featureDir, '00-master-plan.md'));
  const checkpoint = await parseCheckpoint(resolve(featureDir, 'checkpoint.md'));

  // Progress resolution:
  //   1. Master plan with inline steps still pending → master plan progress (sub-PRDs
  //      typically document master-plan work in detail; combining would double-count).
  //   2. Master plan with inline steps all complete + sub-PRD with pending steps →
  //      add the sub-PRD steps (treat sub-PRD as an extension landing after the
  //      original feature shipped).
  //   3. Master plan with 0 inline steps → fall back to sub-PRD aggregation, then
  //      to phase-level ✅ markers.
  let progress: Progress | null = masterPlan?.progress ?? null;
  if (masterPlan && masterPlan.progress.total === 0) {
    const subPrdProgress = await aggregateSubPrdProgress(featureDir);
    if (subPrdProgress && subPrdProgress.total > 0) {
      progress = subPrdProgress;
    } else if (masterPlan.phases.length > 0) {
      // Use phases themselves as progress units (for plans with title-level ✅ markers)
      const done = masterPlan.phases.filter((p) => p.status === 'complete').length;
      const total = masterPlan.phases.length;
      progress = { done, total, percent: Math.round((done / total) * 100) };
    }
  } else if (
    masterPlan &&
    masterPlan.progress.total > 0 &&
    masterPlan.progress.done === masterPlan.progress.total
  ) {
    // Master plan finished — add any sub-PRD steps as additive extension work.
    const subPrdProgress = await aggregateSubPrdProgress(featureDir);
    if (subPrdProgress && subPrdProgress.total > 0) {
      const done = masterPlan.progress.done + subPrdProgress.done;
      const total = masterPlan.progress.total + subPrdProgress.total;
      progress = { done, total, percent: Math.round((done / total) * 100) };
    }
  }

  const allComplete = progress !== null && progress.total > 0 && progress.done === progress.total;

  // At gate: completed phase(s) followed by not-started phase(s), no in-progress phase
  // Fall back to sub-PRD statuses when master plan has no Phase headers
  let gatePhases = masterPlan?.phases ?? [];
  if (gatePhases.length === 0 && masterPlan) {
    gatePhases = await parseSubPrdsAsPhases(featureDir);
  }
  const atGate =
    !allComplete &&
    gatePhases.some((p) => p.status === 'complete') &&
    gatePhases.some((p) => p.status === 'not-started') &&
    !gatePhases.some((p) => p.status === 'in-progress');

  const status = determineFeatureStatus({
    hasMasterPlan: masterPlan !== null,
    allComplete,
    checkpointDate: checkpoint?.checkpointed ?? null,
    lastUpdated: masterPlan?.lastUpdated ?? null,
    now: new Date(),
    isEmpty: isEmpty && masterPlan === null && checkpoint === null,
    atGate,
    progressDone: progress?.done,
  });

  // Find current phase (first in-progress, or first not-started). When all
  // master plan phases are complete but a sub-PRD still has pending phases,
  // surface the first pending sub-PRD phase so AFK and the dashboard can pick
  // up extension work.
  let currentPhase: Feature['currentPhase'] = null;
  if (masterPlan) {
    const inProgress = masterPlan.phases.find((p) => p.status === 'in-progress');
    const notStarted = masterPlan.phases.find((p) => p.status === 'not-started');
    const active = inProgress || notStarted;
    if (active) {
      currentPhase = {
        number: active.number,
        total: masterPlan.phases.length,
        title: active.title,
      };
    } else if (!allComplete) {
      const subPrdPhases = await parseSubPrdsAsPhases(featureDir);
      const subActive =
        subPrdPhases.find((p) => p.status === 'in-progress') ??
        subPrdPhases.find((p) => p.status === 'not-started');
      if (subActive) {
        currentPhase = {
          number: subActive.number,
          total: subPrdPhases.length,
          title: subActive.title,
        };
      }
    }
  }

  return {
    name,
    status,
    progress,
    currentPhase,
    lastCheckpoint: checkpoint?.checkpointed ?? null,
    created: masterPlan?.created ?? null,
    lastUpdated: masterPlan?.lastUpdated ?? null,
    nextAction: checkpoint?.nextAction ?? null,
    branch: checkpoint?.branch ?? null,
    summary: masterPlan?.summary ?? null,
    // Frontmatter tags (authoritative, first) unioned with derived keyword tags.
    tags: masterPlan ? mergeTags(masterPlan.tags, masterPlan.keywordTags) : [],
  };
}

/** Aggregate step counts from sub-PRD files when master plan has no inline steps. */
async function aggregateSubPrdProgress(featureDir: string): Promise<Progress | null> {
  try {
    const entries = await readdir(featureDir);
    const subPrdFiles = entries.filter((e) => /^\d+-sub-prd-.*\.md$/.test(e)).sort();
    if (subPrdFiles.length === 0) return null;

    let done = 0;
    let total = 0;
    for (const file of subPrdFiles) {
      const result = await parseSubPrd(resolve(featureDir, file));
      if (result) {
        done += result.done;
        total += result.total;
      }
    }

    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  } catch {
    return null;
  }
}

/** Scan sub-PRDs in a feature directory and return Phase-like entries for gate detection. */
export async function parseSubPrdsAsPhases(featureDir: string): Promise<Phase[]> {
  try {
    const entries = await readdir(featureDir);
    const subPrdFiles = entries.filter((e) => /^\d+-sub-prd-.*\.md$/.test(e)).sort();
    if (subPrdFiles.length === 0) return [];

    const phases: Phase[] = [];
    for (const file of subPrdFiles) {
      const result = await parseSubPrd(resolve(featureDir, file));
      if (result) {
        const numMatch = file.match(/^(\d+)/);
        const number = numMatch ? parseInt(numMatch[1], 10) : phases.length + 1;
        phases.push({
          number,
          title: result.title,
          done: result.done,
          total: result.total,
          status: result.status,
        });
      }
    }

    return phases;
  } catch {
    return [];
  }
}

// ─── Session Log ─────────────────────────────────────────────────

/** Parse session-log.md and return an array of session entries.
 *
 *  Session numbers are derived from position in file (Session 1 = first entry).
 *  Fault-tolerant: skips malformed entries (logs warning to stderr, continues).
 *  Reuses `extractXmlTag()` and `extractXmlListItems()` from parser.ts.
 */
export async function parseSessionLog(filePath: string): Promise<SessionLogEntry[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  if (!content.trim()) return [];

  // Split content into session sections by finding `## Session N` headings
  // Each section runs from its heading to the next `## Session` heading (or EOF)
  const sessionRegex = /^## Session\s+\d+\s*—\s*.+/gm;
  const headings: { index: number; text: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = sessionRegex.exec(content)) !== null) {
    headings.push({ index: match.index, text: match[0] });
  }

  if (headings.length === 0) return [];

  const entries: SessionLogEntry[] = [];

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : content.length;
    const section = content.slice(start, end);

    try {
      // Extract date from heading: "## Session N — YYYY-MM-DDT..."
      const dateMatch = section.match(/^## Session\s+\d+\s*—\s*(.+)/);
      const date = dateMatch ? dateMatch[1].trim() : '';

      // Extract XML sections using existing parser utilities
      const context = extractXmlTag(section, 'context');
      const decisions = extractXmlListItems(section, 'decisions');
      const blockers = extractXmlListItems(section, 'blockers');
      const notes = extractXmlListItems(section, 'notes');

      entries.push({
        session: i + 1, // 1-indexed, derived from position
        date,
        context,
        decisions,
        blockers,
        notes,
      });
    } catch (err) {
      // Fault-tolerant: skip malformed entries
      process.stderr.write(
        `Warning: skipping malformed session entry at position ${i + 1}: ${err instanceof Error ? err.message : err}\n`,
      );
    }
  }

  return entries;
}

// ─── Session Digest ──────────────────────────────────────────────

/** Parse session-digest.md and return the digest, or null when the file is absent.
 *
 *  Single-doc gray-matter read. Frontmatter keys are snake_case
 *  (consolidated_through, session_count, generated); the body holds an
 *  `<aggregate>` narrative and an optional `<decisions>` list. Reuses
 *  extractXmlTag()/extractXmlListItems() — the same machinery as parseCheckpoint.
 */
export async function parseSessionDigest(filePath: string): Promise<SessionDigest | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = matter(content).data;
  } catch {
    // Malformed YAML — continue with empty frontmatter
  }

  const sessionCount =
    typeof frontmatter.session_count === 'number' ? frontmatter.session_count : 0;
  const consolidatedThrough =
    typeof frontmatter.consolidated_through === 'number' ? frontmatter.consolidated_through : 0;
  const generated =
    typeof frontmatter.generated === 'string'
      ? frontmatter.generated
      : frontmatter.generated instanceof Date
        ? frontmatter.generated.toISOString()
        : null;

  const aggregate = extractXmlTag(content, 'aggregate');
  const decisions = extractXmlListItems(content, 'decisions');

  return { sessionCount, consolidatedThrough, generated, aggregate, decisions };
}

async function isEmptyFeatureDir(dirPath: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    // Consider empty if only .gitkeep
    return entries.length === 0 || (entries.length === 1 && entries[0] === '.gitkeep');
  } catch {
    return true;
  }
}
