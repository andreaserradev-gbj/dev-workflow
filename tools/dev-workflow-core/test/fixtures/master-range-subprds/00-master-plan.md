# Ranged Ports - Master Plan

**Status**: In Progress
**Created**: 2026-07-01
**Last Updated**: 2026-07-06

---

## Executive Summary

A feature whose Implementation Order collapses several near-identical phases into
one range header and delegates the real steps to numbered `NN-<slug>.md` sub-PRDs.

---

## Sub-PRD Overview

| Sub-PRD | Title | Dependency | Status | Document |
|---------|-------|------------|--------|----------|
| **01** | Alpha | None | Complete | [01-alpha.md](./01-alpha.md) |
| **02** | Beta | 01 | Not Started | [02-beta.md](./02-beta.md) |
| **03** | Gamma | 01 | Not Started | [03-gamma.md](./03-gamma.md) |
| **04** | Delta | 01 | Not Started | [04-delta.md](./04-delta.md) |

---

## Implementation Order

### Phase 0: Alpha → [01](./01-alpha.md)
**Goal**: Scaffold, with a couple of inline steps in the master plan itself.

1. ✅ Bootstrap the thing
2. ✅ Prove it builds

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phases 1–2: Ranged ports (collapsed, steps live in the sub-PRDs)
Each follows the standard increment; acceptance criteria live in the sub-PRD.

⏸️ **GATE**.

### Phase 3: Delta → [04](./04-delta.md)
**Goal**: Final delegated phase, no inline steps.

⏸️ **GATE**.
