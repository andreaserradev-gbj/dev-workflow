## Session 1 — 2026-02-15T10:00:00.000Z

<context>
Starting auth system. Setting up OAuth provider registry.
</context>

<decisions>
- Use OAuth2 for all providers
- JSON Web Tokens for session management
</decisions>

<notes>
- PKCE needed for mobile
</notes>

---

## Session 2 — 2026-03-01T14:00:00.000Z

<context>
Phase 1 wrapping up. All providers implemented and tested.
</context>

<decisions>
- RS256 over HS256 for JWT signing
</decisions>

<blockers>
- Rate limiting not yet configured
</blockers>

---

## Session 3 — 2026-03-20T10:00:00.000Z

<context>
Token signing and verification done. Moving to refresh tokens.
</context>

<decisions>
- Redis for refresh token storage
</decisions>

<blockers>
- Redis connection pooling needs config
</blockers>

<notes>
- Watch for clock skew on JWT expiry
</notes>

---