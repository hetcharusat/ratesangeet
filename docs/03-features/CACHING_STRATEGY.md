# Listening Stats Caching Strategy (2025-11)

## Overview
The `/music/listening-stats` endpoint now uses a lightweight, correctness‑aware in‑memory cache to keep the Home/Dashboard feeling instant while preventing stale data for highly active listeners.

## Goals
- Sub‑second repeat loads inside a short window
- Always reflect newly scrobbled tracks without waiting for TTL expiry
- Allow user‑initiated hard refresh (pull‑to‑refresh) to bypass cache
- Provide introspection for debugging (cache metadata in response + headers)

## Mechanism
1. **Entry Structure**: `{ data, timestamp, lastScrobblePlayedAt }`
2. **TTL**: 15 seconds (`STATS_CACHE_TTL = 15_000`). Very short to avoid stale dashboards.
3. **Freshness Check**: Before serving a cached entry we query only the most recent scrobble (`findOne().sort({ playedAt: -1 }).select('playedAt')`). If that `playedAt` is newer than the cached `lastScrobblePlayedAt`, the cache is considered stale and rebuilt immediately.
4. **Force Bypass**: `?force=1` skips cache usage regardless of age or freshness.
5. **Response Metadata**: Server appends a `cache` object and headers:  
   - Headers: `X-Cache: HIT|MISS`, `X-Cache-Age: <ms>`  
   - Body: `cache: { hit, ageMs, generatedAt, lastScrobblePlayedAt, forced }`

## Algorithm (Simplified Flow)
```
latest = queryLatestScrobblePlayedAt(user)
cached = statsCache.get(key)
if force:
  rebuild()
else if cached and (now - cached.timestamp < TTL) and latest <= cached.lastScrobblePlayedAt:
  return cached (HIT)
else:
  rebuild()
```

## Benefits
- **Low Latency**: Subsequent loads within 15s hit memory only.
- **Correctness**: New scrobble invalidates cache instantly; listeners see updated counts.
- **Observability**: Metadata lets us diagnose user reports of stale data (“ageMs”, “forced”).
- **Simplicity**: Pure in‑process map (acceptable for single instance Render free tier). Easy to evolve to Redis later.

## Client Integration
- Home screen pull‑to‑refresh calls `getListeningStats(..., { force: true })` to guarantee freshness.
- UI shows a small line: `Cached · Updated HH:MM:SS` or `Fresh · Updated ... (forced)` depending on metadata.

## Edge Cases & Handling
| Scenario | Outcome |
|----------|---------|
| Rapid scrobbles (<15s apart) | Freshness check busts cache immediately. |
| No scrobbles yet | `latestPlayedAtMs` undefined → treat cache as fresh until first scrobble arrives. |
| Clock skew / invalid date | Graceful: if date parsing fails we just rebuild. |
| Force param + empty cache | Performs rebuild (MISS) and returns metadata with `forced: true`. |

## Future Extensions
1. **Multi‑Instance Scaling**: Replace in‑memory map with Redis or a lightweight distributed cache. Key format stays `stats_<userId>`.
2. **ETag Support**: Provide `ETag` based on hash of `lastScrobblePlayedAt + totalScrobbles` enabling 304 responses.
3. **Adaptive TTL**: Increase TTL for inactive users (e.g., >30m since last scrobble) to reduce recompute cost.
4. **Batch Freshness Preload**: During heavy load, prefetch latest scrobble timestamps for active users into a side map.

## Files Updated
- `server/src/routes/music.ts`: Implemented improved cache logic & metadata.
- `mobile/src/services/api.ts`: Added `force` option to `getListeningStats`.
- `mobile/src/screens/HomeScreen.tsx`: Pull‑to‑refresh triggers force; displays cache metadata.

## Validation
- Confirmed server rebuild logs show: `Cache HIT`, `Cache expired`, or `New scrobble detected; busting cache`.
- Manual pull refresh logs: `Force bypass requested` and `X-Cache: MISS` header.
- TypeScript: No compile errors after changes.

## Rollback Plan
Set `STATS_CACHE_TTL` back to original (60s) and remove freshness query if needed. The changes are isolated to one route; revert commit safely.

## Why Not Longer TTL?
Listening patterns can change rapidly (user playing several tracks in a minute). A longer TTL (e.g. 60s) caused perceived staleness and user confusion. 15s is a balanced compromise until we have push/stream updates.

---
_Last revised: 2025-11_
