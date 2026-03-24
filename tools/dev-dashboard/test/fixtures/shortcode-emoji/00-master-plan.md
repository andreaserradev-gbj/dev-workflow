# Port readBy Fix — Master Plan

**Status**: Complete
**Created**: 2026-03-12
**Last Updated**: 2026-03-12

---

## Executive Summary

Port the bmpr PR #248 fix: stop hardcoding readBy in setCommentData.

---

## Implementation Order

### Phase 1: Remove readBy reset and add regression test

**Goal**: Stop setCommentData from overwriting readBy, add a test.

1. :white_check_mark: Delete the readBy reset line from SQLite implementation
2. :white_check_mark: Delete the readBy reset block from AO implementation
3. :white_check_mark: Add regression test asserting readBy preservation

**Verification**:
- [x] SQLite impl no longer references readBy
- [x] AO impl no longer references readBy
- [x] New test passes
