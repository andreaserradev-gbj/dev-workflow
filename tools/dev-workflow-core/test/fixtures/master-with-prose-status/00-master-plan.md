# cold-load-optimization — Master Plan

**Status**: Phase 1 DONE. Sub-PRDs 2/3 not yet started.
**Created**: 2026-05-13
**Last Updated**: 2026-05-21

---

## Executive Summary

Master plan whose Phase 1/2/3 bodies are pure pointers to sub-PRDs; status recorded as a leading prose line.

---

## Implementation Order

### Phase 0: Branch setup

**Goal**: Repos on a fresh feature branch.

1. ✅ Create branch in repo A
2. ✅ Create branch in repo B
3. ✅ Confirm clean working tree

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 1: Execute sub-PRD 1 — `Project.load`

See [01-sub-prd-project-load.md](./01-sub-prd-project-load.md).

✅ **DONE** (2026-05-21): all three tracks shipped end-to-end.

---

### Phase 2: Execute sub-PRD 2 — Thumbnail tax

See [02-sub-prd-thumbnail.md](./02-sub-prd-thumbnail.md).

❌ **DROPPED**: superseded by Phase 1's selective-load win.

---

### Phase 3: Execute sub-PRD 3 — Fan-out cache

See [03-sub-prd-fanout.md](./03-sub-prd-fanout.md).

⬜ **NOT STARTED**

---

### Phase 4: Cleanup

⬜ **IN PROGRESS** — partial work landed last session.

⏸️ **GATE**: Phase complete or `/dev-checkpoint`.
