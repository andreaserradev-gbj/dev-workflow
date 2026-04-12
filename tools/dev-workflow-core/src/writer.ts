import { readFile, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import { normalizeEmoji } from './parser.js';
import type {
  CheckpointWriteInput,
  StepTarget,
  StatusMarker,
  StatusUpdateResult,
} from './types.js';

// ─── Checkpoint Writer ─────────────────────────────────────────────

/**
 * Write a checkpoint file that is compatible with parseCheckpoint().
 *
 * Produces YAML frontmatter (snake_case keys) + XML sections.
 * Uses gray-matter's stringify for frontmatter generation.
 * Optional sections (decisions, blockers, notes) are omitted when empty.
 */
export async function writeCheckpoint(
  filePath: string,
  data: CheckpointWriteInput,
): Promise<void> {
  // Build frontmatter with snake_case keys
  const frontmatter: Record<string, unknown> = {};
  if (data.branch !== undefined) frontmatter.branch = data.branch;
  if (data.lastCommit !== undefined) frontmatter.last_commit = data.lastCommit;
  if (data.uncommittedChanges !== undefined)
    frontmatter.uncommitted_changes = data.uncommittedChanges;
  frontmatter.checkpointed = data.checkpointed ?? new Date().toISOString();

  // Build body content
  let body = '';

  // PRD files list
  if (data.prdFiles && data.prdFiles.length > 0) {
    body += 'Read the following PRD files in order:\n\n';
    for (let i = 0; i < data.prdFiles.length; i++) {
      body += `${i + 1}. ${data.prdFiles[i]}\n`;
    }
    body += '\n';
  }

  // Required XML sections
  body += `<context>\n${data.context}\n</context>\n\n`;
  body += `<current_state>\n${data.currentState}\n</current_state>\n\n`;
  body += `<next_action>\n${data.nextAction}\n</next_action>\n\n`;
  body += `<key_files>\n${data.keyFiles}\n</key_files>`;

  // Optional XML sections — only included when arrays are non-empty
  if (data.decisions && data.decisions.length > 0) {
    body += '\n\n<decisions>\n';
    for (const d of data.decisions) {
      body += `- ${d}\n`;
    }
    body += '</decisions>';
  }

  if (data.blockers && data.blockers.length > 0) {
    body += '\n\n<blockers>\n';
    for (const b of data.blockers) {
      body += `- ${b}\n`;
    }
    body += '</blockers>';
  }

  if (data.notes && data.notes.length > 0) {
    body += '\n\n<notes>\n';
    for (const n of data.notes) {
      body += `- ${n}\n`;
    }
    body += '</notes>';
  }

  // Continuation prompt
  if (data.continuationPrompt) {
    body += `\n\n---\n\n${data.continuationPrompt}\n`;
  }

  // Combine frontmatter + body via gray-matter
  const output = matter.stringify(body, frontmatter);

  await writeFile(filePath, output, 'utf-8');
}

// ─── Status Marker Updater ─────────────────────────────────────────

/**
 * Surgically update a status marker (⬜ ↔ ✅) in a PRD file.
 *
 * Uses normalizeEmoji() pre-pass so emoji shortcodes are handled.
 * Only the targeted marker line changes — all other content is preserved.
 */
export async function updateStatus(
  filePath: string,
  target: StepTarget,
  marker: StatusMarker,
): Promise<StatusUpdateResult> {
  const original = await readFile(filePath, 'utf-8');
  const normalized = normalizeEmoji(original);
  const lines = normalized.split('\n');

  // Find phase section boundaries
  const phaseRegex = /^#{2,3}\s*Phase\s+(\d+)/i;
  const phases: { number: number; startLine: number; endLine: number }[] = [];

  // Scan lines for phase headings, record phase boundaries
  const phaseHeadingLines: { number: number; line: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(phaseRegex);
    if (match) {
      phaseHeadingLines.push({
        number: parseInt(match[1], 10),
        line: i,
        text: lines[i],
      });
    }
  }

  // Build phase sections: each section runs from its heading to the next heading (or EOF)
  for (let i = 0; i < phaseHeadingLines.length; i++) {
    const startLine = phaseHeadingLines[i].line;
    const endLine =
      i + 1 < phaseHeadingLines.length ? phaseHeadingLines[i + 1].line : lines.length;
    phases.push({
      number: phaseHeadingLines[i].number,
      startLine,
      endLine,
    });
  }

  const phase = phases.find((p) => p.number === target.phase);
  if (!phase) {
    throw new Error(
      `Phase ${target.phase} not found in ${filePath}`,
    );
  }

  let targetLineIdx = -1;
  let markerFlipped = false;

  if (target.step === undefined) {
    // Phase-level marker: flip marker in the phase heading line
    targetLineIdx = phase.startLine;
    const line = lines[targetLineIdx];
    const opposite: StatusMarker = marker === '✅' ? '⬜' : '✅';
    if (line.includes(opposite)) {
      // Replace the opposite marker with the target
      lines[targetLineIdx] = line.replace(opposite, marker);
      markerFlipped = true;
    } else if (line.includes(marker)) {
      // Already has the target marker
      markerFlipped = false;
    } else {
      // No marker found — append one
      lines[targetLineIdx] = line.trimEnd() + ' ' + marker;
      markerFlipped = true;
    }
  } else {
    // Step-level marker: find the specific step within the phase section
    let stepCount = 0;

    // Scan for ⏸️ GATE lines to detect verification sections — skip steps after them
    let inVerification = false;

    for (let i = phase.startLine; i < phase.endLine; i++) {
      const trimmed = lines[i].trimEnd();

      // Track verification sections
      if (/^\*\*Verification\*\*/.test(trimmed)) {
        inVerification = true;
        continue;
      }
      if (inVerification) {
        if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('⏸️')) {
          inVerification = false;
        } else {
          continue;
        }
      }

      // Skip GATE lines
      if (trimmed.includes('⏸️') && trimmed.includes('GATE')) continue;

      // Numbered steps: "3. ✅ ..." or "3. ⬜ ..."
      const numberedMatch = trimmed.match(/^(\s*)(\d+)\.\s*(✅|⬜|⏭️)/);
      if (numberedMatch) {
        const stepNum = parseInt(numberedMatch[2], 10);
        if (stepNum === target.step) {
          targetLineIdx = i;
          // Replace the marker in the line
          const oldMarker = numberedMatch[3] as '✅' | '⬜' | '⏭️';
          if (oldMarker !== marker) {
            lines[i] = lines[i].replace(numberedMatch[3], marker);
            markerFlipped = true;
          }
          break;
        }
        stepCount++;
        continue;
      }

      // Bullet steps: "- ✅ ..." or "- ⬜ ..."
      const bulletMatch = trimmed.match(/^(\s*-\s*)(✅|⬜|⏭️)/);
      if (bulletMatch) {
        stepCount++;
        if (stepCount === target.step) {
          targetLineIdx = i;
          const oldMarker = bulletMatch[2] as '✅' | '⬜' | '⏭️';
          if (oldMarker !== marker) {
            lines[i] = lines[i].replace(bulletMatch[2], marker);
            markerFlipped = true;
          }
          break;
        }
        continue;
      }

      // Checkbox steps: "3. [x] ..." or "3. [ ] ..."
      const numberedCheckbox = trimmed.match(/^(\s*)(\d+)\.\s+`?\[(x| )\]`?/);
      if (numberedCheckbox) {
        const stepNum = parseInt(numberedCheckbox[2], 10);
        if (stepNum === target.step) {
          targetLineIdx = i;
          // Replace checkbox: [x] ↔ [ ]
          const current = numberedCheckbox[3];
          if (marker === '✅' && current !== 'x') {
            lines[i] = lines[i].replace('[ ]', '[x]').replace('`[ ]`', '`[x]`');
            markerFlipped = true;
          } else if (marker === '⬜' && current !== ' ') {
            lines[i] = lines[i].replace('[x]', '[ ]').replace('`[x]`', '`[ ]`');
            markerFlipped = true;
          }
          break;
        }
        stepCount++;
        continue;
      }

      // Bullet checkboxes: "- [x] ..." or "- [ ] ..."
      const bulletCheckbox = trimmed.match(/^(\s*-\s+)\[(x| )\]/);
      if (bulletCheckbox) {
        stepCount++;
        if (stepCount === target.step) {
          targetLineIdx = i;
          const current = bulletCheckbox[2];
          if (marker === '✅' && current !== 'x') {
            lines[i] = lines[i].replace('[ ]', '[x]');
            markerFlipped = true;
          } else if (marker === '⬜' && current !== ' ') {
            lines[i] = lines[i].replace('[x]', '[ ]');
            markerFlipped = true;
          }
          break;
        }
        continue;
      }
    }
  }

  if (targetLineIdx === -1) {
    throw new Error(
      `Could not find ${target.step ? `step ${target.step} in ` : ''}phase ${target.phase} in ${filePath}`,
    );
  }

  const newContent = lines.join('\n');

  // Write if content changed (marker flip or emoji normalization)
  if (newContent !== original) {
    await writeFile(filePath, newContent, 'utf-8');
  }

  return {
    changed: markerFlipped,
    line: targetLineIdx + 1, // 1-indexed
    file: filePath,
  };
}