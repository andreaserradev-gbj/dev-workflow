# Master Blocked Deferred Steps - Master Plan

**Status**: In Progress
**Created**: 2026-07-22
**Last Updated**: 2026-07-28

---

## Executive Summary

The write-path half of the glyph whitelist defect, in its latent form. `⛔` and
`⏹️` steps have always been countable by the parser and UNWRITABLE by the
writer, whose local regex knew only `✅ ⬜ ⏭️`.

For numbered steps that produced a bogus "phase not found" for a step plainly
present in the file. For bullet steps — which the writer targets by POSITION —
it was worse and silent: skipping the `⛔` and `⏹️` bullets made the writer's
Nth bullet a different line from the parser's Nth bullet, so `--step 2` landed
on the fourth bullet and rewrote it.

Phase 1 must count 4 numbered steps (3 resolved); Phase 2 must count 4 bullet
steps (3 resolved). If either count moves, the predicates have drifted.

---

## Implementation Order

### Phase 1: Numbered steps the writer could not reach

1. ✅ Ordinary done step
2. ⛔ Dropped — the writer refused this before the fix
3. ⏹️ Deferred — likewise
4. ⬜ Ordinary pending step

**Verification**:
- [ ] Steps 2 and 3 are writable

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 2: Bullet steps, where the drift bites

- ✅ First bullet
- ⛔ Second bullet, dropped
- ⏹️ Third bullet, deferred
- ⬜ Fourth bullet, pending

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.
