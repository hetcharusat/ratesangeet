# Scrobbling v2 Plan — Client-Side Detection, Album Completion & Efficient Sync

This document defines the complete scrobbling system redesign based on client-side detection, batch upsert patterns, 4-track album minimum, 70% completion logic, replay protection, and 90-day cloud TTL. It integrates the v2 API spec, audit findings, existing models, and the hybrid storage philosophy.

---

## Goals
- **Client-side scrobble detection**: 40–50% threshold or ≥30s playback.
- **Efficient batch sync**: mobile queues and syncs in batches via `/api/v2/scrobbles/batch-upsert`.
- **Album-level tracking**: only albums with ≥4 tracks; 70% unique tracks = completion; replays after full completion increment `albumPlayCount` again.
- **Idempotent upserts**: `(userId, trackKey)` and `(userId, albumKey)` unique; server prevents duplicates, handles replays.
- **90-day cloud retention**: TTL on `scrobbles_recent`; device archives older ones locally via SQLite.
- **Minimal, fast payloads**: always `.select()` + `.lean()`, gzip, ETag, pagination.
- **Modularity**: easy extension to playlists, artists, or other media types later.

---

## Philosophy Recap
- **Scrobble = 40–50% threshold or ≥30s** (client calculates this).
- **Batch sync**: client stores locally, POSTs array to server periodically.
- **Server deduplicates**: uses rounded timestamps and unique indexes.
- **Album completion**: only if ≥4 tracks; ≥70% unique tracks played = completion increment.
- **Replay detection**: ignore replays within 15 min same track; allow new completion cycle once 70% replayed.
- **TTL cleanup**: MongoDB TTL on `playedAt`; device pulls & archives before expiration.
- **Zero metadata duplication**: rely on keys, summaries, optional caches.

---

## Data Model (v2)

### scrobbles_recent (cloud, 90-day TTL)
Fields:
- `userId` (string, indexed)
- `spotifyId` (string)
- `trackName`, `artistName`, `albumId?`, `albumName?`, `albumArt?`
- `durationMs` (number)
- `playedAt` (Date, indexed with TTL)
- `playedAtRounded10s` (Date) — for deduplication
- `source` (enum: 'spotify')
- `device?` (string)
- `clientVersion?` (string)
- `isScrobbled` (boolean) — true if >=40% played
- `isSkip?` (boolean)
- `isPaused?` (boolean)

Indexes:
- unique: `(userId, spotifyId, playedAtRounded10s)`
- query: `(userId, playedAt: -1)`
- TTL: `playedAt` + 90 days

Notes:
- Minimal shape; no redundant metadata.
- Client calculates `playedAtRounded10s` = floor(startedAtMs / 10000) * 10000 to ensure stable dedup key.
- Server upserts by unique key; `$setOnInsert` for immutable fields, `$set` for metadata that might change.

### trackstats (cloud, no TTL)
Fields:
- `userId`, `trackId?`, `trackKey` (trackId || trackName+artistName), `trackName?`, `artistName?`, `albumName?`, `albumArt?`
- `playCount` (number) — increments each valid scrobble
- `lastPlayedAt` (Date)
- `replayGuardAt?` (Date) — used to ignore replays within 15 min

Indexes:
- unique: `(userId, trackKey)`
- query: `(userId, playCount: -1)`, `(userId, lastPlayedAt: -1)`

Logic:
- Upsert on `(userId, trackKey)`.
- Increment `playCount` only if `lastPlayedAt` is `null` OR `(now - lastPlayedAt) > 15 min`.
- Always update `lastPlayedAt`.

### albumstats (cloud, no TTL)
Fields:
- `userId`, `albumId?`, `albumKey` (albumId || albumName), `albumName?`, `artistName?`, `albumArt?`
- `totalTracks` (number) — fetched once from Spotify (cached)
- `playCount` (number) — every scrobble from this album increments it
- `albumPlayCount` (number) — increments each time user completes 70% unique tracks
- `uniqueTracksPlayed` (string[]) — current cycle unique track IDs
- `lastPlayedAt` (Date)
- `lastCompletedAt?` (Date)
- `progressPercent` (computed, not stored: `uniqueTracksPlayed.length / totalTracks * 100`)

Indexes:
- unique: `(userId, albumKey)`
- query: `(userId, albumPlayCount: -1)`, `(userId, lastPlayedAt: -1)`

Logic:
1. Only process albums with `totalTracks >= 4` (fetch once if missing).
2. On scrobble:
   - Increment `playCount`.
   - Add trackId to `uniqueTracksPlayed` if not present.
   - Compute progress = `uniqueTracksPlayed.length / totalTracks`.
   - If progress >= 0.7:
     - Increment `albumPlayCount`.
     - Set `lastCompletedAt` = now.
     - Clear `uniqueTracksPlayed` to start new cycle.
3. Ignore albums with <4 tracks (skip upsert entirely).

### userstatssummaries (cloud)
Fields:
- `userId`, `totalMinutes`, `totalScrobbles`, `uniqueArtistsCount`
- `lastScrobbled?` (object: { spotifyId, trackName, artistName, albumName, playedAt })

Indexes:
- unique: `userId`

Logic:
- Increment `totalScrobbles` per valid scrobble.
- Compute `totalMinutes` from `durationMs` (optional, or derive from scrobbles_recent aggregate).

### cache.albums, cache.tracks (optional, TTL 30d)
- Minimal Spotify shapes: id, name, artist, imageSmall, totalTracks (albums only), lastSeenAt.
- Reduce Spotify API calls for hot albums/tracks.

---

## API v2 Contracts

### POST /api/v2/scrobbles/batch-upsert
**Auth**: JWT required

**Request**:
```json
{
  "items": [
    {
      "spotifyId": "...",
      "trackName": "...",
      "artistName": "...",
      "albumId": "...",
      "albumName": "...",
      "durationMs": 240000,
      "progressMs": 120000,
      "playedAt": "2025-11-12T10:00:00Z",
      "source": "spotify",
      "device": "iPhone 14",
      "clientVersion": "1.0.0",
      "idempotencyKey": "abc123"
    }
  ]
}
```

**Server Logic**:
1. For each item:
   - Validate: `progressMs / durationMs >= 0.4` OR `progressMs >= 30000` → `isScrobbled = true`.
   - Calculate `playedAtRounded10s` = floor((playedAt.getTime() - progressMs) / 10000) * 10000.
   - Upsert `scrobbles_recent` by `(userId, spotifyId, playedAtRounded10s)`.
   - If `isScrobbled`:
     - Upsert `trackstats` by `(userId, trackKey)`:
       - Increment `playCount` if last play was >15min ago or null.
       - Always update `lastPlayedAt`.
     - Fetch album totalTracks (once, cache); skip if <4 tracks.
     - Upsert `albumstats` by `(userId, albumKey)`:
       - Increment `playCount`.
       - Add trackId to `uniqueTracksPlayed` (set).
       - Check progress: if >= 70%, increment `albumPlayCount`, clear `uniqueTracksPlayed`, set `lastCompletedAt`.
     - Increment `userstatssummaries.totalScrobbles`.

2. Return:
```json
{
  "ok": true,
  "processed": 10,
  "scrobbled": 8,
  "duplicates": 2,
  "errors": []
}
```

**Rate limit**: 10/sec burst, 100/min per user.

---

### GET /api/v2/stats/tracks?limit=20&cursor=...
**Auth**: JWT required

**Response**:
```json
{
  "tracks": [
    { "trackId": "...", "trackName": "...", "artistName": "...", "playCount": 42, "lastPlayedAt": "..." }
  ],
  "nextCursor": "..."
}
```

**Logic**:
- Query `trackstats` by `userId`, sort by `playCount: -1` or `lastPlayedAt: -1` (default recent).
- `.select('trackId trackName artistName playCount lastPlayedAt').lean()`.

---

### GET /api/v2/stats/albums?limit=20&cursor=...
**Auth**: JWT required

**Response**:
```json
{
  "albums": [
    {
      "albumId": "...",
      "albumName": "...",
      "artistName": "...",
      "totalTracks": 11,
      "playCount": 25,
      "albumPlayCount": 2,
      "progressPercent": 81,
      "uniqueTracksPlayed": 9,
      "lastPlayedAt": "...",
      "lastCompletedAt": "..."
    }
  ],
  "nextCursor": "..."
}
```

**Logic**:
- Query `albumstats` by `userId`, sort by `albumPlayCount: -1` or `lastPlayedAt: -1`.
- Compute `progressPercent` = `uniqueTracksPlayed.length / totalTracks * 100`.
- Filter: only return albums with `totalTracks >= 4`.

---

### GET /api/v2/stats/summary
**Auth**: JWT required

**Response**:
```json
{
  "totalMinutes": 12340,
  "totalScrobbles": 5678,
  "uniqueArtistsCount": 234,
  "lastScrobbled": {
    "spotifyId": "...",
    "trackName": "...",
    "artistName": "...",
    "albumName": "...",
    "playedAt": "..."
  }
}
```

**Logic**:
- Read from `userstatssummaries` by `userId`.
- `.select('totalMinutes totalScrobbles uniqueArtistsCount lastScrobbled').lean()`.

---

### GET /api/v2/scrobbles/recent?limit=50&before=iso&include=skips
**Auth**: JWT required

**Response**:
```json
{
  "items": [
    {
      "id": "...",
      "spotifyId": "...",
      "trackName": "...",
      "artistName": "...",
      "albumId": "...",
      "albumName": "...",
      "durationMs": 240000,
      "playedAt": "...",
      "source": "spotify",
      "isScrobbled": true,
      "isSkip": false
    }
  ],
  "nextBefore": "..."
}
```

**Logic**:
- Query `scrobbles_recent` by `userId`, `playedAt < before`, limit.
- Default excludes `isSkip: true`; `include=skips` to include.
- `.select('spotifyId trackName artistName albumId albumName durationMs playedAt source isScrobbled isSkip').lean()`.

---

### GET /api/v2/scrobbles/archive-ready?before=iso
**Auth**: JWT required

**Response**:
```json
{
  "items": [...],
  "nextBefore": "..."
}
```

**Logic**:
- Query scrobbles where `playedAt < (now - 83 days)` (grace window 7d before TTL).
- Batch size 500–1000.

---

### POST /api/v2/scrobbles/ack-archive
**Auth**: JWT required

**Request**:
```json
{
  "ids": ["scrobbleId1", "scrobbleId2", ...]
}
```

**Response**:
```json
{
  "ok": true,
  "deleted": 123
}
```

**Logic**:
- `Scrobble.deleteMany({ _id: { $in: ids }, userId })`.
- Idempotent; missing IDs ignored.

---

## Mobile Client Changes

### Local Scrobble Detection
- On playback progress updates:
  - Check if `progressMs / durationMs >= 0.4` OR `progressMs >= 30000`.
  - If true and not already flagged this session → queue scrobble.
  - Store in local queue (in-memory array or SQLite temp table).
  - Calculate `playedAtRounded10s` = floor((timestamp - progressMs) / 10000) * 10000.

### Batch Sync
- Every 30s or on app background (whichever first):
  - POST queued scrobbles to `/api/v2/scrobbles/batch-upsert` (max 100 per request).
  - On success, clear queued items.
  - On failure (network, 5xx), retry with exponential backoff.

### Archive Job
- On app foreground + (charger OR Wi-Fi):
  - GET `/api/v2/scrobbles/archive-ready?before=now-7d`.
  - Write to local SQLite `scrobbles_archive` table in transaction.
  - POST `/api/v2/scrobbles/ack-archive` with pulled IDs.
  - Server deletes; TTL is safety net.

### Home Screen Loading
- Skeleton first.
- Staggered calls (parallel with short timeouts):
  - `/api/v2/stats/summary` → header stats tile
  - `/api/v2/scrobbles/recent?limit=10` → recent activity widget
  - `/api/v2/stats/albums?limit=5` → top albums widget
  - `/api/v2/now-playing` → optional, polled only when visible

---

## Server Implementation Changes

### Models (updates to existing)

**TrackStats.ts**:
- Add field: `replayGuardAt?: Date` (not indexed; used in logic only).
- Logic in upsert: if `lastPlayedAt` exists and `(now - lastPlayedAt) < 15 min`, skip `$inc playCount`.

**AlbumStats.ts** (already has most fields):
- Rename `currentCycleUniqueTrackIds` → `uniqueTracksPlayed` (array of strings).
- Add computed field in API response: `progressPercent`.
- Logic: only process if `totalTracks >= 4`.

**Scrobble.ts** (rename to ScrobbleRecent.ts or keep):
- Add fields: `playedAtRounded10s`, `isScrobbled`, `isSkip?`, `isPaused?`, `device?`, `clientVersion?`.
- Update unique index: `(userId, spotifyId, playedAtRounded10s)`.
- Add TTL index: `playedAt` + 90 days (7776000s).

### Routes (new v2 structure)

**server/src/routes/v2/scrobbles.ts**:
- POST `/batch-upsert` → main sync endpoint.
- GET `/recent` → recent scrobbles with pagination.
- GET `/archive-ready` → eligible for device archive.
- POST `/ack-archive` → delete after device save.

**server/src/routes/v2/stats.ts**:
- GET `/tracks` → trackstats with pagination.
- GET `/albums` → albumstats with progress & completion.
- GET `/summary` → userstatssummaries.

**server/src/routes/v2/index.ts**:
- Mount all v2 routes under `/api/v2`.

### Middleware
- JWT auth (requireAuth) on all v2 endpoints.
- Rate limiting on `/batch-upsert`: 10/sec burst, 100/min.
- gzip + ETag on cacheable GETs.

### Helpers

**SpotifyService.ts** (new or refactor existing):
- `getAlbumTotalTracks(albumId, accessToken)` → cached lookup.
- Map to minimal shapes; no proxy dumps.

**AlbumCompletionLogic.ts** (utility):
- `shouldIncrementCompletion(uniqueTracksPlayed, totalTracks)` → returns true if >= 70%.
- `resetCycleIfNeeded(lastCompletedAt)` → optional 30-day idle reset.

---

## Background Jobs

### Archive Eligibility Marker (optional)
- Daily cron: flag scrobbles older than 83 days for device pull.
- Not strictly necessary; client can query `playedAt < now-83d` directly.

### TTL Cleanup
- MongoDB TTL index handles automatic deletion after 90 days.

---

## Migration & Rollout (2 weeks)

### Phase 1: Server foundation (Days 1–3)
- Update models: add fields, indexes (idempotent index creation on boot).
- Implement `/api/v2/scrobbles/batch-upsert` with full logic.
- Implement `/api/v2/stats/*` endpoints.
- Add JWT middleware and rate limits.
- Deploy to staging.

### Phase 2: Mobile client (Days 4–6)
- Local scrobble detection (40% threshold).
- Batch queue + sync job.
- Archive job (pull, save, ack).
- Update home screen to use v2 stats endpoints.

### Phase 3: Dual-write testing (Days 7–9)
- Run v1 and v2 scrobble paths in parallel (feature flag).
- Compare stats parity.
- Fix discrepancies.

### Phase 4: Cutover (Days 10–12)
- Flip to v2 only (disable v1 scrobble path).
- Monitor error rates, payload sizes, latency.
- Soak for 48 hours.

### Phase 5: Cleanup (Days 13–14)
- Remove v1 scrobble route.
- Drop or archive old `Scrobble` collection if replaced by `scrobbles_recent`.
- Finalize docs.

---

## Acceptance Criteria
- Client detects scrobbles at 40–50% or ≥30s; syncs in batches with <1% duplicate rate.
- Server enforces unique `(userId, spotifyId, playedAtRounded10s)`; no duplicate scrobbles.
- Albums with <4 tracks ignored; albums with ≥4 tracks tracked with 70% completion logic.
- Replay within 15 min ignored for `playCount`; new cycle after 70% replayed increments `albumPlayCount`.
- 90-day cloud retention; device archives older scrobbles locally; TTL safety net works.
- Stats endpoints return minimal shapes (≤30 KB typical); pagination working.
- Home screen skeleton instant; first data tile <1.5s on average network.

---

## Testing Plan
- Unit tests: album completion logic (4-track min, 70% threshold, replay detection).
- Integration tests: batch-upsert idempotency, dedup by rounded timestamp.
- Load tests: 1000 concurrent users, 10 scrobbles/sec each; confirm no duplicates.
- Mobile tests: offline queue, retry logic, archive sync.

---

## Future Extensions
- **Playlists**: similar logic (track uniqueness, progress, completion).
- **Artists**: aggregate plays across albums/tracks.
- **Skip/pause analytics**: use `isSkip`, `isPaused` flags for insights.
- **Idle reset**: optional 30-day no-play resets partial progress.

---

## References
- docs/02-architecture/V2_SYSTEM_DESIGN.md
- docs/03-features/API_V2_SPEC.md
- docs/08-audits/DATABASE_REBUILD_CUTOVER_PLAN.md
- docs/08-audits/DATABASE_AUDIT_REPORT.md
- docs/08-audits/API_ENDPOINTS_AUDIT_REPORT.md
- server/src/models/TrackStats.ts, AlbumStats.ts, Scrobble.ts
- server/src/routes/music.ts (existing scrobble logic)
