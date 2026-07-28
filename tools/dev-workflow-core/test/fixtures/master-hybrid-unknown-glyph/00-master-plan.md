# Hybrid Unknown Glyph - Master Plan

**Status**: In Progress
**Created**: 2026-07-10
**Last Updated**: 2026-07-12

---

## Executive Summary

The redundant-hybrid shape — master plan owns the phases and carries its own
inline-step progress, while the sub-PRD keeps a stale duplicate table — where
every row of that duplicate table carries an unknown glyph.

Second-order effect of the whitelist defect: with all rows invisible the
sub-PRD's `total` was 0, so the `countsAuthoritative: false` suppression in
buildFeatureDetail (guarded on `r.total > 0`) never engaged, and the dead
counter rendered as a live one. Fixing step recognition fixes this too.

---

## Sub-PRD Overview

| Sub-PRD | Title | Dependency | Status | Document |
|---------|-------|------------|--------|----------|
| **01** | Foundation | None | Complete | [01-sub-prd-foundation.md](./01-sub-prd-foundation.md) |

---

## Implementation Order

### Phase 0: Foundation — scaffold, data layer

1. ✅ Scaffold the app
2. ✅ Wire the data layer

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 1: Core — service, controller

1. ⬜ Service layer
2. ⬜ Controller + wiring

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.
