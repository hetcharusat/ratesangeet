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
- Threshold constant: `SCROBBLE_THRESHOLD = 0.4` (mobile `ScrobbleContext`, server `/scrobble` route).
- Scrobbles are idempotent per (userId, spotifyId, ~10s time window) and safe to retry.
- Deduplication: Server uses 10s-rounded playedAt timestamp to group rapid re-scrobbles; client uses simple track ID to prevent duplicate scrobbles within same session.
- Persisted fields for each scrobble (Mongo):
  - `userId`, `spotifyId`, `trackName`, `artistName`, `albumId`, `albumName`, `albumArt`, `durationMs`, `playedAt`, `source`.

### Album progress (as shown on History/Album Detail)
- listenedTracks = number of unique album tracks that crossed the 40% threshold.
- totalTracks = album track count from Spotify API (via albumId); albums without albumId are skipped.
- completionPercent = round((listenedTracks / totalTracks) * 100).
- totalPlays = total scrobble count for that album (can be > listenedTracks if user replayed tracks).
- An album is shown as "Completed" when completionPercent === 100.

### Top Albums (Home)
- We surface albums where unique tracks played >= 3 (heuristic to filter singles/EPs).
- `count` = total scrobbles for that album (number of scrobbled tracks, not unique tracks).
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

## Local Testing Guide (Beta Phase)

### Setup Philosophy
- **Production URLs stay in code** (Render domain for builds, LAN IP for dev)
- **Server .env is gitignored** (local DB credentials ≠ Render env vars)
- **Mobile config auto-detects** environment (production vs dev)
- **Push to GitHub = safe** (Render uses its own environment variables)

### Local Testing Steps
1. **Start Server** (uses MongoDB Atlas via local .env):
   ```bash
   cd server
   npm run dev  # Runs on http://0.0.0.0:5000 + LAN IP
   ```
   - Server connects to **production MongoDB Atlas** (`ratesangeet` database)
   - Logs show: `✅ MongoDB connected successfully`
   - Available on LAN: `http://192.168.42.205:5000` (your Wi-Fi IP)

2. **Start Mobile** (connects to local server in dev mode):
   ```bash
   cd mobile
   npm run start  # Expo dev server
   # Press 'a' for Android, 'i' for iOS
   ```
   - Mobile auto-detects: `http://192.168.42.205:5000/api` (dev mode)
   - Uses **real production data** from Atlas
   - Changes reload instantly (no rebuild)

3. **Test Cache Changes**:
   - Load Home screen → See stats (cache MISS, "Fresh")
   - Reload within 15s → See "Cached" with timestamp
   - Pull-to-refresh → See "(forced)" and fresh data
   - Server logs show: `Cache HIT`, `Force bypass`, `New scrobble detected`

### Environment Variable Flow
| Environment | API URL | MongoDB | How It's Set |
|-------------|---------|---------|--------------|
| **Local Dev** | `http://192.168.42.205:5000/api` | MongoDB Atlas | `mobile/src/config/index.ts` heuristics |
| **Production (Render)** | `https://ratesangeet.onrender.com/api` | MongoDB Atlas | Render env vars + `NODE_ENV=production` |
| **APK Build** | `https://ratesangeet.onrender.com/api` | MongoDB Atlas | `NODE_ENV=production` in build |

### Override for Testing (Optional)
```powershell
# Test mobile against different server
cd mobile
$env:EXPO_PUBLIC_API_URL="http://localhost:5000/api"
npm run start
```

### What's Safe to Push
✅ All code changes (URLs are environment-aware)  
✅ Server routes, models, jobs  
✅ Mobile screens, components, services  
❌ Never commit `server/.env` (already gitignored)  
❌ Never hardcode localhost in committed code

## Seed/Test Data
- Script: `server/add-test-scrobbles.ts` – seeds 3 canonical albums with ~40–45% completion.
- Albums seeded (Spotify IDs):
  - Rumours `2guirTSEqLizK7j9i1MTTZ`
  - Hotel California `1Rv9WRKyYhFaGbuYDaQunN`
  - Thriller `3pLdWdkj83EYfDN6H2N8MR`
- Use this to validate album progress, Top Albums, and AddReview flows.

## Development Philosophy & Best Practices

### 🚨 CRITICAL: Always Find Root Cause, Never Apply Quick Patches

**GOLDEN RULE: Fix at the SOURCE, not downstream cleanup.**

#### What is a ROOT FIX vs PATCH?

| Issue | ❌ PATCH (Symptom Fix) | ✅ ROOT FIX (Source Fix) |
|-------|----------------------|------------------------|
| **Duplicate data** | Delete duplicates in a cleanup job | Fix uniqueness constraint/key at insertion point |
| **Wrong calculation** | Hide/adjust result in UI | Fix calculation formula at data generation |
| **Missing data** | Add fallback values | Ensure data is captured at source |
| **Timestamp issues** | Compare/dedupe timestamps after save | Normalize timestamp BEFORE save |
| **Type mismatches** | Cast types in display layer | Fix type at API boundary/schema |

#### Root Fix Checklist:
- [ ] **Trace end-to-end**: Follow data from origin → DB → API → UI
- [ ] **Find generation point**: Where is the wrong data CREATED?
- [ ] **Fix at source**: Change the code that GENERATES the data
- [ ] **Verify constraints**: Does the fix work WITH existing DB indexes/constraints?
- [ ] **No workarounds**: Solution should NOT require cleanup jobs, post-processing, or UI hacks
- [ ] **Self-healing**: System automatically prevents the bug going forward

#### Example: Duplicate Scrobbles (Root Fix Applied)
```typescript
// ❌ PATCH: Delete duplicates after they're created
setInterval(() => {
  db.scrobbles.aggregate([...]).forEach(doc => {
    db.scrobbles.deleteMany({ _id: { $in: doc.ids.slice(1) } });
  });
}, 60000); // Band-aid: Run cleanup every minute

// ✅ ROOT FIX: Prevent duplicates at insertion
const startedAtMs = timestamp - progressMs;
const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000; // Round to 10s
const playedAt = new Date(roundedStartMs); // Same value for all polls

await Scrobble.findOneAndUpdate(
  { userId, spotifyId, playedAt }, // Exact match works with unique index
  { $setOnInsert: {...}, $set: {...} },
  { upsert: true }
); // MongoDB enforces uniqueness automatically
```

#### Red Flags (Indicates Patch, Not Root Fix):
- 🚩 Adding cleanup jobs/cron tasks
- 🚩 Manual deduplication loops
- 🚩 UI hiding/transforming wrong data
- 🚩 Multiple try-catch with fallbacks masking the issue
- 🚩 Comments like "workaround for...", "hack to fix..."
- 🚩 Same bug can happen again with different data

#### Process for Root Fixing:
1. **Reproduce**: Get exact steps to trigger the bug
2. **Trace**: Log every transformation point from source → destination
3. **Identify**: Find the FIRST place where data becomes wrong
4. **Fix**: Change that specific point (not later cleanup)
5. **Validate**: Ensure fix works with existing constraints (indexes, types, etc.)
6. **Test**: Verify bug cannot happen again with any data

### Dynamic Problem-Solving Approach

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
6. **No patches**: If you're adding cleanup/workaround code, you're not at the root

### Example: Root Fix Pattern (Actual Implementation)
```typescript
// PROBLEM: Duplicate scrobbles wasting storage
// ❌ WRONG APPROACH (Patch):
// - Add cleanup job to delete duplicates every hour
// - Add client-side check to prevent duplicate API calls
// - Add UI filter to hide duplicate entries

// ✅ RIGHT APPROACH (Root Fix):
// 1. TRACE: progressMs changes every 3s → startedAtMs changes → playedAt changes → unique index fails
// 2. IDENTIFY: Root cause = timestamp not stable across polls
// 3. FIX AT SOURCE: Round timestamp to 10s BEFORE saving
const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000;
const playedAt = new Date(roundedStartMs); // Stable across polls

// 4. USE EXISTING CONSTRAINTS: Exact match works with unique index
await Scrobble.findOneAndUpdate(
  { userId, spotifyId, playedAt }, // Index enforces uniqueness
  { ... },
  { upsert: true }
);
// Result: No duplicates possible, no cleanup needed, self-healing
```

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
