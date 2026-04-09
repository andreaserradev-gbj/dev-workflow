# Sub-PRD: Token Management

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: In Progress
**Last Updated**: 2026-03-20

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Define token payload schema | ✅ Complete |
| **2** | Implement JWT signing | ✅ Complete |
| **3** | Implement JWT verification | ✅ Complete |
| **4** | Add refresh token rotation | ⬜ Not Started |
| **5** | Add token revocation list | ⬜ Not Started |

---

## Implementation Steps

### Step 1: Define token payload schema
Define the JWT payload with user ID, roles, and expiry fields.

### Step 2: Implement JWT signing
RS256 signing with configurable key pairs and rotation support.

### Step 3: Implement JWT verification
Verify signature, check expiry, and validate required claims.

### Step 4: Add refresh token rotation
Sliding window refresh with Redis-backed storage and TTL.

### Step 5: Add token revocation list
Redis SET-based revocation list checked on each verification call.
