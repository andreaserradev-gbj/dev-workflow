# Sub-PRD: Foundation

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: In Progress
**Last Updated**: 2026-07-21

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Recognized-glyph row | ✅ Done |
| **2** | Unrecognized-glyph row | ⚠️ Written, unverifiable |

---

## Goal

Step 2's `⚠️` is deliberately outside the known marker set. It must still count
toward `total`, must never count toward `done`, and must produce exactly one
warning naming the file, the step, and the glyph.

This is the exact state `.dev/bugs.md` reproduces after its case A: two steps,
one incomplete, which the old parser reported as `1/1` — 100% complete. The fix
makes it `1/2`, in progress.
