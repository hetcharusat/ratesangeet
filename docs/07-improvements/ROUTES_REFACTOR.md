# Server Routes Refactor Summary

## Goal
Unify response shapes, introduce a versioned envelope, improve caching clarity, and prepare for client migration without breaking existing consumers.

## Envelope Format (Transitional Phase A)
```jsonc
{
  "success": true,
  "data": { /* primary payload */ },
  "cache": { /* optional CacheMetadata */ },
  "refreshedToken": "<string?>",
  // Legacy duplication: top-level copies of data fields (removed in Phase C)
}
```

Errors:
```jsonc
{
  "success": false,
  "error": "message",
  "details": { /* optional debug info */ }
}
```

## Version Header
All responses include:
```
X-API-Envelope: transitional-v1
```
Upcoming: `stable-v1` (after removal of legacy duplication).

## Helper Functions
| Helper | Description |
|--------|-------------|
| `transitionalSuccess(res, payload, opts)` | Dual format (envelope + legacy root fields) |
| `success(res, data)` | Minimal success envelope |
| `cachedSuccess(res, data, cache, token?)` | Success with cache metadata |
| `error(res, msg, status, details?)` | Unified error envelope |

## Refactored Routes
| Area | Status | Notes |
|------|--------|-------|
| Auth | Complete | /login, /callback, /pkce-login, /refresh, /pkce-refresh, /search-users |
| Music | Complete | search, recently-played, currently-playing, scrobble (sync-recent next iteration) |
| Reviews | Partial | Object responses wrapped; list endpoints remain arrays (Phase B conversion) |
| Users | Complete | profile, search, feed, followers, following, mutual-followers |
| Discover | Cached envelope already (no transitional wrapper needed) |
| Home / Refresh | Already using cache-aware shapes |
| Health | Wrapped for consistency |

## OpenAPI Updates
- Added `Envelope` schema (previous commit) and now applying `allOf` pattern to major endpoints.
- Added header documentation `X-API-Envelope` for key endpoints.
- Introduced `ErrorEnvelope` schema for standardized failures.

## Client Migration Plan
1. Phase A (current): Read legacy fields OR `data.*`.
2. Phase B: Update clients to rely solely on `data.*`.
3. Phase C: Remove legacy duplication; switch `transitionalSuccess` -> `success`/`cachedSuccess`.

## Remaining Considerations
- Convert remaining pure-array responses (e.g., public reviews list) to envelope in a guarded release.
- Add `X-Cache-Status` header for HIT/MISS/BYPASS instrumentation.
- Expand error schema with `code` and `retryable` attributes.
- Add pagination metadata inside `data.meta` for large lists.

## Changelog
2025-11-11: Initial refactor summary added.

---
For future enhancements open an issue labeled `routes-refactor`.
