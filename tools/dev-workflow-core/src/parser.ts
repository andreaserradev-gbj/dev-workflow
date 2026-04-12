import { readFile, readdir } from 'fs/promises';
import { resolve, basename } from 'path';
import matter from 'gray-matter';
import type { Feature, FeatureStatus, Phase, Progress, SubPrdStep, SessionLogEntry } from './types.js';

// ─── Emoji Shortcode Normalization ──────────────────────────────────

/** Replace common GitHub emoji shortcodes with their Unicode equivalents. */
export function normalizeEmoji(text: string): string {
  return text
    .replace(/:white_check_mark:/g, '✅')
    .replace(/:white_large_square:/g, '⬜')
    .replace(/:next_track_button:|:track_next:/g, '⏭️');
}

// ─── Master Plan ───────────────────────────────────────────────────

export interface MasterPlanResult {
  summary: string | null;
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

  return { summary, phases, progress: { done, total, percent }, lastUpdated, created };
}

function extractSummary(content: string): string | null {
  const match = content.match(/## Executive Summary\s*\n\s*\n([^\n]+)/);
  if (!match) return null;
  return match[1].trim();
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
      // Fall back to **Status** field in section (e.g., "- **Status**: `[x]` done")
      const sectionStatus = extractSectionStatus(section);
      status = sectionStatus ?? 'not-started';
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

    // Numbered steps: "1. ✅ ..." or "1. ⬜ ..."
    const numberedMatch = trimmed.match(/^\d+\.\s*(✅|⬜|⏭️)/);
    if (numberedMatch) {
      total++;
      if (numberedMatch[1] === '✅' || numberedMatch[1] === '⏭️') done++;
      continue;
    }

    // Numbered checkbox steps: "1. [x] ..." or "1. `[x]` ..."
    const numberedCheckbox = trimmed.match(/^\d+\.\s+`?\[(x| )\]`?/);
    if (numberedCheckbox) {
      total++;
      if (numberedCheckbox[1] === 'x') done++;
      continue;
    }

    // Bullet steps: "- ✅ ..." or "- ⬜ ..."
    const bulletMatch = trimmed.match(/^-\s+(✅|⬜|⏭️)/);
    if (bulletMatch) {
      total++;
      if (bulletMatch[1] === '✅' || bulletMatch[1] === '⏭️') done++;
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
  try {
    const parsed = matter(content);
    frontmatter = parsed.data;
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
  const continuationPrompt = extractContinuationPrompt(content);

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
  // Replace inline code spans with placeholders to prevent XML tags
  // inside backtick code (e.g., `<decisions>`) from being matched.
  // Restoration happens after matching so extracted content preserves
  // any legitimate inline code.
  const placeholders: { placeholder: string; original: string }[] = [];
  let counter = 0;
  const stripped = content.replace(/`[^`]*`/g, (match) => {
    const placeholder = `\x00INLINE_CODE_${counter++}\x00`;
    placeholders.push({ placeholder, original: match });
    return placeholder;
  });

  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = stripped.match(regex);
  if (!match) return null;

  let result = match[1].trim();
  // Restore any placeholders that appear in the extracted content
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
      let item = listMatch[1].replace(/<\/(?:decisions|blockers|notes|context|current_state|next_action|key_files)>$/i, '').trim();
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

/** Extract the continuation prompt text after the final `---` separator.
 *  Only searches the body content after the YAML frontmatter, not the
 *  frontmatter delimiters themselves.
 */
function extractContinuationPrompt(content: string): string | null {
  // Strip YAML frontmatter to avoid matching its --- delimiters.
  // gray-matter.parse() separates frontmatter from body; we work on body only.
  let body: string;
  try {
    const parsed = matter(content);
    body = parsed.content;
  } catch {
    // If YAML is malformed, fall back to rough stripping: everything after second ---
    const secondDash = content.indexOf('---', content.indexOf('---') + 3);
    body = secondDash >= 0 ? content.slice(secondDash + 3) : content;
  }

  // Find the last `---` on its own line in the body content
  const separatorRegex = /^---\s*$/gm;
  let lastSeparatorIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = separatorRegex.exec(body)) !== null) {
    lastSeparatorIndex = m.index;
  }

  if (lastSeparatorIndex === -1) return null;

  // Text after the last `---` separator in the body
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
    const rowRegex = /\|\s*\*\*(\d+)\*\*\s*\|[^|]*\|\s*(✅|⬜|⏭️)[^|]*\|/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const stepNum = parseInt(rowMatch[1], 10);
      const marker = rowMatch[2];
      steps.push({
        number: stepNum,
        description: '', // Not needed for status
        status: marker === '✅' || marker === '⏭️' ? 'done' : 'pending',
      });
    }
  }

  // Also extract step descriptions
  if (steps.length > 0) {
    // Re-parse to get descriptions from the table
    const rowDescRegex = /\|\s*\*\*(\d+)\*\*\s*\|\s*([^|]+)\|/g;
    let descMatch: RegExpExecArray | null;
    while ((descMatch = rowDescRegex.exec(content)) !== null) {
      const num = parseInt(descMatch[1], 10);
      const step = steps.find((s) => s.number === num);
      if (step) {
        step.description = descMatch[2].trim();
      }
    }
  }

  const done = steps.filter((s) => s.status === 'done').length;
  const total = steps.length;
  const status: SubPrdResult['status'] =
    total === 0
      ? extractSubPrdHeaderStatus(content) ?? 'not-started'
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
  if (val === 'complete' || val === 'completed' || val === 'done') return 'complete';
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

  // If master plan has 0 inline steps, fall back to sub-PRD progress, then phase counts
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

  // Find current phase (first in-progress, or first not-started)
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

async function isEmptyFeatureDir(dirPath: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    // Consider empty if only .gitkeep
    return entries.length === 0 || (entries.length === 1 && entries[0] === '.gitkeep');
  } catch {
    return true;
  }
}
