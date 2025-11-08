# Spotify Music Tracker - Project Instructions

## Project Overview
A mobile music tracking application similar to Letterboxd but for Spotify. Users can track, rate, and review songs, albums, and singles they've listened to. Built as a native mobile app (Android APK / iOS IPA).

## Tech Stack
- **Mobile App**: React Native + Expo + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB with Mongoose + Local SQLite (hybrid storage)
- **Authentication**: Spotify OAuth 2.0 (PKCE on-device)
- **Navigation**: React Navigation
- **State Management**: React Context API
- **Local Storage**: expo-sqlite for scrobble archive

## Project Structure
- `/mobile` - React Native mobile application (Expo)
  - `/src/storage` - Local SQLite for scrobble history
  - `/src/context` - Auth and Scrobble contexts
  - `/src/services` - API client
- `/server` - Express backend API
  - `/src/models` - Mongoose models (User, Review, AlbumStats, TrackStats, UserStatsSummary)
  - `/src/routes` - API routes (auth, music, reviews, stats, users)
  - `/src/jobs` - Background jobs (archive scrobbles)
- `/docs` - Architecture and storage documentation
- `/shared` - Shared TypeScript types and utilities

## Key Features
1. Spotify OAuth authentication (PKCE, no client secret)
2. Hybrid storage: raw scrobbles local, summaries cloud
3. Rate songs/albums (1-5 stars or 1-10 scale)
4. Write and save reviews
5. User dashboard with stats
6. Native mobile experience
7. Build to APK for Android
8. Album/track play counts in cloud
9. Archive job to thin old scrobbles

## Core Product Rules (Scrobbling, Progress, Stats)

### Scrobbling contract
- A track is considered "scrobbled" when at least 40% of its duration is played.
- Threshold constant: `SCROBBLE_THRESHOLD = 0.4` (mobile `ScrobbleContext`).
- Scrobbles are idempotent per (userId, spotifyId, playedAt) and safe to retry.
- Persisted fields for each scrobble (Mongo):
  - `userId`, `spotifyId`, `trackName`, `artistName`, `albumId?`, `albumName?`, `albumArt?`, `durationMs?`, `playedAt`, `source`.

### Album progress (as shown on History/Album Detail)
- listenedTracks = number of unique album tracks that crossed the 40% threshold.
- totalTracks = album track count from Spotify when `albumId` is present; otherwise fallback to size of listened set.
- completionPercent = round((listenedTracks / totalTracks) * 100).
- An album is shown as "Completed" when completionPercent === 100.

### Top Albums (Home)
- We surface albums where unique tracks played > 3 (heuristic to filter singles/EPs).
- `count` = total scrobbles for that album (number of scrobbled tracks, not days).
- UI label shows: "{count} scrobbles".
- Server may also compute `totalTimeMs` for future use, but UI prioritizes scrobble count.

## Recent Decisions & Fixes (2025-11)

### AlbumId data integrity fix
- Root cause: `albumId` was missing from the `Scrobble` schema → values were dropped on insert.
- Fixes applied:
  1) Added `albumId?: string` to `server/src/models/Scrobble.ts` (interface + schema).
  2) Re-ran `server/add-test-scrobbles.ts` to seed realistic partial albums (Rumours, Hotel California, Thriller).
  3) Improved album aggregation on mobile `HistoryScreen` to set `albumId` from any scrobble in the group (not only the first).
- Result: Album detail and progress now use real Spotify album tracks and show correct percentages (e.g., 31–45%).

### Performance guardrails
- Server `GET /music/listening-stats` uses fast mode:
  - Limits to last ~200 scrobbles, `.select()` only needed fields, `.lean()` for plain objects.
  - Avoids per-album Spotify API calls in stats; calculates in-memory.
- Mobile HomeScreen wraps calls with a 10s timeout and uses backoff retry for resilience.
- HistoryScreen processes albums in small batches to avoid UI stalls and rate limits.

### Navigation contracts
- AddReview screen expects:
  - Album: `{ itemType: 'album', album: { id, name, images, artists } }`.
  - Track: `{ itemType: 'track', track }`.
- Album Detail "Rate This Album" button navigates with the same shape as Search results.

## API Contracts (selected)

### Mobile → Server
- `GET /music/scrobbles?userId&limit` → Array<Scrobble> (see fields above).
- `GET /music/listening-stats?userId&accessToken?` →
  ```ts
  interface ListeningStats {
    totalMinutes: number;          // sum(durationMs) / 60000 of fetched scrobbles
    totalScrobbles: number;        // number of scrobbles in the window
    uniqueArtistsCount?: number;
    topAlbums: Array<{
      name: string;
      artist: string;
      albumArt?: string;
      count: number;               // scrobble count for that album
      totalTracks?: number;        // number of unique tracks played (heuristic)
      totalTimeMs?: number;        // optional; may be present for future UI
    }>;
    topSingles?: Array<...>;
    topGenres: Array<{ genre: string; count: number }>;
    topArtists?: Array<{ artist: string; count: number }>;
  }
  ```

## Engineering Best Practices (expanded)
- Always `.select()` the minimal fields and use `.lean()` on read-heavy Mongoose queries.
- Cache or batch Spotify API calls; never call per-item in hot paths.
- Prefer stable keys: `albumKey = albumId || albumName`, `trackKey = spotifyId || (artist+trackName)`.
- Be explicit with types across the wire (shared types or duplicated interfaces kept in sync).
- When adding optional fields (e.g., `albumId`), update:
  - Mongoose schema
  - API `.select()` clauses
  - Mobile API types and aggregators
  - Any seed scripts and diagnostics

## Debugging Process Checklist
1) Reproduce and capture logs (mobile console + server).
2) Trace the field from UI → API client → API route → DB schema → seed/data source.
3) Validate with one real record end-to-end.
4) Add defensive fallbacks (e.g., use `albumName` when `albumId` missing), but prioritize fixing the source.
5) Add a tiny test/seed to prevent regression (e.g., `add-test-scrobbles.ts`).

## Seed/Test Data
- Script: `server/add-test-scrobbles.ts` – seeds 3 canonical albums with ~40–45% completion.
- Albums seeded (Spotify IDs):
  - Rumours `2guirTSEqLizK7j9i1MTTZ`
  - Hotel California `1Rv9WRKyYhFaGbuYDaQunN`
  - Thriller `3pLdWdkj83EYfDN6H2N8MR`
- Use this to validate album progress, Top Albums, and AddReview flows.

## Development Philosophy & Best Practices

### 🚨 CRITICAL: Always Find Root Cause, Never Apply Quick Patches
- **DO NOT** apply quick fixes or patches without understanding the underlying issue
- **ALWAYS** trace the data flow end-to-end to find the root cause
- **VERIFY** that your fix addresses the actual problem, not just the symptom
- **TEST** that your solution works across all related components
- **DOCUMENT** what was broken and why the fix works

### Dynamic Problem-Solving Approach
1. **Trace the entire data flow** from source to destination
2. **Identify all points of transformation** (API → Server → DB → Client → Local)
3. **Check consistency** across:
   - Model schemas (MongoDB + SQLite)
   - API route handlers
   - Type definitions
   - Client-side data mapping
   - SQL queries and aggregations
4. **Fix systematically** at the root, not the symptom
5. **Validate** that all related code is aligned

### Example: Hybrid Storage Data Flow
```
Spotify API (track.album.id)
  ↓
Server routes/music.ts (extract albumId)
  ↓
API response type (includes albumId)
  ↓
Client ScrobbleContext (map albumId)
  ↓
Local SQLite (save albumId column)
  ↓
Aggregation queries (COALESCE(albumId, albumName))
  ↓
Cloud upsert (albumKey = albumId || albumName)
  ↓
MongoDB AlbumStats (unique by albumKey)
```

**If ANY link breaks, trace the ENTIRE chain, don't patch the symptom.**

### Code Quality Standards
- Use TypeScript strictly (no `any` unless absolutely necessary)
- Prefer explicit types over inference for public APIs
- Use `albumKey`/`trackKey` patterns for flexible uniqueness
- Always handle both ID-based and name-based fallbacks
- Write idempotent operations (safe to retry/re-run)
- Test with and without optional fields (albumId, trackId, etc.)

### Storage Architecture
- **Cloud (MongoDB)**: Public data + thin summaries
  - Reviews, comments, favorites, follows
  - AlbumStats (per-user album counts)
  - TrackStats (per-user track counts)
  - UserStatsSummary (lifetime totals)
- **Local (SQLite)**: Full scrobble archive
  - All-time listening history
  - Fast offline queries
  - Source for computing cloud deltas

### Environment Controls
- `CLOUD_ENABLE_SCROBBLES=false` → No raw scrobbles in cloud
- `ARCHIVE_RETENTION_DAYS=90` → How long to keep raw scrobbles
- `ARCHIVE_KEEP_RECENT=200` → Minimum recent scrobbles to keep
- `ARCHIVE_DRY_RUN=1` → Preview archive job without deleting
