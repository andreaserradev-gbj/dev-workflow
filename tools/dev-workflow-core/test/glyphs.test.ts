import { describe, it, expect } from 'vitest';
import {
  PENDING_GLYPH,
  RESOLVED_GLYPHS,
  EXPECTED_GLYPHS_TEXT,
  classifyStepGlyph,
  matchNumberedStepLine,
  matchBulletStepLine,
  firstGlyphInCell,
} from '../src/glyphs.js';

describe('classifyStepGlyph', () => {
  it('classifies the pending glyph', () => {
    expect(classifyStepGlyph('⬜')).toBe('pending');
  });

  it.each([...RESOLVED_GLYPHS])('classifies %s as resolved', (glyph) => {
    expect(classifyStepGlyph(glyph)).toBe('resolved');
  });

  // The defect this whole module exists to fix: these used to be invisible
  // rather than unknown, dropping out of numerator AND denominator.
  it.each(['⚠️', '❌', '🚧', '🔴', '❓', '🎯'])('classifies %s as unknown', (glyph) => {
    expect(classifyStepGlyph(glyph)).toBe('unknown');
  });

  it('treats an empty string as unknown rather than throwing', () => {
    expect(classifyStepGlyph('')).toBe('unknown');
  });

  it('treats prose as unknown', () => {
    expect(classifyStepGlyph('Done')).toBe('unknown');
  });
});

describe('classifyStepGlyph — variation selectors', () => {
  // `⏭️` is U+23ED U+FE0F. Authors, editors and copy-paste all produce the
  // bare U+23ED form too; both mean the same marker.
  it('accepts ⏭ with and without VS16', () => {
    expect('⏭️').toBe('⏭️'); // guards the test's own literal
    expect(classifyStepGlyph('⏭️')).toBe('resolved');
    expect(classifyStepGlyph('⏭')).toBe('resolved');
  });

  it('accepts ⏹ with and without VS16', () => {
    expect(classifyStepGlyph('⏹️')).toBe('resolved');
    expect(classifyStepGlyph('⏹')).toBe('resolved');
  });

  it('accepts a VS16-decorated pending glyph', () => {
    expect(classifyStepGlyph('⬜️')).toBe('pending');
  });

  it('does not let VS16 stripping collapse distinct glyphs', () => {
    expect(classifyStepGlyph('⚠️')).toBe('unknown'); // ⚠️ stays unknown
  });
});

describe('EXPECTED_GLYPHS_TEXT', () => {
  // The message string is claimed to be the single source for warnings and
  // errors; if it drifts from the actual accepted set, every message lies.
  it('lists exactly the glyphs the classifier accepts', () => {
    expect(EXPECTED_GLYPHS_TEXT.split(' ')).toEqual([PENDING_GLYPH, ...RESOLVED_GLYPHS]);
  });

  it('lists only glyphs that classify as known', () => {
    for (const glyph of EXPECTED_GLYPHS_TEXT.split(' ')) {
      expect(classifyStepGlyph(glyph)).not.toBe('unknown');
    }
  });
});

describe('matchNumberedStepLine', () => {
  it('matches a numbered step and returns its ordinal and marker', () => {
    expect(matchNumberedStepLine('1. ✅ Create the module')).toEqual({ number: 1, marker: '✅' });
  });

  it('matches multi-digit ordinals', () => {
    expect(matchNumberedStepLine('12. ⬜ Later step')).toEqual({ number: 12, marker: '⬜' });
  });

  it('tolerates leading whitespace so parser and writer share one predicate', () => {
    // parser.ts trims before matching; writer.ts only trims the end.
    expect(matchNumberedStepLine('   3. ⬜ Indented')).toEqual({ number: 3, marker: '⬜' });
  });

  it('captures a multi-code-point marker whole', () => {
    expect(matchNumberedStepLine('4. ⏭️ Skipped')?.marker).toBe('⏭️');
  });

  // The point of separating step-ness from status: an unknown glyph is still a
  // step, so it still reaches the caller and still counts.
  it('matches a step carrying an unknown glyph', () => {
    expect(matchNumberedStepLine('5. ⚠️ Written, unverifiable')).toEqual({
      number: 5,
      marker: '⚠️',
    });
  });
});

describe('matchBulletStepLine', () => {
  it('matches a bullet step', () => {
    expect(matchBulletStepLine('- ✅ Did the thing')).toEqual({ marker: '✅' });
  });

  it('tolerates leading whitespace', () => {
    expect(matchBulletStepLine('  - ⬜ Nested')).toEqual({ marker: '⬜' });
  });

  it('matches a bullet carrying an unknown glyph', () => {
    expect(matchBulletStepLine('- ⚠️ Unverifiable')).toEqual({ marker: '⚠️' });
  });

  it('requires a space after the dash', () => {
    // The old parser required it, the old writer did not. That disagreement is
    // exactly the positional-drift hazard; the stricter form is canonical.
    expect(matchBulletStepLine('-✅ no space')).toBeNull();
  });
});

// ─── Denominator inflation guard ──────────────────────────────────────
//
// HIGHEST-RISK regression for this feature. If the marker slot accepted any
// leading token rather than specifically an emoji, every numbered sentence and
// every plain bullet inside a phase section would become a "step", inflating
// `total` across every existing PRD in every project. These cases are the
// guard rail — a failure here is a corrupted denominator, not a style nit.
describe('prose is not a step', () => {
  const prose = [
    '1. Do the thing',
    '1. [x] checkbox',
    '1. `[x]` backticked checkbox',
    '1. [ ] unchecked',
    '2. **Bold prose** about the design',
    '10. See the sub-PRD for details',
    '1. "quoted opener"',
    '1. 1️⃣ leading digit is not pictographic',
  ];

  it.each(prose)('rejects %s as a numbered step', (line) => {
    expect(matchNumberedStepLine(line)).toBeNull();
  });

  const bulletProse = [
    '- a plain note',
    '- [x] checkbox',
    '- [ ] unchecked',
    '- **Goal**: ship it',
    '- `code` reference',
    '- See [sub-prd-01](./01-sub-prd.md)',
  ];

  it.each(bulletProse)('rejects %s as a bullet step', (line) => {
    expect(matchBulletStepLine(line)).toBeNull();
  });

  it('does not treat a heading as a step', () => {
    expect(matchNumberedStepLine('### Phase 1: Title')).toBeNull();
    expect(matchBulletStepLine('### Phase 1: Title')).toBeNull();
  });

  it('does not treat an empty line as a step', () => {
    expect(matchNumberedStepLine('')).toBeNull();
    expect(matchBulletStepLine('')).toBeNull();
  });

  it('does not match an emoji that is not in the marker slot', () => {
    expect(matchNumberedStepLine('1. Ship it ✅')).toBeNull();
    expect(matchBulletStepLine('- ship it ✅')).toBeNull();
  });
});

describe('firstGlyphInCell', () => {
  it('extracts the leading glyph', () => {
    expect(firstGlyphInCell(' ✅ Done ')).toBe('✅');
  });

  it('extracts a multi-code-point glyph whole', () => {
    expect(firstGlyphInCell(' ⏭️ Skipped ')).toBe('⏭️');
  });

  it('extracts an unknown glyph rather than discarding the row', () => {
    expect(firstGlyphInCell(' ⚠️ Written, unverifiable ')).toBe('⚠️');
  });

  it('returns empty string for an empty cell', () => {
    expect(firstGlyphInCell('')).toBe('');
    expect(firstGlyphInCell('   ')).toBe('');
  });

  it('returns empty string for a prose-only cell', () => {
    // In a table the row's shape already proves it is a step, so this is an
    // unknown status — not a non-step. The caller must still count it.
    expect(firstGlyphInCell(' Done ')).toBe('');
    expect(classifyStepGlyph(firstGlyphInCell(' Done '))).toBe('unknown');
  });

  it('ignores an emoji that is not at the start of the cell', () => {
    expect(firstGlyphInCell(' Done ✅ ')).toBe('');
  });
});
