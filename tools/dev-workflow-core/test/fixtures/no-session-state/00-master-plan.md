# rate-limiting - Master Plan

**Status**: In Progress
**Created**: 2026-03-10
**Last Updated**: 2026-03-18

---

## Executive Summary

Token bucket rate limiter for API endpoints with per-user and per-route limits.

---

## Implementation Order

### Phase 1: Core Limiter
**Goal**: In-memory token bucket implementation.

1. ✅ Define rate limit config schema
2. ✅ Implement token bucket algorithm
3. ⬜ Add sliding window counter
4. ⬜ Write unit tests

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 2: Redis Backend
**Goal**: Distributed rate limiting with Redis.

1. ⬜ Redis adapter for token bucket state
2. ⬜ Cluster-safe atomic operations
3. ⬜ Fallback to in-memory on Redis failure

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.
