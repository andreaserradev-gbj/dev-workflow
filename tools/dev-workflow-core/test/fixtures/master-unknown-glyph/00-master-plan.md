# Master Unknown Glyph - Master Plan

**Status**: In Progress
**Created**: 2026-07-20
**Last Updated**: 2026-07-21

---

## Executive Summary

The master-plan inline form of the unknown-glyph defect, loaded with prose
decoys. The decoys are the point: recognising a step by "leading token exists"
rather than "leading token is an emoji" would sweep every numbered sentence and
plain bullet below into `total`, corrupting the denominator of every PRD in
every project. Phase 1 must count exactly three steps.

---

## Implementation Order

### Phase 1: Recognition

Context prose that happens to sit above the steps.

1. ✅ Real step one
2. ⬜ Real step two
3. ⚠️ Written but unverifiable

Notes that resemble steps but are not:

4. This numbered line is prose, not a step
5. `code` reference, still prose
6. Ship it ✅
- a plain bullet note
- **Bold** bullet note
- See [the sub-PRD](./01-sub-prd-decoys.md)

**Verification**:
- [ ] Decoys above are not counted

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 2: Clean

1. ⬜ Nothing unusual here

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.
