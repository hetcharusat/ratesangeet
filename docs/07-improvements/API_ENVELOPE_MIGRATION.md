# API Envelope Migration Strategy

## Overview
We are migrating all API responses to a unified envelope format:

```jsonc
{
  "success": true | false,
  "data": {},          // present when success=true
  "error": "string",  // present when success=false
  "cache": {           // optional cache metadata
    "source": "spotify|database|cache|hybrid",
    "cachedAt": "ISO",
    "expiresAt": "ISO",
    "isFresh": true
  },
  "refreshedToken": "<new access token>", // optional (Spotify token rotation)
  // Transitional duplication of legacy top-level fields (Phase A only)
}
```

## Phases
| Phase | Description | Implementation | Client Impact |
|-------|-------------|----------------|---------------|
| A (current) | Introduce `transitionalSuccess` wrapper that returns envelope AND duplicates legacy payload fields at root | `transitionalSuccess(res, payload, { cache, refreshedToken })` | No breaking changes; clients can continue reading top-level fields |
| B | Clients switch to reading `data.*` exclusively | Communication + gradual mobile/web refactor | None (after switch) |
| C | Remove duplication, replace all transitional calls with `success` / `cachedSuccess` | Swap helpers; delete duplication logic | Clients MUST be on `data.*` |

## Header Contract
All responses now include:

```
X-API-Envelope: transitional-v1
```

This header signals the **envelope version**. Planned future values:
- `stable-v1` (after Phase C)
- `stable-v2` (future structural changes)

## Helper Functions

| Helper | Purpose | Use When |
|--------|---------|----------|
| `transitionalSuccess(res, payload, opts)` | Dual-shape response (envelope + legacy) | Phase A only |
| `success(res, data)` | Simple success envelope | Cache not needed |
| `cachedSuccess(res, data, cache, refreshedToken?)` | Success + cache metadata (+ optional token) | Cached endpoints |
| `error(res, message, status, details?)` | Unified error envelope | All failures |

## Updated Endpoints (Phase A Applied)
| Group | Status |
|-------|--------|
| Music (`/api/music/*`) | Completed (search, recently-played, currently-playing, scrobble) |
| Auth (`/api/auth/*`) | Completed |
| Reviews (`/api/reviews/*`) | Completed |
| Users (`/api/users/*`) | Completed |
| Discover (`/api/discover`) | Pending (already uses `cachedSuccess`—transitional not required) |
| Home/Refresh | Already envelope-based |
| Health | Plain legacy (can remain minimal) |

## OpenAPI Changes
- Added `Envelope` schema referencing `CacheMetadata`.
- Music endpoints now use `allOf: [Envelope, { properties: { data: ... } }]` pattern.
- Added `X-API-Envelope` header documentation to music endpoints.

## Migration Guidelines for Clients
1. Detect envelope header: `X-API-Envelope`.
2. Prefer reading `response.data` for structured payloads.
3. Fallback to legacy top-level fields only during Phase A.
4. Treat `cache` and `refreshedToken` as optional.
5. For errors: check `success === false` then read `error` + optional `details`.

## Removal Criteria for Transitional Mode
Transitional duplication is removed when:
- Mobile app release uses only `data.*` parsing.
- Web client (if any) updated.
- No analytics events show legacy field access (optional instrumentation).
- OpenAPI clients regenerated confirming `data` usage.

## Future Considerations
- Add `meta` for pagination or rate-limit info inside `data`.
- Expand error shape with `code`, `retryable`, `traceId`.
- Introduce `X-Cache-Status: HIT|MISS|BYPASS|FORCED` header (optional optimization).

## FAQ
Q: Why duplicate fields now?  
A: To avoid breaking existing mobile clients until they safely migrate to the envelope.

Q: Will errors also duplicate legacy fields?  
A: No—errors are already simple and consistent; legacy duplication is only for success payloads.

Q: How do I detect a token refresh?  
A: Check for `refreshedToken` at the top-level or inside the envelope. Use new token immediately.

Q: Which endpoints return `cache`?  
A: Endpoints using caching strategies (`search`, `recently-played`, `home` snapshot, `discover`, etc.).

## Action Items Remaining
- Convert discover route to `transitionalSuccess` (optional; already structured via `cachedSuccess`).
- Add header + envelope schema usage to non-music endpoints in OpenAPI (optional for completeness).
- Instrument client analytics for envelope adoption (future task).

## Changelog
2025-11-11: Initial document created. Envelope schema + music endpoint examples updated. Header injected globally.

---
For questions or follow-up improvements, open an issue titled `envelope-migration`.