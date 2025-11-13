# Ratesangeet (Spotify Music Tracker) - V2 Project Instructions

## Project Overview
A mobile music tracking application (like Letterboxd for Spotify) where users track, rate, and review songs/albums. **V2 redesign** focuses on: client-side scrobble detection, 90-day cloud retention with device archive, minimal API payloads, album completion logic (4-track min, 70% threshold), and fast incremental loading.

## Tech Stack
- **Mobile**: React Native + Expo + TypeScript, expo-sqlite (local archive)
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB Atlas (cloud) + SQLite (device archive)
- **Auth**: JWT (short-lived access + refresh rotation); Spotify OAuth 2.0 for initial login
- **Navigation**: React Navigation
- **State**: React Context API
- **UI**: Material Design 3 Paper components

## V2 Architecture Principles
- **Hybrid storage**: Cloud keeps recent scrobbles (90d TTL), device archives older ones in SQLite
- **Client-side scrobble detection**: 40–50% threshold or ≥30s → queue locally, batch sync to server
- **Minimal cloud schema**: scrobbles_recent (TTL), albumstats, trackstats, userstatssummaries, reviews, reviewcomments, optional caches
- **Deterministic keys**: albumKey = albumId || albumName; trackKey = spotifyId || artist+trackName
- **API v2 returns tiny shapes**: always `.select()` + `.lean()`, gzip + ETag, pagination (default limit=20, max=100)
- **Album completion**: only ≥4 tracks; 70% unique tracks = completion; replays after full completion increment `albumPlayCount`
- **No Spotify proxy dumps**: server maps to minimal shapes before returning
- **Incremental home loading**: skeleton + staggered small calls (stats/summary, recent scrobbles, top albums)

## Project Structure
- `/mobile` - React Native (Expo)
  - `/src/context` - Auth, Scrobble (batch sync + archive job)
  - `/src/services` - API client (v2 endpoints)
  - `/src/storage` - SQLite archive schema
  - `/src/screens` - Home (incremental), History, AlbumDetail, Profile
- `/server` - Express API
  - `/src/models` - ScrobbleRecent, TrackStats, AlbumStats, UserStatsSummary, Review, ReviewComment, User
  - `/src/routes/v2` - scrobbles (batch-upsert, recent, archive-ready, ack), stats (tracks, albums, summary), track/album/artist/credits
  - `/src/middleware` - JWT auth, gzip, ETag, rate-limit
  - `/src/services` - SpotifyService (minimal mappers, cache)
  - `/src/jobs` - Archive eligibility, TTL cleanup
- `/docs` - V2_SYSTEM_DESIGN, API_V2_SPEC, SCROBBLING_V2_PLAN, DATABASE_REBUILD_CUTOVER_PLAN, audits

## V2 Key Features
1. **Client-side scrobble detection** (40–50% or ≥30s) + batch sync
2. **90-day cloud retention** with device archive (SQLite)
3. **Album completion logic**: only ≥4 tracks; 70% unique = completion
4. **Replay protection**: 15-min guard on same track; new completion cycle after 70% replayed
5. **Minimal API payloads** (≤30 KB typical, ≤100 KB lists)
6. **JWT auth** (short-lived access + refresh)
7. **Incremental home loading** (skeleton + staggered calls)
8. **Rate/review** songs/albums (1-5 stars or 1-10 scale)
9. **Material Design 3 Paper UI**

## V2 Scrobbling Rules

### Client-Side Detection
- **Threshold**: `progressMs / durationMs >= 0.4` OR `progressMs >= 30000` → scrobble
- Client queues locally, syncs in batches (max 100) every 30s or on background
- Calculate `playedAtRounded10s` = floor((timestamp - progressMs) / 10000) * 10000 for stable dedup key

### Server-Side Logic (POST /api/v2/scrobbles/batch-upsert)
- Upsert `scrobbles_recent` by unique `(userId, spotifyId, playedAtRounded10s)` (TTL 90d on playedAt)
- If `isScrobbled`:
  - Upsert `trackstats` by `(userId, trackKey)`: increment `playCount` if last play >15min ago or null; always update `lastPlayedAt`
  - Fetch album `totalTracks` (once, cached); skip if <4 tracks
  - Upsert `albumstats` by `(userId, albumKey)`:
    - Increment `playCount`
    - Add trackId to `uniqueTracksPlayed` (array)
    - If `uniqueTracksPlayed.length / totalTracks >= 0.7`: increment `albumPlayCount`, clear `uniqueTracksPlayed`, set `lastCompletedAt`
  - Increment `userstatssummaries.totalScrobbles`

### Album Completion Contract
- **Only albums with ≥4 tracks** are tracked (singles/EPs ignored)
- **Progress** = `uniqueTracksPlayed.length / totalTracks * 100`
- **Completion** = progress >= 70% → increment `albumPlayCount`, reset `uniqueTracksPlayed` for new cycle
- **Replays**: same track replayed doesn't increase progress; replaying 70%+ after full completion increments `albumPlayCount` again

### Cloud Retention & Archive
- `scrobbles_recent` TTL = 90 days (MongoDB TTL index on `playedAt`)
- Device pulls eligible (>83d) via GET `/api/v2/scrobbles/archive-ready`, saves to SQLite, ACKs delete via POST `/api/v2/scrobbles/ack-archive`
- TTL is safety net; device archive is primary long-term storage

## V2 API Design (Minimal Payloads)

### Endpoints
- GET `/api/v2/track/:id` → `{ id, name, albumId, albumName, artistId, artistName, durationMs }`
- GET `/api/v2/album/:id` → `{ id, name, artistName, totalTracks, imageSmall }`
- GET `/api/v2/artist/:id` → `{ id, name, imageSmall }`
- GET `/api/v2/credits/:trackId` → `{ trackId, artists:[{id, name, role}], producers?, writers? }`
- GET `/api/v2/now-playing` → `{ trackId, trackName, albumId, artistName, progressMs, durationMs, isPlaying }`
- GET `/api/v2/playing-progress` → `{ progressMs, durationMs, isPlaying, deviceName? }`
- POST `/api/v2/scrobbles/batch-upsert` → batch sync from mobile (max 100 items)
- GET `/api/v2/scrobbles/recent?limit=50&before=iso&include=skips` → recent scrobbles with pagination
- GET `/api/v2/scrobbles/archive-ready?before=iso` → eligible for device archive (>83d)
- POST `/api/v2/scrobbles/ack-archive` → delete after device save
- GET `/api/v2/stats/summary` → `{ totalMinutes, totalScrobbles, uniqueArtistsCount }`
- GET `/api/v2/stats/top-albums?limit=10` → `[{ albumId, name, artist, albumArt, count }]`
- GET `/api/v2/stats/top-tracks?limit=10` → `[{ spotifyId, name, artist, count }]`

### Contracts
- **Pagination**: default limit=20 (max=100); `before` cursor for next page
- **Projection**: always `.select()` explicit fields + `.lean()`
- **Headers**: gzip + ETag on cacheable GETs; Cache-Control
- **Rate limits**: batch-upsert 10/s burst, 100/min per user; now-playing 30/min
- **Auth**: JWT required for all v2 endpoints (no x-user-id trust)

## V2 Data Model (Cloud)

### Collections
- **scrobbles_recent** (TTL 90d on playedAt):
  - Fields: userId, spotifyId, trackName, artistName, albumId, albumName, durationMs, playedAt, playedAtRounded10s, source, device, clientVersion, isScrobbled, isSkip, isPaused
  - Indexes: unique(userId, spotifyId, playedAtRounded10s); (userId, playedAt:-1); TTL(playedAt)
- **trackstats**:
  - Fields: userId, trackId, trackKey, trackName, artistName, albumName, albumArt, playCount, lastPlayedAt, replayGuardAt
  - Indexes: unique(userId, trackKey); (userId, playCount:-1); (userId, lastPlayedAt:-1)
- **albumstats**:
  - Fields: userId, albumId, albumKey, albumName, artistName, albumArt, totalTracks, playCount, albumPlayCount, uniqueTracksPlayed[], lastPlayedAt, lastCompletedAt
  - Indexes: unique(userId, albumKey); (userId, albumPlayCount:-1); (userId, lastPlayedAt:-1)
- **userstatssummaries**:
  - Fields: userId, totalMinutes, totalScrobbles, uniqueArtistsCount, lastScrobbled{spotifyId, trackName, artistName, albumName, playedAt}
  - Indexes: unique(userId)
- **reviews, reviewcomments**: as-is with existing indexes
- **cache.albums, cache.tracks** (optional, TTL 30d):
  - Minimal Spotify shapes with lastSeenAt for TTL

## Engineering Best Practices
- Always `.select()` minimal fields and `.lean()` on Mongoose queries
- Use deterministic keys: `albumKey = albumId || albumName`, `trackKey = spotifyId || artist+trackName`
- Idempotent operations: safe to retry/re-run
- JWT for auth; no x-user-id trust from clients
- Rate limit write endpoints (batch-upsert 10/s burst, 100/min)
- gzip + ETag on cacheable GETs
- Default pagination: limit=20 (max=100)
- Spotify calls: map to minimal shapes, cache hot lookups, never proxy raw responses
- Album logic: only process if `totalTracks >= 4`
- Replay guard: ignore same track if last play <15 min ago
- TTL cleanup: MongoDB handles via TTL index; device archive is primary long-term storage

## 🚨 CRITICAL: Terminal/Server Testing Rules

### NEVER do this (WRONG):
```bash
# ❌ BAD: Start server as background task, then run commands in same terminal
run_in_terminal("cd server; npm run dev", isBackground=true)
run_in_terminal("curl http://localhost:5000/ping")  # This STOPS the server first!
```

### ALWAYS do this (CORRECT):
```bash
# ✅ GOOD: Start server using VS Code task (separate terminal)
run_task(id="shell: Server")
# Wait for server to start
run_in_terminal("Start-Sleep -Seconds 8; curl http://localhost:5000/ping")
```

### Why This Matters:
- When you run a command in a terminal, PowerShell **stops any background process** first
- Server started with `isBackground=true` is **NOT in a separate terminal** - it's just backgrounded in the same session
- Next command in that terminal **kills the background server** before running
- **SOLUTION**: Always use `run_task()` for long-running servers - this creates a truly separate terminal

### Testing Servers Correctly:
1. **Start server**: Use `run_task(id="shell: Server")` (creates dedicated terminal)
2. **Wait**: Add `Start-Sleep -Seconds 5-8` before testing (server needs time to start)
3. **Test**: Run test commands in a **NEW terminal** (separate `run_in_terminal` call)
4. **Verify**: Check task output with `get_task_output()` to see server logs

### Example (Correct Flow):
```bash
# Step 1: Start server in dedicated terminal
run_task(id="shell: Server", workspaceFolder="...")

# Step 2: Wait and test in separate terminal
run_in_terminal("Start-Sleep -Seconds 8; curl http://localhost:5000/ping", isBackground=false)

# Step 3: Check server logs
get_task_output(id="shell: Server")
```

## V2 Implementation Roadmap (Fast Track)

### Phase 1: Server Foundation (Hours 1–6)
- Update models: add fields (playedAtRounded10s, isScrobbled, replayGuardAt, uniqueTracksPlayed), indexes
- Create `/server/src/routes/v2/` structure: index.ts, scrobbles.ts, stats.ts, track.ts, album.ts, artist.ts
- Implement batch-upsert with full logic (40% threshold, dedup, replay guard, album completion 70%)
- Add JWT middleware (mint/verify), gzip, ETag, rate-limit
- Create SpotifyService (getAlbumTotalTracks cached, minimal mappers)
- Wire v2 routes, add env flags (SCROBBLES_TTL_DAYS=90, FEATURE_FLAG_V2_ENABLED=1)
- Test locally: curl/Postman batch-upsert, verify dedup, album logic, stats endpoints

### Phase 2: Mobile Client (Hours 7–12)
- Update ScrobbleContext: local queue, 40% detection, calculate playedAtRounded10s, batch sync job (POST every 30s)
- Add archive job: on focus + charger/Wi-Fi, GET archive-ready, save SQLite, POST ack-archive
- Update SQLite schema for archive table
- Update home screen: skeleton + staggered calls (/v2/stats/summary, /v2/scrobbles/recent?limit=10, /v2/stats/albums?limit=5)
- Test: play tracks, verify queue, sync, stats update, archive flow

### Phase 3: UI Polish (Hours 13–16)
- Create MUI3 Paper screens: Home (stats cards), History (list), AlbumDetail (progress bar), Profile
- Use Paper elevation, rounded corners, consistent spacing
- Test incremental loading, verify payloads <30KB

### Phase 4: Deploy & Validate (Hours 17–20)
- Deploy server to Render with new env flags
- Smoke tests: auth, scrobble, stats, archive
- Monitor logs, payload sizes
- Final acceptance: no duplicates, album completion working, JWT auth, rate limits enforced

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

## 🚨 CRITICAL: Terminal/Server Testing Rules

### NEVER do this (WRONG):
```bash
# ❌ BAD: Start server as background task, then run commands in same terminal
run_in_terminal("cd server; npm run dev", isBackground=true)
run_in_terminal("curl http://localhost:5000/ping")  # This STOPS the server first!
```

### ALWAYS do this (CORRECT):
```bash
# ✅ GOOD: Start server using VS Code task (separate terminal)
run_task(id="shell: Server")
# Wait for server to start
run_in_terminal("Start-Sleep -Seconds 8; curl http://localhost:5000/ping")
```

### Why This Matters:
- When you run a command in a terminal, PowerShell **stops any background process** first
- Server started with `isBackground=true` is **NOT in a separate terminal** - it's just backgrounded in the same session
- Next command in that terminal **kills the background server** before running
- **SOLUTION**: Always use `run_task()` for long-running servers - this creates a truly separate terminal

### Testing Servers Correctly:
1. **Start server**: Use `run_task(id="shell: Server")` (creates dedicated terminal)
2. **Wait**: Add `Start-Sleep -Seconds 5-8` before testing (server needs time to start)
3. **Test**: Run test commands in a **NEW terminal** (separate `run_in_terminal` call)
4. **Verify**: Check task output with `get_task_output()` to see server logs

### Example (Correct Flow):
```bash
# Step 1: Start server in dedicated terminal
run_task(id="shell: Server", workspaceFolder="...")

# Step 2: Wait and test in separate terminal
run_in_terminal("Start-Sleep -Seconds 8; curl http://localhost:5000/ping", isBackground=false)

# Step 3: Check server logs
get_task_output(id="shell: Server")
```

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
