# auth-system - Master Plan

**Status**: In Progress
**Created**: 2026-02-15
**Last Updated**: 2026-03-20

---

## Executive Summary

Multi-provider authentication with OAuth2 and JWT token management for the API server.

---

## Implementation Order

### Phase 1: Provider Setup

1. ✅ Create OAuth provider registry
2. ✅ Implement Google OAuth adapter
3. ✅ Implement GitHub OAuth adapter
4. ✅ Add provider configuration validation
5. ✅ Write provider integration tests

**Verification**:
- [x] All providers return valid tokens
- [x] Invalid credentials rejected

⏸️ **GATE**: Phase 1 complete. Continue or `/dev-checkpoint`.

### Phase 2: Token Management

1. ✅ Define token payload schema
2. ✅ Implement JWT signing
3. ✅ Implement JWT verification
4. ⬜ Add refresh token rotation
5. ⬜ Add token revocation list

**Verification**:
- [ ] Tokens validate correctly
- [ ] Refresh rotation works

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 3: Session Management

1. ⬜ Implement session creation
2. ⬜ Add session storage
3. ⬜ Implement session cleanup

⏸️ **GATE**: Phase complete or `/dev-checkpoint`.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/auth/providers.ts` | Provider registry |
| `src/auth/token-service.ts` | JWT signing and verification |

---

## Reference Files

- `src/auth/providers.ts` — Provider registry
- `src/auth/token-service.ts` — Token management