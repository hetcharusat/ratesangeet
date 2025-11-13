# API v2 Spec — Minimal, Fast, and Focused

All endpoints return tiny JSONs with only the fields the app needs. Defaults: pagination limit=20 (max=100), `.select()` + `.lean()`, gzip + ETag on cacheable GETs.

Auth: JWT required for write operations and user-specific reads. No trust in x-user-id. Rate limits applied to scrobble endpoints.

## Conventions
- Query: `limit`, `before` (ISO or cursor), `fields` (whitelist), `include` (controlled expansions)
- IDs match Spotify where applicable (trackId = spotifyId, albumId = Spotify album id)
- Keys: albumKey = albumId || albumName; trackKey = spotifyId || artist+trackName

## Tracks
- GET /api/v2/track/:id
  - Response: `{ id, name, albumId, albumName, artistId, artistName, durationMs }`
  - Caching: ETag, 10–60s. May hydrate from `cache.tracks`.

## Albums
- GET /api/v2/album/:id
  - Response: `{ id, name, artistName, totalTracks, imageSmall }`
  - Caching: ETag, 10–60s. May hydrate from `cache.albums`.

## Artists
- GET /api/v2/artist/:id
  - Response: `{ id, name, imageSmall }`
  - Caching: ETag, 10–60s.

## Credits
- GET /api/v2/credits/:trackId
  - Response: `{ trackId, artists:[{ id, name, role }], producers?:[{ id, name }], writers?:[{ id, name }] }`
  - Notes: initial version maps Spotify artists as performers; producers/writers optional.

## Now Playing
- GET /api/v2/now-playing
  - Response: `{ trackId, trackName, albumId, artistName, progressMs, durationMs, isPlaying }`
  - Poll only when visible/active. Cache: short (≤5s).

## Playing Progress
- GET /api/v2/playing-progress
  - Response: `{ progressMs, durationMs, isPlaying, deviceName? }`

## Scrobbling
- POST /api/v2/scrobble
  - Body: `{ spotifyId, progressMs, durationMs, playedAt?, source, device?, clientVersion? }`
  - Server logic: scrobble if progress/duration ≥ 0.4. Dedup by `(userId, spotifyId, playedAtRounded10s)`.
  - Side effects: upsert `scrobbles_recent`; increment `albumstats`/`trackstats` idempotently.
  - Response: `{ ok: true, scrobbled: boolean, id }`

- POST /api/v2/scrobble/batch
  - Body: `{ items: Array<SameAsAbove + idempotencyKey?> }` (max 100)
  - Response: `{ ok: true, accepted: n, duplicates: m }`

## Recent Scrobbles
- GET /api/v2/scrobbles/recent?limit=50&before=ISO&include=skips
  - Response: `[{ id, spotifyId, trackName, artistName, albumId, albumName, durationMs, playedAt, source, isScrobbled, isSkip?, isPaused? }]`
  - Default excludes skips; `include=skips` to include flagged.
  - Pagination: `nextBefore`.

## Archive to Device
- GET /api/v2/scrobbles/archive-ready?before=ISO
  - Returns scrobbles older than (TTL - graceWindow), e.g., >83d old.
  - Response: `{ items: [...], nextBefore? }` (batch of 500–1,000)

- POST /api/v2/scrobbles/ack-archive
  - Body: `{ ids: string[] }` — deletes those docs; TTL still acts as safety.
  - Response: `{ ok: true, deleted: n }`

## Stats
- GET /api/v2/stats/summary
  - Response: `{ totalMinutes, totalScrobbles, uniqueArtistsCount }`

- GET /api/v2/stats/top-albums?limit=10
  - Response: `[{ albumId, name, artist, albumArt, count }]`

- GET /api/v2/stats/top-tracks?limit=10
  - Response: `[{ spotifyId, name, artist, count }]`

## Reviews & Comments (unchanged shapes, smaller projections)
- POST /api/v2/reviews
- PATCH /api/v2/reviews/:id
- DELETE /api/v2/reviews/:id
- POST /api/v2/reviews/:id/comments
- DELETE /api/v2/reviews/:id/comments/:commentId
  - Notes: author-only mutations; server validates authorId.

## Errors
- 400: validation
- 401: missing/invalid JWT
- 403: not owner / forbidden
- 404: not found
- 409: duplicate (E11000)
- 429: rate limit

## Rate limiting (suggested defaults)
- Scrobble POST: 10/sec burst, 100/min per user
- Batch scrobble: 1/sec burst, 30/min per user
- Now-playing polling: 30/min when visible; block in background

## Headers & caching
- ETag + Cache-Control on GETs
- gzip enabled globally
- Minimal projections only; `fields=` is whitelist

## Security
- JWT (short-lived) for identity; refresh rotation
- Encrypt external tokens at rest; never return plaintext
- Request ID in logs; structured logging for scrobble writes
