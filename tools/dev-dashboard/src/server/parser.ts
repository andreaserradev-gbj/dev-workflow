import { readFile, readdir } from 'fs/promises';
import { resolve, basename } from 'path';
import matter from 'gray-matter';
import type { Feature, FeatureStatus, Phase, Progress, SubPrdStep } from '../shared/types.js';

// ─── Emoji Shortcode Normalization ──────────────────────────────────

/** Replace common GitHub emoji shortcodes with their Unicode equivalents. */
function normalizeEmoji(text: string): string {
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
  const phases = extractPhases(content);

  let done = 0;
  let total = 0;
  for (const phase of phases) {
    done += phase.done;
    total += phase.total;
  }

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { summary, phases, progress: { done, total, percent }, lastUpdated };
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
      status = 'not-started';
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
  };
}

function extractXmlTag(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = content.match(regex);
  if (!match) return null;
  return match[1].trim();
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
      items.push(listMatch[1].trim());
    }
  }

  return items;
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
      ? 'not-started'
      : done === total
        ? 'complete'
        : done > 0
          ? 'in-progress'
          : 'not-started';

  return { id, title, done, total, status, steps };
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
}

export function determineFeatureStatus(input: StatusInput): FeatureStatus {
  const { hasMasterPlan, allComplete, checkpointDate, lastUpdated, now, isEmpty, atGate } = input;

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

  const allComplete =
    masterPlan !== null &&
    masterPlan.progress.total > 0 &&
    masterPlan.progress.done === masterPlan.progress.total;

  // At gate: completed phase(s) followed by not-started phase(s), no in-progress phase
  const atGate =
    masterPlan !== null &&
    !allComplete &&
    masterPlan.phases.some((p) => p.status === 'complete') &&
    masterPlan.phases.some((p) => p.status === 'not-started') &&
    !masterPlan.phases.some((p) => p.status === 'in-progress');

  const status = determineFeatureStatus({
    hasMasterPlan: masterPlan !== null,
    allComplete,
    checkpointDate: checkpoint?.checkpointed ?? null,
    lastUpdated: masterPlan?.lastUpdated ?? null,
    now: new Date(),
    isEmpty: isEmpty && masterPlan === null && checkpoint === null,
    atGate,
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
    progress: masterPlan?.progress ?? null,
    currentPhase,
    lastCheckpoint: checkpoint?.checkpointed ?? null,
    nextAction: checkpoint?.nextAction ?? null,
    branch: checkpoint?.branch ?? null,
    summary: masterPlan?.summary ?? null,
  };
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
