# Database Rebuild & Cutover Plan (v2)

Goal: Drop the existing DB safely after migrating to a lean, v2 schema that matches our product rules and minimizes API payloads. No downtime beyond a brief cutover window; fully reversible until we delete v1.

## Principles
- Keep recent scrobbles in cloud with TTL (hybrid storage): set `CLOUD_ENABLE_SCROBBLES=true` and `SCROBBLES_TTL_DAYS=90` in prod.
- Cloud = recent scrobbles (90d), summaries + public/social data: Reviews, Comments, AlbumStats, TrackStats, UserStatsSummary, ServerStats.
- Blue/green approach: stand up `ratesangeet_v2` (or separate cluster), dual‑write, backfill, verify, then cutover and decommission v1.
- Idempotent writes and deterministic aggregation keys: `albumKey = albumId || albumName`, `trackKey = spotifyId || artist+trackName`.
- Strict projections on all read APIs, pagination by default, and small shapes only.

## Target v2 collections (cloud)
- users: core profile only (no tokens in cleartext)
- reviews
- reviewcomments
- albumstats (per-user album scrobble counts, unique tracks, optional totalTimeMs)
- trackstats (per-user track counts; optional totalTimeMs)
- userstatssummaries (per-user totals)
- serverstats (uptime, pings)
- cache: albums, tracks (optional, TTL index 7–30 days; minimal shape: id, name, primary artist, smallest image)

- scrobbles_recent (raw, minimal scrobbles with 90d TTL)
  - Fields: userId, spotifyId, trackName, artistName, albumId, albumName, durationMs, playedAt, source, device?, clientVersion?, isScrobbled, isSkip?, isPaused?
  - Indexes:
    - unique: (userId, spotifyId, playedAtRounded10s)
    - query: (userId, playedAt: -1)
    - TTL: `playedAt` + `SCROBBLES_TTL_DAYS` (default 90d)

Notes:
- Store raw scrobbles in cloud only for the recent window (default 90 days). Local SQLite keeps the long‑term archive.
- Devices periodically archive old scrobbles locally and ACK deletion server‑side; TTL is a safety net.

## Index & constraints (minimum)
- reviews: unique(userId, itemId, itemType), idx(createdAt desc)
- reviewcomments: idx(reviewId, createdAt), idx(userId, createdAt)
- albumstats: unique(userId, albumKey)
- trackstats: unique(userId, trackKey)
- userstatssummaries: unique(userId)
- cache.albums: unique(albumId), TTL lastSeenAt (optional)
- cache.tracks: unique(spotifyId), TTL lastSeenAt (optional)
- scrobbles_recent: unique(userId, spotifyId, playedAtRounded10s); TTL index on `playedAt`

## API payload slimming (contract)
- Always `.select()` explicit fields and `.lean()`.
- Default pagination: `limit=20`, `max=100`; include `cursor` or `nextToken`.
- Support `fields=` query to opt‑in extra fields (whitelist only).
- Enable `gzip` (Express `compression`) and add `ETag` for cacheable GETs.
- SLOs: typical payload ≤ 30 KB; single list page ≤ 100 KB.

## Cutover phases

1) Prepare (Day 0)
- Backup v1
  - Atlas snapshot OR
  - `mongodump` for the v1 database.
- Provision v2
  - New DB name (e.g., `ratesangeet_v2`) in the same cluster.
  - Create v2 collections with indexes.
- Config
  - Add `MONGODB_URI_V2` to server `.env`.
  - Add `FEATURE_FLAG_DUAL_WRITE=1`.
  - Set `CLOUD_ENABLE_SCROBBLES=true` and `SCROBBLES_TTL_DAYS=90`.

2) Dual‑write + Read‑from‑v1 (Day 1)
- Update server to:
  - Write new data paths (reviews, comments, stats, scrobbles_recent) to both v1 and v2.
  - Continue reading from v1 for all endpoints.
- Monitor write parity (log deltas; error budget near 0).

3) Backfill (Day 1–2)
- Run `backfill-v2-stats.ts`:
  - Scan v1 albumstats/trackstats/userstatssummaries in batches (e.g., 1k docs/iter, 4 workers).
  - Idempotent upserts into v2 with proper keys and indexes.
  - Log progress and verify counts.
- Optional cache warmup for popular albums/tracks (minimal shape).
 - Optional: mark archive‑eligible scrobbles (e.g., D+83) for device sync testing.

4) Read flip (Day 3)
- Feature flag: switch reads for stats/reviews/comments to v2.
- Keep dual‑write ON for 24–48 hours.
- Verify API payload size reductions and correctness.
 - Verify scrobble flows: recent reads from v2; device archive pull/ack path works.

5) Freeze v1 (Day 4)
- Turn dual‑write OFF.
- Set v1 to read‑only (role policy or app‑level guard).
- Keep v1 for 7–14 days in case of rollback.

6) Decommission v1 (Day 14+)
- Final backup of v1.
- Drop v1 database with an approval gate.

## Rollback plan
- If any critical regression:
  - Flip reads back to v1.
  - Re‑enable dual‑write and reconcile any drift (re‑run backfill for affected ranges).
  - Root cause; fix; retry cutover.

## Operational runbooks

Backup (optional examples)
```powershell
# Export v1 (adjust URI/DB)
$env:MONGODB_URI="<atlas-conn-string>"
$env:DB_NAME="ratesangeet"
mongodump --uri $env:MONGODB_URI --db $env:DB_NAME --out ./backup-$(Get-Date -Format yyyyMMdd-HHmm)
```

Create v2 and indexes (mongosh snippets)
```javascript
use ratesangeet_v2;

db.createCollection('albumstats');
db.albumstats.createIndex({ userId: 1, albumKey: 1 }, { unique: true });

db.createCollection('trackstats');
db.trackstats.createIndex({ userId: 1, trackKey: 1 }, { unique: true });

db.createCollection('userstatssummaries');
db.userstatssummaries.createIndex({ userId: 1 }, { unique: true });

// Reviews
 db.createCollection('reviews');
 db.reviews.createIndex({ userId: 1, itemId: 1, itemType: 1 }, { unique: true });
 db.reviews.createIndex({ createdAt: -1 });

// Review comments
 db.createCollection('reviewcomments');
 db.reviewcomments.createIndex({ reviewId: 1, createdAt: -1 });
 db.reviewcomments.createIndex({ userId: 1, createdAt: -1 });

// Optional caches with TTL
 db.createCollection('cache.albums');
 db['cache.albums'].createIndex({ albumId: 1 }, { unique: true });
 db['cache.albums'].createIndex({ lastSeenAt: 1 }, { expireAfterSeconds: 2592000 }); // 30d

 db.createCollection('cache.tracks');
 db['cache.tracks'].createIndex({ spotifyId: 1 }, { unique: true });
 db['cache.tracks'].createIndex({ lastSeenAt: 1 }, { expireAfterSeconds: 2592000 }); // 30d

// Recent scrobbles (90d TTL)
db.createCollection('scrobbles_recent');
db.scrobbles_recent.createIndex({ userId: 1, spotifyId: 1, playedAtRounded10s: 1 }, { unique: true });
db.scrobbles_recent.createIndex({ userId: 1, playedAt: -1 });
// TTL on playedAt: SCROBBLES_TTL_DAYS env controls intended policy; set to 90d here (7776000s)
db.scrobbles_recent.createIndex({ playedAt: 1 }, { expireAfterSeconds: 7776000 });
```

Feature flags & env (server/.env)
```
MONGODB_URI_V2=mongodb+srv://.../ratesangeet_v2
FEATURE_FLAG_DUAL_WRITE=1
CLOUD_ENABLE_SCROBBLES=true
SCROBBLES_TTL_DAYS=90
```

## Backfill script outline (server/backfill-v2-stats.ts)
- Read v1 stats in batches with `.lean()` and `.select()` minimal fields.
- Map to v2 keys (`albumKey`, `trackKey`).
- Upsert with unique indexes; retry on E11000.
- Progress logging every N docs; final consistency report by user.

## Acceptance criteria
- All write endpoints keep working during dual‑write.
- Stats endpoints read from v2 and match v1 counts within 0.5%.
- Average response payload shrinks by ≥30%.
- Recent raw scrobbles retained in v2 for 90 days with successful device archive + ack (no missed >7d grace).

## Drop procedure (final)
- Confirm: v2 is primary for ≥7 days, no errors.
- Take a final v1 backup.
- Drop v1 DB via mongosh after two‑person review.

## Notes on security
- Move to JWT (short‑lived) for identity; stop trusting x-user-id from clients.
- Encrypt or hash any stored third‑party tokens.
- Add rate limiting on auth and write paths.
