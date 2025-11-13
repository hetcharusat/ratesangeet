# V2 System Design — Lean, Fast, and Hybrid

This document consolidates all audits and decisions into a single, executable plan for a faster app and a lean backend. It emphasizes: tiny payloads, 90-day cloud scrobbles with device archive, no duplication, and incremental UI loading.

## Goals
- Keep the app snappy with small, focused API responses and incremental loading.
- Keep recent scrobbles in cloud for 90 days; archive to device after that.
- Remove data duplication; rely on keys and summaries, not repeated metadata.
- Avoid proxying large Spotify JSON responses; map to minimal shapes.
- Strengthen auth (JWT), rate-limit writes, and reduce server costs.

## Key decisions
- Hybrid storage: Cloud keeps 90 days of scrobbles (TTL), device keeps long‑term archive in SQLite.
- Minimal cloud schema: stats/summaries, reviews/comments, recent scrobbles, optional caches.
- Deterministic keys: albumKey = albumId || albumName; trackKey = spotifyId || artist+trackName.
- API v2 returns only needed fields; default pagination; gzip + ETag.
- Background jobs handle archive eligibility and cleanups; no heavy per-request work.
- JWT replaces x-user-id; tokens encrypted at rest; rate limits added.

## Architecture overview
- Mobile app (React Native + Expo):
  - Scrobble detection client-side; sync to server in batches.
  - Archive job: pulls eligible scrobbles (> ~83 days), stores in SQLite, ACKs delete.
  - Home screen: skeleton + staggered small calls.
- Backend (Node + Express + TypeScript):
  - API v2 endpoints (track/album/artist/credits/now-playing/progress/scrobbles/stats) with small shapes.
  - SpotifyService wrappers shape data before returning; optional caches with TTL.
  - Background jobs: archive eligibility marking, daily TTL checks.
- MongoDB Atlas (cloud):
  - Collections: users, reviews, reviewcomments, albumstats, trackstats, userstatssummaries, serverstats, scrobbles_recent, cache.albums, cache.tracks.

## Data model (cloud)
- scrobbles_recent (90-day TTL on playedAt):
  - { userId, spotifyId, trackName, artistName, albumId, albumName, durationMs, playedAt, source, device?, clientVersion?, isScrobbled, isSkip?, isPaused?, playedAtRounded10s }
  - Indexes: unique(userId, spotifyId, playedAtRounded10s); (userId, playedAt -1); TTL(playedAt)
- albumstats: unique(userId, albumKey) — { listenedTracks, totalTracks, count, totalTimeMs? }
- trackstats: unique(userId, trackKey) — { count, totalTimeMs? }
- userstatssummaries: unique(userId) — { totalMinutes, totalScrobbles, uniqueArtistsCount }
- reviews, reviewcomments: as-is with indexes
- caches (optional): cache.albums, cache.tracks with unique keys and TTL on lastSeenAt

## API v2 (minimal responses)
- Track GET: { id, name, albumId, albumName, artistId, artistName, durationMs }
- Album GET: { id, name, artistName, totalTracks, imageSmall }
- Artist GET: { id, name, imageSmall }
- Credits GET: { trackId, artists:[{ id, name, role }], producers?, writers? }
- Now playing: { trackId, trackName, albumId, artistName, progressMs, durationMs, isPlaying }
- Playing progress: { progressMs, durationMs, isPlaying, deviceName? }
- Scrobble POST/Batch: inputs minimal; server dedup + threshold; updates scrobbles_recent + stats.
- Recent scrobbles GET: last N with minimal fields; supports before cursor.
- Archive-ready GET + ack POST: device archive flow.
- Stats summary/top lists: tiny aggregates.

API behavior
- Default pagination limit=20 (max=100); `.select()` and `.lean()` always.
- fields= whitelists; include= controlled expansions.
- gzip + ETag on cacheable GETs; 10–30s in-memory cache for hot queries.
- Rate limits on scrobble write paths; idempotent upserts.

## Background jobs
- Archive eligibility marker: daily; marks scrobbles older than (TTL - grace) for device pull.
- TTL cleanup: relies on Mongo TTL for playedAt; device ack deletes earlier.
- Optional home snapshot precompute for faster first-paint (very small aggregates).

## Mobile experience
- Skeleton-first render; staggered small calls:
  - /stats/summary → first tile
  - /scrobbles/recent?limit=10 → history fold
  - /stats/top-albums?limit=5 → highlights
  - /now-playing → only when visible and app active
- Archive job: runs on app focus, on charger + Wi‑Fi, or on schedule; transactional writes to SQLite; ACK deletes.
- Offline-first: device queues scrobbles and retries; server is idempotent.

## Security & reliability
- JWT for auth; short-lived access + refresh rotation; no x-user-id trust.
- Encrypt/secure any external tokens; avoid plaintext.
- Rate limiting and basic anomaly detection on write endpoints.
- Observability: request IDs, structured logs on hot paths.

## Performance guardrails
- SLO: typical payload ≤ 30 KB; list page ≤ 100 KB.
- Hot paths must run in ≤ 100ms server-side when cache hit; ≤ 300ms on cache miss.
- Spotify calls batched and cached; never per-item in hot paths.

## Rollout plan (two weeks)
- D1–2: SpotifyService mappers + caches; v2 endpoints (GET track/album/artist/credits)
- D3–4: scrobbles_recent + write path; dual-write stats
- D5–6: archive-ready + ack + mobile archive job
- D7–8: home widgets incremental loading; gzip/ETag; rate limits
- D9–10: backfill + parity checks; load tests
- D11: READ_FROM_V2=1; monitor; keep dual-write
- D12–13: soak + fix edges; security review
- D14+: freeze v1; plan drop after 14 days

## Acceptance criteria
- Home skeleton instantly; first data tile in < 1.5s on average network.
- 90-day cloud scrobble retention; device archive + ack verified.
- Stats parity within 0.5% vs v1; no duplicate scrobbles due to unique key.
- Spotify payloads never passed raw; only mapped minimal shapes returned.
- All write endpoints require JWT; tokens stored securely.
