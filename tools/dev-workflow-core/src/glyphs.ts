/**
 * Step recognition — the single owner of "is this line a step, and what is its
 * status glyph".
 *
 * ## Why this module exists
 *
 * The parser and the writer used to answer both questions with the same
 * expression: a whitelist of known status glyphs. That conflates two
 * independent questions:
 *
 *   1. **Is this a step?**  — structure: a step ID plus the cell/list layout.
 *   2. **What is its status?** — the glyph sitting in the marker slot.
 *
 * Whitelisting on the glyph makes a row with any *other* glyph invisible
 * rather than unknown. On the read path it vanishes from BOTH numerator and
 * denominator, so a 10-step sub-PRD carrying one `⚠️` reports `9/9 complete`
 * — silently, and wrongly. On the write path `status-update` matches the row
 * by step number, then refuses it and reports `Phase N not found`, naming the
 * wrong layer entirely.
 *
 * Here the two questions are separate: the predicates below decide *step-ness*
 * from structure and hand back whatever glyph occupies the marker slot;
 * {@link classifyStepGlyph} then judges that glyph, and may answer `unknown`.
 *
 * ## The invariant
 *
 * **Parser and writer must both route through these predicates.**
 *
 * This is not a style preference. `writer.ts` locates a bullet step
 * *positionally* — it walks the phase section counting bullet steps until the
 * count equals the target step number — while `parser.ts` walks the same
 * section counting bullet steps to produce `total`. The two counts are only
 * comparable if both walks recognise exactly the same set of lines. Let the
 * matchers drift and the writer's Nth bullet is not the parser's Nth bullet:
 * the writer then rewrites the *wrong line*, corrupting a PRD with no error
 * and no diff anyone is looking at.
 *
 * So: no local step regex anywhere else. If a call site needs to recognise a
 * step, it calls into this module.
 *
 * ## Deliberately out of scope
 *
 * `parser.ts`'s inline prose-status matcher (`extractInlineStatusMarker`)
 * answers a *different* question — "does this phase delegate to a sub-PRD, and
 * what does its prose status line say" — and keeps its own glyph set,
 * including `❌`, which is not a step marker. It is not a step predicate and
 * must not be folded in here.
 */

/** The one glyph meaning "not yet done". */
export const PENDING_GLYPH = '⬜';

/**
 * Glyphs meaning "this step will not change again": done, skipped, dropped,
 * deferred. All count toward the numerator — a dropped step is resolved, not
 * outstanding.
 */
export const RESOLVED_GLYPHS = ['✅', '⏭️', '⛔', '⏹️'] as const;

/**
 * Human-readable glyph list for warnings and error messages. Single source, so
 * a message can never drift out of sync with what the code actually accepts.
 */
export const EXPECTED_GLYPHS_TEXT = '⬜ ✅ ⏭️ ⛔ ⏹️';

export type StepGlyphClass = 'pending' | 'resolved' | 'unknown';

/**
 * Emoji token: one pictographic code point plus any trailing variation
 * selectors, ZWJs and continuation pictographs. Required because several
 * markers are multi-code-point — `⏭️` is U+23ED U+FE0F, not a single char —
 * so a naive `.` or single-char class truncates them.
 *
 * Kept as a source string rather than a RegExp so both predicates below build
 * from the same definition; a `u`-flagged regex is required for the
 * `\p{...}` escapes.
 */
const EMOJI_TOKEN = String.raw`\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*`;

/**
 * Numbered step: `3. ✅ …`, `  10. ⬜ …`.
 *
 * Leading whitespace is tolerated so the same predicate serves the parser
 * (which trims first) and the writer (which does not).
 */
const NUMBERED_STEP_RE = new RegExp(String.raw`^\s*(\d+)\.\s*(${EMOJI_TOKEN})`, 'u');

/**
 * Bullet step: `- ✅ …`, `  - ⬜ …`.
 *
 * The space after `-` is **required**. The old parser required it and the old
 * writer did not, which is precisely the drift this module exists to prevent;
 * the stricter form wins because `-✅` is not a valid Markdown list item and
 * the parser never counted it, so a writer that could target it was already
 * addressing a line outside the parser's numbering.
 */
const BULLET_STEP_RE = new RegExp(String.raw`^\s*-\s+(${EMOJI_TOKEN})`, 'u');

/** Leading emoji token of a Markdown table cell. */
const CELL_GLYPH_RE = new RegExp(String.raw`^(${EMOJI_TOKEN})`, 'u');

/** Variation selector-16 — presentation-only, never meaning-bearing. */
const VARIATION_SELECTOR_16 = /️/g;

/**
 * Compare glyphs by meaning, not by byte sequence: `⏭` and `⏭️` are the same
 * marker, and authors (and editors, and copy-paste) produce both.
 */
function canonical(glyph: string): string {
  return glyph.replace(VARIATION_SELECTOR_16, '');
}

const CANONICAL_RESOLVED: readonly string[] = RESOLVED_GLYPHS.map(canonical);
const CANONICAL_PENDING = canonical(PENDING_GLYPH);

/**
 * Judge a status glyph. Returns `unknown` for anything outside the known set,
 * including the empty string — callers decide what to do with that, and the
 * two paths deliberately decide differently:
 *
 * - **Read path counts it.** An unknown glyph is still a step; dropping it
 *   corrupts the denominator, which is the bug.
 * - **Write path refuses it.** The writer rewrites the entire status cell, so
 *   flipping `⚠️ Written, unverifiable` to `✅ Done` would destroy the note
 *   text, not merely the glyph.
 */
export function classifyStepGlyph(glyph: string): StepGlyphClass {
  const c = canonical(glyph);
  if (c === CANONICAL_PENDING) return 'pending';
  if (CANONICAL_RESOLVED.includes(c)) return 'resolved';
  return 'unknown';
}

export interface NumberedStepMatch {
  /** The step's ordinal as written — `3` in `3. ✅ …`. */
  number: number;
  /** Whatever emoji token occupies the marker slot, known or not. */
  marker: string;
}

export interface BulletStepMatch {
  /** Whatever emoji token occupies the marker slot, known or not. */
  marker: string;
}

/**
 * Recognise a numbered step line, or return `null`.
 *
 * The marker slot must hold an **emoji token**. That requirement is what keeps
 * ordinary prose out of the denominator: `1. Do the thing` and
 * `1. [x] checkbox` are not steps by this predicate, and must never become
 * ones — a permissive rule here would silently reclassify every numbered
 * sentence in every phase section of every PRD as a step.
 */
export function matchNumberedStepLine(line: string): NumberedStepMatch | null {
  const m = line.match(NUMBERED_STEP_RE);
  if (!m) return null;
  return { number: parseInt(m[1], 10), marker: m[2] };
}

/**
 * Recognise a bullet step line, or return `null`. Same emoji-token
 * requirement, and for the same reason, as {@link matchNumberedStepLine}.
 */
export function matchBulletStepLine(line: string): BulletStepMatch | null {
  const m = line.match(BULLET_STEP_RE);
  if (!m) return null;
  return { marker: m[1] };
}

/**
 * Leading glyph of a sub-PRD table's status cell, or `''` when the cell is
 * empty or opens with something that is not an emoji.
 *
 * Unlike the inline forms, the table form does **not** use the glyph to decide
 * step-ness: the row's shape — a step ID cell plus the column layout — already
 * proves it is a step, so an empty or prose-only status cell is an unknown
 * status, not a non-step. Inline has no such structural proof, which is why
 * the two forms are asymmetric.
 */
export function firstGlyphInCell(cell: string): string {
  const m = cell.trim().match(CELL_GLYPH_RE);
  return m ? m[1] : '';
}
