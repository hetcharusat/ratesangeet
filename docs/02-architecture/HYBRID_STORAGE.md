# Hybrid Storage README (Cloud + Local)

This document explains exactly what data we store in the cloud versus on-device, the models, schemas, APIs, sync rules, retention, and operational details.

## TL;DR
- Cloud: public/authoritative data (reviews, comments, favorites, follows) + compact album summaries per user + a recent window of scrobbles for feeds/social.
- Local: the full scrobble archive in SQLite for fast/offline history; device computes album deltas and pushes to cloud.
- Benefits: Cheaper cloud costs, faster local UX, privacy for long-tail history, still social and shareable.

---

## What lives in the Cloud

- Users/profiles and follow graph
- Reviews, comments, reactions (public content)
- Favorites (albums/tracks), ratings
- Album summaries per user (tiny):
  - Fields: albumId, albumName, artistName, albumArt, playCount, lastPlayedAt
  - Collection: `AlbumStats`
  - Indexes: `{ userId: 1, albumId: 1 } (unique)`, `{ userId: 1, playCount: -1 }`
- Recent scrobbles window for each user (for feeds/social and reconciliation)
  - Route-backed by `/api/music/sync-recent` from Spotify “Recently Played”
  - Suggested retention: last 90 days or last 5,000 plays (whichever larger)

### MongoDB Collections (relevant)

- `User`
- `Review`
- `ReviewComment`
- `Scrobble`
  - Unique index: `{ userId, spotifyId, playedAt }`
  - History index: `{ userId, playedAt: -1 }`
  - Retention: recommended rolling window in the cloud
- `AlbumStats` (new)
  - Schema: see Server Model below

---

## What stays Local (on-device)

- Full scrobble archive in SQLite (`expo-sqlite`)
- A small `meta` table for client cursors (e.g., last time album summaries were pushed)
- Device-side album aggregate computation used to push cloud deltas

### SQLite Schema (created at runtime)

- Database: `scrobbles.db`
- Tables
  - `meta(key TEXT PRIMARY KEY, value TEXT)`
  - `scrobbles(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotifyId TEXT NOT NULL,
      trackName TEXT,
      artistName TEXT,
      albumId TEXT,
      albumName TEXT,
      albumArt TEXT,
      durationMs INTEGER,
      playedAt INTEGER NOT NULL
    )`
- Indexes
  - `idx_scrobbles_playedAt` on `playedAt DESC`
  - `idx_scrobbles_spotifyId_playedAt` on `(spotifyId, playedAt DESC)`

---

## Server: New Model and Routes

### Model: `AlbumStats`
File: `server/src/models/AlbumStats.ts`

- Fields
  - `userId: string`
  - `albumId: string` (Spotify Album ID)
  - `albumName?: string`
  - `artistName?: string`
  - `albumArt?: string`
  - `playCount: number`
  - `lastPlayedAt?: Date`
  - Automatic: `createdAt`, `updatedAt`
- Indexes
  - Unique by `(userId, albumId)`
  - Secondary `{ userId: 1, playCount: -1 }` for leaderboards/top albums

### Routes: `server/src/routes/stats.ts`
- `POST /api/stats/album-batch-upsert`
  - Body: `{ userId: string, albums: Array<{ albumId, albumName?, artistName?, albumArt?, deltaCount, lastPlayedAt? }> }`
  - Batch upserts album stats: increments `playCount` by `deltaCount`; updates metadata and `lastPlayedAt`
- `GET /api/stats/album/:userId?limit=50`
  - Returns top albums for a user sorted by playCount and lastPlayedAt

### Existing Routes leveraged
- `POST /api/music/sync-recent` — paginated backfill from Spotify Recently Played (up to ~500 plays per open)
- `GET /api/music/scrobbles?userId=&limit=` — fetches recent cloud scrobbles

---

## Mobile: Local Storage Module

File: `mobile/src/storage/sqlite.ts`

- Initializes `scrobbles.db` and ensures tables/indexes
- APIs
  - `initLocalDb()` — open DB, run migrations
  - `saveScrobbles(items)` — bulk insert scrobbles
  - `getRecentScrobbles(limit)` — local query
  - Aggregations for cloud sync
    - `getAlbumAggregatesSince(sinceMs?)` — group by `albumId`, get counts and lastPlayedAt
  - Cursors
    - `getLastAlbumStatsPush()` / `setLastAlbumStatsPush(ms)` — track last push timestamp in `meta`

### Note on `albumId`
If a scrobble source lacks album ID but has album name, summaries will use empty albumId bucket. In practice, Spotify data includes album info for tracks; we can enhance to persist `albumId` end-to-end if needed.

---

## Sync Flow (when the app opens)

1) Backfill recent plays to cloud
   - Calls `POST /api/music/sync-recent` with current access token and `userId`.
   - Route paginates Spotify “Recently Played” with `after` cursor (based on latest known scrobble) up to 10 pages (~500 plays).
   - Cloud `Scrobble` collection dedupes by `{ userId, spotifyId, playedAt }`.

2) Mirror a slice of recent scrobbles locally
   - Fetches recent cloud scrobbles (e.g., last 200) and inserts into SQLite for fast UI and offline use.

3) Push album summary deltas
   - Compute album aggregates since `meta.lastAlbumStatsPush`.
   - POST to `/api/stats/album-batch-upsert` with `{ albumId, albumName, artistName, albumArt, deltaCount, lastPlayedAt }`.
   - Update `lastAlbumStatsPush` to now.

4) Foreground polling for live scrobbles
   - Every 30s, check `currently-playing`; if 50% of the track has been played, create cloud scrobble (`/api/music/scrobble`) and also insert into SQLite.

### Token refresh
- If Spotify returns 401, mobile refreshes the token on-device (PKCE-friendly) and retries.

### Offline handling
- If offline, local inserts still work (for scrobbles you add via app). Cloud backfill and album push are retried next launch.

---

## Retention & Privacy

- Cloud retains: Public entities (reviews/comments/etc.), album summaries for all time, and a recent scrobble window per user for feeds/social and reconcile.
- Local retains: All-time scrobble archive.
- Privacy: Long-tail raw listening history stays on the device by default. Social UIs draw from summaries and recent scrobbles.

### New archival policy (thin representation for older scrobbles)

- Goal: Keep album list and key stats in the cloud but reduce cloud storage by removing raw scrobble documents older than a retention window while preserving their contribution to aggregates.
- Default behavior implemented:
  - Keep full raw scrobbles in cloud for the most recent 90 days OR the most recent 200 plays per user (whichever is larger).
  - For scrobbles older than 90 days and beyond the most recent 200, the server will:
    1. Aggregate those scrobbles per album (or per albumName when albumId is missing).
    2. Upsert the aggregated counts into `AlbumStats` (increments playCount and updates lastPlayedAt).
    3. Increment per-user `UserStatsSummary.totalScrobbles` by the archived count and ensure `lastScrobbled` is set to the most recent scrobble overall.
    4. Delete the raw scrobble documents that were aggregated.

This preserves the "number of times" and album-level presence in cloud while freeing space used by raw playback rows.

### How to run/archive

- There is a job script: `server/src/jobs/archiveScrobbles.ts`.
- Run it locally or from cron/worker with:

```bash
# from the server folder
npm run archive
```

- Environment variables:
  - `ARCHIVE_RETENTION_DAYS` (default 90)
  - `ARCHIVE_KEEP_RECENT` (default 200)
  - `ARCHIVE_DRY_RUN` (set to `1` to perform a dry run without deleting)

### Safety and correctness

- The job is idempotent: re-running with the same inputs will not double-count because it aggregates counts and then deletes the source rows.
- Use `ARCHIVE_DRY_RUN=1` first to see logs and counts before actual deletion.


---

## Size & Cost Estimates

- Scrobble doc: ~300–500 bytes. 10k plays ≈ 3–5 MB per user.
- Summaries: ~100 bytes per album entry; a heavy user with 2k albums ≈ ~200 KB.
- Result: Cloud storage dominated by public content + tiny summaries; raw history kept local.

---

## How to Run with Hybrid Storage

1) Start server (watches and prints LAN URLs):
   - `cd server; npm run dev`
   - Note the printed address, e.g. `http://192.168.42.205:5000`
2) Start mobile Dev Client with tunnel and correct API URL:
   - Set env for the session: `EXPO_PUBLIC_API_URL=http://<LAN-IP>:<PORT>/api`, `EXPO_PUBLIC_USE_PROXY=false`
   - `npx expo start --dev-client --tunnel`
3) Log in with Spotify (PKCE on-device). On first open, backfill + local mirror + album push will run automatically.

---

## Error Handling & Edge Cases

- Spotify 401 → refresh token flow is automatic and retried.
- Recently Played gaps → route paginates with `after`; dedupe prevents double counts.
- Albumless tracks → aggregate bucket uses empty `albumId`; we can enhance to always set albumId from Spotify track.album.id.
- Double-count risk in deltas → periodic server reconcile (optional) using recent window ensures consistency.
- Multi-device → Summaries are additive/authoritative in cloud; local archives don’t conflict.

---

## Migration Notes

- No destructive migration required.
- New `AlbumStats` collection starts empty; deltas begin populating on next app open.
- Existing scrobbles remain; recent backfills continue to function.

---

## Related Code Pointers

- Server
  - `server/src/models/AlbumStats.ts`
  - `server/src/routes/stats.ts`
  - `server/src/routes/music.ts` (sync-recent, scrobble, stats)
  - `server/src/index.ts` (mounts `/api/stats`)
- Mobile
  - `mobile/src/storage/sqlite.ts`
  - `mobile/src/context/ScrobbleContext.tsx` (init backfill, local mirror, album delta push, live scrobble save)
  - `mobile/src/services/api.ts` (album stats APIs)

---

## Optional Next Steps

- Background task to periodically push album deltas and rotate local cleanup.
- Server retention job to prune old scrobbles beyond window.
- UI: Top Albums screen powered by `/api/stats/album/:userId`.
- Persist `albumId` in local saves for perfect aggregation.
