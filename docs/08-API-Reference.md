# API Reference (Grouped + Legacy)

This document lists the backend endpoints you can use to build any UI. Use the interactive docs at `/api-docs` for details and try-it-out.

- Base URL (dev): `http://localhost:5000`
- Interactive Swagger UI: `http://localhost:5000/api-docs`
- OpenAPI spec (source): `server/docs/openapi.yaml`

## Grouped Namespaces (new, recommended)
- `/api/user/*` → Profile, auth, social
- `/api/spotify/*` → Search, artist, album, playback, scrobbles
- `/api/reviews/*` → Reviews, reactions, comments
- `/api/stats/*` → Listening stats, completion metrics

Note: All legacy endpoints remain available to avoid breaking existing clients.

---
## Auth
- GET `/api/auth/login?target=mobile|web` → Obtain authorize URL
- POST `/api/auth/callback` → Exchange code (+optional PKCE)
- POST `/api/auth/pkce-login` → PKCE login with access token
- POST `/api/auth/refresh` → Refresh access token

Also available under `/api/user/*` (e.g., `/api/user/login`).

---
## Spotify
- GET `/api/music/search?q=...&accessToken=...` (alias: `/api/spotify/search`)
- GET `/api/music/artist?artistId=...|q=...&accessToken=...` (alias: `/api/spotify/artist`)
- GET `/api/music/album?albumId=...&accessToken=...` (alias: `/api/spotify/album`)
- GET `/api/music/currently-playing?accessToken=...` (alias: `/api/spotify/currently-playing`)
- POST `/api/music/scrobble` { accessToken, userId }
- POST `/api/music/sync-recent` { accessToken, userId }

---
## Stats
- GET `/api/music/listening-stats?userId=...&accessToken=...&force=0|1` (alias: `/api/stats/listening-stats`)

Caching: 15s TTL, returns ETag. Use `force=1` to bust cache.

---
## Reviews
- POST `/api/reviews` → Create review
- GET `/api/reviews/user/{userId}` → Reviews by user
- (Comments endpoints available under `/api/comments/*` and mounted under `/api/reviews/comments/*`)

---
## Users
- GET `/api/users/{id}` → Profile
- GET `/api/auth/search-users?query=...` → Search users (@username, displayName)
- Social graph: `/api/users/{id}/followers`, `/api/users/{id}/following`, `/api/users/{id}/feed`

---
## Response Shapes
- New grouped routes will gradually adopt `{ success, data, error }` envelopes.
- Legacy routes return their original payloads for backward compatibility.

---
## Typed Client Generation
- Types file: `shared/api-types.ts`
- Client wrapper: `shared/api-client.ts`
- Regenerate: `npx openapi-typescript server/docs/openapi.yaml -o shared/api-types.ts`

---
## Quick Examples
```http
GET /api/music/listening-stats?userId=64a...&accessToken=***
200 OK
{ "totalMinutes": 123, "topAlbums": [ ... ] }
```

```http
POST /api/reviews
{ "userId":"64a...","spotifyId":"3pL...","itemType":"album","rating":9,"text":"Iconic." }
201 Created
{ "id":"abc123", ... }
```

---
For deeper contracts, see `docs/API_REFERENCE.md`.
