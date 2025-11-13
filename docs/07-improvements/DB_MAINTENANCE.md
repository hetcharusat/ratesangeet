# Database Maintenance & Reset Guide (Phase 4–6)

This document summarizes the new performance indexes, the safe development reset + seed workflow, and recent OpenAPI + cache metadata changes.

## 1. Performance Indexes Added (Phase 4)

### Scrobble
| Purpose | Index |
|---------|-------|
| Time-ordered queries per user | `{ userId: 1, playedAt: -1 }` |
| Dedup (rounded timestamp root fix) | `{ userId: 1, spotifyId: 1, playedAt: 1 }` UNIQUE |
| Album progress lookups | `{ userId: 1, albumId: 1, playedAt: -1 }` |
| Artist-centric filters | `{ userId: 1, artistName: 1, playedAt: -1 }` |
| Fast recent activity (partial 30d) | `{ userId: 1, playedAt: -1 }` PARTIAL (name: `recent_activity_idx`) |

### AlbumStats
| Purpose | Index |
|---------|-------|
| Uniqueness per album | `{ userId: 1, albumKey: 1 }` UNIQUE |
| Leaderboards | `{ userId: 1, playCount: -1 }` |
| Completion ranking | `{ userId: 1, completedPlays: -1 }` |
| Recent plays timeline | `{ userId: 1, lastPlayedAt: -1 }` |
| Completion timeline | `{ userId: 1, lastCompletedAt: -1 }` |
| Analytics (progress history) | `{ userId: 1, albumKey: 1, lastCompletedAt: -1 }` (name: `album_completion_timeline`) |

### TrackStats
| Purpose | Index |
|---------|-------|
| Uniqueness per track | `{ userId: 1, trackKey: 1 }` UNIQUE |
| Top tracks leaderboard | `{ userId: 1, playCount: -1 }` |
| Recent track activity | `{ userId: 1, lastPlayedAt: -1 }` |

### CompletionEvent
| Purpose | Index |
|---------|-------|
| User completion stream | `{ userId: 1, completedAt: -1 }` |
| Per-album completion timeline | `{ userId: 1, albumKey: 1, completedAt: -1 }` (name: `user_album_completion_idx`) |

### Review
| Purpose | Index |
|---------|-------|
| User review feed | `{ userId: 1, createdAt: -1 }` |
| User/item uniqueness queries | `{ spotifyId: 1, userId: 1 }` |
| Public feed ordering | `{ isPublic: 1, createdAt: -1 }` |
| Trending public reviews | `{ isPublic: 1, likes: -1, createdAt: -1 }` (name: `public_trending_reviews`) |

## 2. Reset & Seed Script (Phase 5)
Script: `server/src/scripts/reset-and-seed.ts`

### Safety Guards
- Refuses to run if `NODE_ENV === 'production'`
- Requires `RESET_CONFIRM=1`
- Aborts if user count > 50 unless `FORCE_ALL=1`
- Uses `deleteMany({})` (preserves indexes) rather than dropping collections

### What It Seeds
- One demo user (creates if none exists)
- Canonical albums (Rumours, Hotel California, Thriller) with ~4 scrobbles each
- Derived `AlbumStats`, `TrackStats`, and `UserStatsSummary`

### Run (Windows PowerShell)
```powershell
$env:NODE_ENV='development'
$env:RESET_CONFIRM='1'
# Optional if >50 users: $env:FORCE_ALL='1'
npm --prefix server run admin:reset-seed
```

### Expected Output (abridged)
```
⚠️  Truncating collections (preserving indexes)...
✅ Core collections truncated. Seeding canonical data...
✅ Seed complete { totalScrobbles: 12, albums: 3, tracks: 12 }
```

## 3. OpenAPI & Type Generation (Phase 6)
- Added `CacheMetadata` schema (source, cachedAt, expiresAt, isFresh)
- New endpoints:
  - `GET /api/home/snapshot` (force=? + cache metadata)
  - `GET /api/home/quick-stats`
  - `POST /api/refresh/*` (recent, stats, discover, home, all)
  - `GET /api/refresh/cache-stats`
- Enhanced endpoints:
  - `/api/music/search` now supports `force`, per-user vs anonymous caching, optional `refreshedToken`
  - `/api/music/recently-played` supports `force` + cache metadata + optional `refreshedToken`
  - `/api/music/currently-playing` may include `refreshedToken` (no cache; realtime)

### Regenerate Shared Types
Generates `shared/api-types.ts` from updated spec:
```powershell
npm --prefix server run gen:types
```

## 4. Cache Metadata Usage Pattern
Every cached response envelope includes:
```json
{
  "cache": {
    "source": "spotify", // or database|cache|hybrid
    "cachedAt": "2025-11-11T00:00:00.000Z",
    "expiresAt": "2025-11-11T00:05:00.000Z",
    "isFresh": true
  }
}
```
Clients can:
- Show a subtle "Cached" badge
- Decide whether to force refresh (`?force=1`) based on staleness

## 5. Verification Checklist After Pull
1. Run server task → confirm `📘 API docs available at /api-docs` appears
2. Hit `/api/health` → expect `{ status: 'OK' }`
3. Check startup logs for index creation confirmation (Mongoose may log build events on first run)
4. Run reset seed script (optional dev only)
5. Regenerate types if OpenAPI changed

## 6. Future Improvements
- Add offline index build monitoring endpoint
- Introduce background job to validate fragmented partial indexes
- Precompute album completion percentages server-side (replace heuristic in snapshot)

## 7. Warnings
- Never run reset script in production
- Do not drop collections manually; rely on truncation to keep indexes warm
- Avoid force refresh spam; respect TTLs for Spotify rate limits

---
Maintained as part of Phase 4–6 stabilization. Update this doc when adding new analytics or cache layers.
