# API Endpoints Audit & Reference Guide

Date: 2025-11-11
Scope: All server REST endpoints under `/api/*`
Version: 1.0

---

## How to Read This Guide
- Base URL (local dev): `http://<LAN_IP>:5000/api`
- Auth: Spotify OAuth handled via `/api/auth/*`. Write endpoints now require server-side auth middleware (see Security & Auth). No JWT yet.
- Conventions:
  - Success wrapper: `{ success: true, data: ... }` via transitionalSuccess/cachedSuccess in some routes; others return raw arrays/objects
  - Timestamps are ISO strings unless noted
  - IDs: Mongo ObjectId for users internally; some routes accept `spotifyId`w

---

## Auth (`/api/auth`)

### GET /api/auth/login
- Purpose: Get Spotify OAuth authorization URL
- Query:
  - `target` (optional): `mobile` | `web` (default `web`) determines redirect URI
- Response:
```json
{
  "success": true,
  "url": "https://accounts.spotify.com/authorize?...",
  "target": "web",
  "redirectUri": "https://.../callback"
}
```

### POST /api/auth/callback
- Purpose: Handle Spotify OAuth code exchange (web or mobile PKCE)
- Body:
```json
{
  "code": "<auth_code>",
  "redirectUri": "<must_match_spotify>",
  "codeVerifier": "<pkce_verifier_if_mobile>",
  "target": "web|mobile"
}
```
- Response (200):
```json
{
  "success": true,
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "<mongoId>",
    "spotifyId": "<spotify_user_id>",
    "displayName": "...",
    "email": "...",
    "profileImage": "...",
    "username": "..."
  }
}
```

### POST /api/auth/pkce-login
- Purpose: Mobile flow where client exchanges code and sends tokens to server for upsert
- Body:
```json
{ "accessToken": "...", "refreshToken": "..." }
```
- Response: same shape as callback

### POST /api/auth/refresh
- Purpose: Refresh access token using refresh token (confidential client)
- Body: `{ "refreshToken": "..." }`
- Response:
```json
{ "success": true, "accessToken": "...", "refreshToken": "..." }
```

### POST /api/auth/pkce-refresh
- Purpose: Rotate token using server-stored refresh token (no client secret)
- Body: `{ "userId": "<mongo_id_or_spotifyId>" }`
- Response:
```json
{ "success": true, "accessToken": "...", "refreshToken": "...", "refreshTokenRotated": true }
```

### GET /api/auth/search-users
- Purpose: Search users by username/displayName/email
- Query: `query` (required), `limit` (default 20)
- Response: `{ success: true, users: [ { _id, spotifyId, displayName, email, profileImage, username }, ... ] }`

---

## Music (`/api/music`)

### GET /api/music/recent
- Purpose: Proxy Spotify recently played (requires accessToken)
- Query: `accessToken`
- Response: Spotify payload

### GET /api/music/top-tracks
- Purpose: Proxy Spotify top tracks
- Query: `accessToken`, `timeRange` (short_term|medium_term|long_term)
- Response: Spotify payload

### GET /api/music/search
- Purpose: Spotify search (tracks/albums/artists)
- Query: `q` (required), `type` (`track,album,artist`), either `userId` (preferred) or `accessToken`, optional `force=1`
- Response (wrapped):
```json
{
  "success": true,
  "tracks": { ... },
  "albums": { ... },
  "artists": { ... },
  "refreshedToken": "...",
  "cache": { "hit": false, "source": "spotify", "cachedAt": "...", "expiresAt": "...", "isFresh": true }
}
```

### GET /api/music/artist
- Purpose: Artist profile with top tracks and discography
- Query: `accessToken` and `artistId` or `q`
- Response:
```json
{ "artist": { ... }, "topTracks": [ ... ], "discography": { "albums": [...], "singles": [...], "compilations": [...] } }
```

### GET /api/music/album
- Purpose: Album details with tracks
- Query: `accessToken`, `albumId`
- Response: Spotify album object

### GET /api/music/currently-playing
- Purpose: Current playback
- Query: `userId` (preferred) or `accessToken`
- Response (wrapped):
```json
{ "success": true, "isPlaying": true, "track": { ... }, "progressMs": 12345, "timestamp": 17123456789 }
```

### GET /api/music/recently-played
- Purpose: Recently played with server-side cache
- Query: `userId` or `accessToken`, `limit`, optional `force=1`
- Response (wrapped): `{ success: true, items: [...] }`

### POST /api/music/scrobble
- Purpose: Real-time scrobble based on current playback (40% threshold)
- Auth: optional (uses accessToken from body); not gated by middleware
- Body:
```json
{ "accessToken": "...", "userId": "<mongoId>" }
```
- Response (200):
```json
{ "success": true, "scrobbled": true, "scrobble": { "_id": "...", "userId": "...", "spotifyId": "...", "trackName": "...", "artistName": "...", "albumId": "...", "albumName": "...", "albumArt": "...", "durationMs": 180000, "playedAt": "2025-10-01T12:34:56.000Z", "source": "spotify", "createdAt": "...", "updatedAt": "..." } }
```
- Notes:
  - Deduped by `(userId, spotifyId, playedAt)` with 10s rounding
  - Also updates AlbumStats/UserStatsSummary

### GET /api/music/scrobbles
- Purpose: Fetch scrobbles for a user
- Query: `userId`, `limit` (default 50)
- Response: `[{ _id, userId, spotifyId, trackName, artistName, albumId, albumName, albumArt, durationMs, playedAt, source, createdAt, updatedAt }, ...]`

### GET /api/music/listening-stats
- Purpose: Fast in-memory stats from last ~200 scrobbles
- Query: `userId` (required), optional `accessToken`, `force=1`
- Response:
```json
{
  "totalMinutes": 123,
  "totalScrobbles": 200,
  "uniqueArtistsCount": 12,
  "topAlbums": [{ "name": "...", "artist": "...", "albumArt": "...", "count": 5, "totalTracks": 4, "totalTimeMs": 0 }],
  "topSingles": [...],
  "topGenres": [{ "genre": "rock", "count": 10 }],
  "topArtists": [{ "artist": "Fleetwood Mac", "count": 6 }],
  "albumCompletions": {
    "totalCompletedAlbums": 3,
    "totalCompletedAlbumPlays": 5,
    "recentCompletions": [{ "albumName": "Rumours", "artistName": "Fleetwood Mac", "albumArt": "...", "lastCompletedAt": "..." }],
    "dailyCompletionTrend": [{ "date": "2025-10-15", "count": 1 }, ...],
    "last7DaysCompletions": 2,
    "currentStreak": 1
  },
  "cache": { "hit": false, "generatedAt": 17123456789, "lastScrobblePlayedAt": 17123400000, "forced": false }
}
```

### POST /api/music/sync-recent
- Purpose: Sync scrobbles from Spotify Recently Played to fill gaps
- Body:
```json
{ "accessToken": "...", "userId": "<mongoId>" }
```
- Response:
```json
{ "success": true, "inserted": 12, "checked": 50, "skipped": 8 }
```

---

## Reviews (`/api/reviews`)

### POST /api/reviews
- Purpose: Create or update a review
- Auth: required (requireAuth). User inferred from auth; client userId is ignored.
- Body:
```json
{ "itemType": "track|album", "spotifyId": "...", "itemName": "...", "artistName": "...", "albumArt": "...", "rating": 8, "reviewText": "...", "isPublic": true, "listeningDate": "2025-10-01" }
```
- Response (201 or 200): `{ success: true, review: { ... } }`

### GET /api/reviews/public
- Purpose: Public feed of reviews
- Query: `limit`, `skip`
- Response: `[{ ...populated review... }, ...]`

### GET /api/reviews/user/:userId
- Purpose: Reviews by a user
- Response: `[{ ...review... }, ...]`

### GET /api/reviews/track/:spotifyId
- Purpose: Public reviews for an item
- Response: `[{ ...review... }, ...]`

### GET /api/reviews/:id
- Purpose: Single review
- Response: `{ success: true, review: { ... } }`

### PUT /api/reviews/:id
- Purpose: Update rating/text
- Auth: required (requireAuth). Author-only.
- Body: `{ "rating": 9, "reviewText": "..." }`
- Response: `{ success: true, review: { ... } }`

### DELETE /api/reviews/:id
- Purpose: Delete a review
- Auth: required (requireAuth). Author-only.
- Response: `{ success: true, message: "Review deleted successfully" }`

### POST /api/reviews/:id/react
- Purpose: React to a review (like/dislike/emoji)
- Auth: required (requireAuth). Uses authenticated user.
- Body: `{ "type": "like|dislike|love|fire|sad|none" }`
- Response:
```json
{ "success": true, "reviewId": "...", "reactionsCount": { "like": 3, ... }, "userReaction": "like", "likes": 4 }
```

### GET /api/reviews/:id/reactions/users
- Purpose: List users who reacted (optionally filter by `type`)
- Query: `type` optional
- Response: `{ users: [{ _id, displayName, profileImage, username, spotifyId, reactionType }...] }`

### GET /api/reviews/:id/comments
- Purpose: List comments (flat)
- Response: `[{ _id, reviewId, userId(populated), text, parentId, createdAt }...]`

### POST /api/reviews/:id/comments
- Purpose: Add a comment or reply
- Auth: required (requireAuth). Uses authenticated user.
- Body: `{ "text": "...", "parentId": "..." }`
- Response (201): `created comment document (populated user)`

### DELETE /api/reviews/comments/:commentId
- Purpose: Delete comment (author only)
- Auth: required (requireAuth). Author-only.
- Response: `{ success: true }`

---

## Users (`/api/users`)

### GET /api/users
- Purpose: Search users
- Query: `query` (min 2 chars), `page`, `limit`
- Response:
```json
{ "success": true, "results": [{ "_id": "...", "username": "...", "displayName": "...", "profileImage": "...", "followersCount": 1, "followingCount": 2 }], "page": 1, "totalPages": 3, "totalCount": 42, "hasMore": true }
```

### GET /api/users/:id/feed
- Purpose: Feed from followed users
- Response: `{ success: true, feed: [{ ...review... }...] }`

### GET /api/users/:id/activity
- Purpose: Last scrobble + recent reviews
- Response: `{ lastScrobble: {...} | null, recentReviews: [...] }`

### GET /api/users/:id/mutual-followers?viewerId=...
- Purpose: Mutually shared followers
- Response: `{ success: true, mutualFollowers: [{ _id, username, displayName, profileImage }], count: 2 }`

### GET /api/users/:id/followers
- Purpose: List followers
- Response: `{ success: true, followers: [{ _id, displayName, username, profileImage }], count: 5 }`

### GET /api/users/:id/following
- Purpose: List following
- Response: `{ success: true, following: [{ _id, displayName, username, profileImage }], count: 5 }`

### GET /api/users/:id
- Purpose: User profile
- Query: `viewerId` optional for `isFollowing`
- Response:
```json
{
  "success": true,
  "_id": "...",
  "spotifyId": "...",
  "displayName": "...",
  "email": "...",
  "profileImage": "...",
  "username": "...",
  "bio": "...",
  "instagramUsername": "...",
  "twitterHandle": "...",
  "location": "...",
  "favAlbums": [],
  "favTracks": [],
  "followersCount": 10,
  "followingCount": 8,
  "isFollowing": false
}
```

### POST /api/users/:id/follow
- Auth: required (requireAuth). Follower inferred from auth.
- Body: none
- Response: `{ followersCount: 11, followingCount: 9, isFollowing: true }`

### POST /api/users/:id/unfollow
- Auth: required (requireAuth). Follower inferred from auth.
- Body: none
- Response: `{ followersCount: 10, followingCount: 8, isFollowing: false }`

### PUT /api/users/:id/username
- Auth: required (requireAuth + requireSelfParam). Only the user can update their username.
- Body: `{ "username": "new_name" }`
- Response: `{ success: true, username: "new_name" }`

### PUT /api/users/:id/profile
- Auth: required (requireAuth + requireSelfParam). Only the user can update their profile.
- Body: `{ bio, instagramUsername, twitterHandle, location }`
- Response: `{ success: true, bio, instagramUsername, twitterHandle, location }`

### PUT /api/users/:id/favorites
- Auth: required (requireAuth + requireSelfParam). Only the user can update favorites.
- Body:
```json
{
  "favAlbums": [{ "id": "...", "name": "...", "artist": "...", "image": "..." }],
  "favTracks": [{ "id": "...", "name": "...", "artist": "...", "image": "..." }]
}
```
- Response: `{ success: true, favAlbums: [...], favTracks: [...] }`

---

## Stats (`/api/stats`)

### POST /api/stats/album-batch-upsert
- Purpose: Device → Cloud album stats delta upsert
- Body:
```json
{
  "userId": "...",
  "albums": [
    { "albumId": "2guirTSEq...", "albumName": "Rumours", "artistName": "Fleetwood Mac", "albumArt": "...", "deltaCount": 3, "lastPlayedAt": "2025-10-10T00:00:00Z" }
  ]
}
```
- Response: `{ matched, modified, upserted }`

### GET /api/stats/album/:userId?limit=50&force=1
- Response: `[{ userId, albumKey, albumId, albumName, artistName, albumArt, playCount, lastPlayedAt, ... }]`

### POST /api/stats/track-batch-upsert
- Body:
```json
{
  "userId": "...",
  "tracks": [
    { "trackId": "...", "trackName": "...", "artistName": "...", "albumName": "...", "albumArt": "...", "deltaCount": 2, "lastPlayedAt": "2025-10-01T00:00:00Z" }
  ]
}
```
- Response: `{ matched, modified, upserted }`

### GET /api/stats/track/:userId?limit=50&force=1
- Response: `[{ userId, trackKey, trackId, trackName, artistName, albumName, albumArt, playCount, lastPlayedAt }]`

---

## Home (`/api/home`)

### GET /api/home/snapshot?userId=...
- Purpose: Aggregate profile + recent scrobbles + top content
- Response: See code for full shape; includes cache metadata

### GET /api/home/quick-stats?userId=...
- Purpose: Ultra-fast counts (scrobbles, unique albums, unique tracks)
- Response: `{ totalScrobbles, uniqueAlbums, uniqueTracks }`

---

## Response & Error Codes
- 200 OK, 201 Created, 204 No Content (Spotify proxy)
- 304 Not Modified (ETag used in /music/listening-stats)
- 400 Bad Request (missing or invalid params)
- 401 Unauthorized (Spotify token invalid/expired)
- 403 Forbidden (author-only actions on comments)
- 404 Not Found (user/review not found)
- 409 Conflict (duplicate username, missing user on scrobble recovery)
- 500 Internal Server Error

---

## Side Effects & Data Writes
- /music/scrobble: writes Scrobble, updates AlbumStats, may create CompletionEvent
- /music/sync-recent: bulk upserts Scrobble + AlbumStats + TrackStats + UserStatsSummary
- /reviews: CRUD on Review + ReviewComment; reactions tracked in maps
- /users/*: followers/following arrays, profile fields
- /stats/*: batch upserts for device → cloud deltas

---

## Security & Auth
- OAuth handled via /api/auth/* endpoints.
- New middleware guards for write operations:
  - `requireAuth`: resolves the acting user via one of:
    - `x-user-id` header (Mongo ObjectId or spotifyId), or
    - `userId` in body/query, or
    - `Authorization: Bearer <accessToken>` (fallback)
  - `requireSelfParam('id')`: ensures the `:id` route param equals the authenticated user id.
- Affected endpoints now marked "Auth: required". Read-only endpoints remain public.
- JWT is not yet implemented. Consider adding short-lived JWTs for stronger client auth.

---

## Recommendations (API Hygiene)
- Standardize success wrapper across all routes
- Add OpenAPI (Swagger) spec generation from code
- Add rate limiting to search and write endpoints
- Consider moving to JWT-based auth for write endpoints (current middleware is pragmatic but not cryptographic)
- Normalize album/track metadata to reduce duplication

---

End of report.
