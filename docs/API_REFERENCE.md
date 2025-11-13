# Ratesangeet API & UI Data Contracts

> Purpose: This document gives you EVERYTHING you need to build ANY UI on top of the existing backend. It maps screens/components to endpoints, describes data shapes, caching rules, errors, and recommended client patterns.
>
> If you only need a quick list of endpoints jump to: **[Endpoint Matrix](#endpoint-matrix)**.

---
## 1. Authentication Flow (Simplified Server-Side OAuth)

| Step | Client Action | Backend Endpoint | Notes |
|------|---------------|------------------|-------|
| 1 | Redirect user to Spotify | Client generates OAuth URL | Use expo-auth-session or manual URL construction |
| 2 | User grants access (Spotify) | (Spotify redirect) | Spotify redirects back with `code` parameter |
| 3 | **Exchange code (server-side)** | `POST /api/auth/callback` | ✅ **PRIMARY METHOD** - Server handles token exchange, user creation |
| 4 | Persist tokens locally | (client only) | Store `accessToken`, `refreshToken` in AsyncStorage |
| 5 | Refresh when 401 or expiry | `POST /api/auth/refresh` | Some responses exclude `refreshToken` if unchanged |

**⚠️ DEPRECATED**: `POST /api/auth/pkce-login` - Use `/api/auth/callback` instead

**Updated Flow (Nov 2025)**:
- **Client**: Redirects to Spotify → Gets code → Sends code to server
- **Server**: Exchanges code → Fetches profile → Creates/updates user → Returns tokens
- **No client-side token exchange** (simpler, more reliable)

Returned **User object**:
```ts
interface User {
  id: string;          // Mongo _id (use for userId params)
  spotifyId: string;   // Spotify account id
  displayName: string;
  email: string;
  profileImage?: string;
  username: string;    // Generated if missing
}
```

**UI Contract Tips**:
- Always keep `accessToken` ephemeral; refresh on failure.
- Display name + avatar anchor most user UI (header, profile page).
- `username` is stable for mentions/search ("@username").

---
## 2. Core Domain Models (Simplified)

```ts
interface Scrobble {
  id: string;
  userId: string;
  spotifyId: string;      // Track ID
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  albumArt?: string;
  durationMs?: number;
  playedAt: string;       // ISO time (rounded to 10s)
  source: 'spotify';
}

interface Review {
  id: string;
  userId: string;
  spotifyId: string;      // Track or Album ID
  itemType: 'track' | 'album';
  rating: number;         // scale defined by UI (1–5 or 1–10)
  text: string;
  createdAt: string;
}

interface ListeningStats {
  totalMinutes: number;         // Sum recent scrobbles durations / 60k
  totalScrobbles: number;       // Count of fetched window (<=200)
  uniqueArtistsCount?: number;
  topAlbums: Array<{ name: string; artist: string; albumArt?: string; count: number; totalTracks?: number; totalTimeMs?: number }>;
  topSingles: Array<{ name: string; artist: string; count: number }>;
  topGenres: Array<{ genre: string; count: number }>;
  topArtists: Array<{ artist: string; count: number }>;
  albumCompletions: {
    totalCompletedAlbums: number;
    totalCompletedAlbumPlays: number;
    recentCompletions: Array<{ albumName: string; artistName: string; albumArt?: string; lastCompletedAt: string }>;
    dailyCompletionTrend: Array<{ date: string; count: number }>;
    last7DaysCompletions: number;
    currentStreak: number;
  };
  cache?: {
    hit: boolean;
    ageMs: number;
    generatedAt: number;
    lastScrobblePlayedAt?: number;
    forced?: boolean;
  };
}
```

---
## 3. Screen → Endpoint Mapping

### Home / Dashboard
| Data Piece | Endpoint | Fields Used | Refresh Policy |
|------------|----------|-------------|----------------|
| Listening summary | `GET /api/music/listening-stats?userId&accessToken` | `totalMinutes`, `topAlbums`, `albumCompletions` | Cache 15s (server). Use pull-to-refresh with `force=1`. |
| Recent reviews | `GET /api/reviews/user/:userId` | `rating`, `text`, `spotifyId` | Refresh on navigation focus or manual refresh |
| User profile quick info | `GET /api/users/:id` | `displayName`, `profileImage`, `username` | Cache in memory until logout |

### Library / History
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| Recent scrobbles | `GET /api/music/scrobbles?userId&limit=200` | For infinite scroll / virtual list |
| Sync while offline | `POST /api/music/sync-recent` | Use after app resumes to backfill |

### Discovery
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| Discover feed | `GET /api/discover` (implementation not in spec example) | Provide personalized album/track suggestions |

### Search
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| Track/Album search | `GET /api/music/search?q=term&type=track,album` | Debounce client; show combined results |
| User search | `GET /api/auth/search-users?query=term` | Supports @username and displayName |

### Artist Detail
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| Artist profile + top tracks + discography | `GET /api/music/artist?artistId=...` or `?q=name` | Use fallback search if id unknown |

### Album Detail
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| Album info + tracks | `GET /api/music/album?albumId=...` | Get track durations for progress |
| User scrobbles (filtered by album) | `GET /api/music/scrobbles?userId` (client-side filter) | Avoid server fan-out queries |

### Review Creation
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| Create review | `POST /api/reviews` | Provide `spotifyId`, `itemType`, `rating`, `text` |
| Update review | `PUT /api/reviews/:id` | Idempotent update |
| Delete review | `DELETE /api/reviews/:id` | Hard delete |

### Profile
| Data Piece | Endpoint | Notes |
|------------|----------|-------|
| User info | `GET /api/users/:id` | Show avatar, username, favorites |
| Followers | `GET /api/users/:id/followers` | Pagination if needed |
| Following | `GET /api/users/:id/following` | — |
| Feed (friends' reviews) | `GET /api/users/:id/feed` | For social timeline |

---
## 4. Endpoint Matrix (Concise)

| Method | Path | Purpose | Auth Needed |
|--------|------|---------|-------------|
| GET | /api/health | Server health | No |
| GET | /api/auth/login | Get Spotify authorize URL (optional) | No |
| **POST** | **/api/auth/callback** | **🎯 Primary auth - Exchange code for tokens** | No (code) |
| POST | /api/auth/pkce-login | ⚠️ DEPRECATED - Use /auth/callback | Yes (Spotify accessToken) |
| POST | /api/auth/refresh | Refresh access token | Yes (refreshToken) |
| GET | /api/auth/search-users | Find users | Yes (optional) |
| GET | /api/music/recent | Spotify recently played (raw) | Yes |
| GET | /api/music/top-tracks | User top tracks | Yes |
| GET | /api/music/search | Search tracks/albums | Yes |
| GET | /api/music/artist | Artist + discography | Yes |
| GET | /api/music/album | Album details | Yes |
| GET | /api/music/currently-playing | Current track | Yes |
| GET | /api/music/recently-played | Raw recent plays | Yes |
| POST | /api/music/scrobble | Scrobble current track | Yes |
| GET | /api/music/scrobbles | User scrobble history | Yes |
| GET | /api/music/listening-stats | Aggregated stats (cached) | Yes |
| POST | /api/music/sync-recent | Backfill scrobbles | Yes |
| GET | /api/reviews/user/:userId | Reviews for user | Yes |
| POST | /api/reviews | Create review | Yes |
| PUT | /api/reviews/:id | Update review | Yes |
| DELETE | /api/reviews/:id | Delete review | Yes |
| GET | /api/users/:id | Profile | Yes |
| GET | /api/users/:id/feed | Friend reviews feed | Yes |
| GET | /api/users/:id/activity | Activity log | Yes |
| GET | /api/users/:id/followers | Followers list | Yes |
| GET | /api/users/:id/following | Following list | Yes |
| POST | /api/users/:id/follow | Follow user | Yes |
| POST | /api/users/:id/unfollow | Unfollow user | Yes |

---
## 5. Caching & Performance Contracts

| Endpoint | Server Caching | Client Strategy |
|----------|----------------|-----------------|
| /api/music/listening-stats | 15s in-memory (ETag provided) | Poll on screen focus, force refresh with `?force=1` |
| /api/music/scrobbles | None (query sorted + limited) | Keep local copy; append new scrobbles lazily |
| /api/music/album | None | Cache track list by albumId in context/store |
| /api/music/artist | None | Cache discography for quick revisit |
| /api/music/search | None (Spotify timeout 15s) | Debounce input (>=300ms); cancel stale requests |

**ETag Usage**: `GET /api/music/listening-stats` returns `ETag` header; send `If-None-Match` to receive `304` and reuse cached data.

---
## 6. Error Handling Patterns

Common JSON error shape:
```json
{
  "error": "Failed to fetch ...",
  "message": "Optional human readable",
  "status": 401,
  "details": { }
}
```

Auth-specific mapping (Spotify errors):
```json
{
  "error": "Authentication failed",
  "errorCode": "invalid_grant", // or invalid_client, spotify_unavailable, etc.
  "message": "Authorization code expired or already used, or redirect URI mismatch.",
  "status": 400
}
```

UI should:
- Distinguish 401 (token refresh) vs other failures.
- Show toast/snackbar for transient errors (network) and persistent (invalid credentials).
- Retry search automatically once for network timeouts.

---
## 7. UI Data Retrieval Recipes

### A. Home Screen Load (Parallel Fetch)
```ts
await Promise.all([
  getListeningStats(user.id, accessToken),
  getUserReviews(user.id),
  getUserProfile(user.id),
]);
```
If any fails, display partial sections with placeholders.

### B. Scrobble Cycle (Foreground)
1. Poll `/api/music/currently-playing` every ~5–8s.
2. When progress_ms / duration_ms >= 0.4 invoke `POST /api/music/scrobble`.
3. Optimistically append returned scrobble to local list.

### C. Offline / Resume Backfill
```ts
POST /api/music/sync-recent { accessToken, userId }
// Merge returned items (if CLOUD_ENABLE_SCROBBLES=false)
```

### D. Album Progress Calculation (Client)
```ts
const listenedTrackIds = scrobblesAlbum.map(s => s.spotifyId);
const completionPercent = Math.round(unique(listenedTrackIds).length / totalAlbumTracks * 100);
```

### E. Review Flow
- Navigate with rich object: `{ itemType: 'album', album: { id, name, images, artists } }`.
- POST review; on success update local review array and invalidate feed.

---
## 8. Naming & Key Conventions

| Key Type | Rule |
|----------|------|
| Track Unique | `spotifyId || (artistName + trackName)` |
| Album Unique | `albumId || albumName` (albumKey) |
| Timestamps | Rounded to nearest 10s for scrobbles (dedupe) |
| Username | Generated if missing; lowercase alphanumeric + numeric suffix |

---
## 9. Security & Safety Notes
- Access tokens never logged (masked in dev request logger).
- Scrobbles are idempotent due to (userId, spotifyId, playedAt) triple.
- Avoid calling album endpoint in hot loops (batch where possible).
- Refresh token only used at `/api/auth/refresh`; protect at rest.

---
## 10. Building a Typed Client (Next Step)
Use OpenAPI (`server/openapi.yaml`) to generate a TS client:
```
npx openapi-typescript server/openapi.yaml -o shared/api-types.ts
```
Then wrap fetch/axios calls with those types to enforce UI-data contracts.

---
## 11. Quick Example Calls

```http
GET /api/music/listening-stats?userId=64a...&accessToken=***
200 OK
{
  "totalMinutes": 123,
  "totalScrobbles": 200,
  "topAlbums": [ { "name": "Rumours", "artist": "Fleetwood Mac", "count": 8 } ],
  "albumCompletions": { "currentStreak": 2, ... }
}
```

```http
POST /api/reviews
{ "userId": "64a...", "spotifyId": "3pL...", "itemType": "album", "rating": 9, "text": "Iconic." }
201 Created
{ "id": "abc123", "userId": "64a...", "rating": 9 }
```

---
## 12. UI Placeholder Guidance
When API data pending:
- Scrobbles: show 6 skeleton rows (height ~56)
- Listening Stats: shimmer blocks for count metrics
- Top Albums: grey card placeholders with aspect ratio 1:1
- Reviews: 3 skeleton text lines + avatar circle

---
## 13. Upgrade / Extension Ideas
| Idea | Endpoint Impact | UI Impact |
|------|------------------|-----------|
| Add genres (fast) | Extend `/listening-stats` to return `topGenres` (already placeholder) | Add chips row |
| Pagination reviews | Add `?cursor=` to `/reviews/user/:userId` | Infinite scroll list |
| Album completion history | New `/stats/albums/completions` | Sparkline charts |

---
## 14. Glossary
| Term | Definition |
|------|------------|
| Scrobble | A track played ≥40% of duration |
| Completion | Playing ALL tracks of an album in a cycle |
| Cycle | Unique-track traversal until full album completion |
| PKCE | Secure OAuth flow without client secret |

---
## 15. FAQ (Implementation)
**Q: Why 40% threshold?** Balances short track intros and accidental skips.

**Q: Why round timestamps?** Ensures duplicate polls of same track collapse to single scrobble (root fix vs cleanup).

**Q: Can I change rating scale?** Yes; UI only. Server stores numeric `rating` without enforcing range.

---
**End of Reference – You can now design ANY UI confidently.**
