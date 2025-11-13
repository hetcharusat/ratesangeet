# Backend Architecture

> **Purpose**: This document describes the Ratesangeet backend layers, routing structure, data flows, and integration patterns so any UI can connect confidently.

---
## 1. Layer Overview

```
┌─────────────────────────────────────────┐
│         Clients (Mobile/Web)            │
│  React Native, Web, CLI, curl, etc.     │
└──────────────┬──────────────────────────┘
               │ HTTP/JSON
               ▼
┌─────────────────────────────────────────┐
│         Express Server (index.ts)       │
│  - CORS, body-parser, sessions          │
│  - Request logger (dev only)            │
│  - MongoDB connection guard             │
│  - Swagger UI at /api-docs              │
│  - Unified router at /api               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Unified Router (routes/index.ts)     │
│  - Grouped mounts:                      │
│    /api/user, /api/spotify,             │
│    /api/reviews, /api/stats             │
│  - Legacy mounts (backward compat):     │
│    /api/auth, /api/music, etc.          │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
  ┌──────────┐  ┌─────────────┐
  │ Route    │  │  Controller │
  │ (thin)   │─▶  (logic)     │
  └──────────┘  └──────┬──────┘
                       │
                  ┌────┴────┐
                  │         │
                  ▼         ▼
            ┌─────────┐ ┌──────────┐
            │ Models  │ │ External │
            │(Mongoose)│ │ (Spotify)│
            └────┬────┘ └────┬─────┘
                 │           │
                 ▼           ▼
          MongoDB Atlas   Spotify API
```

---
## 2. Routing Structure

### Grouped Namespaces (Recommended)
- **`/api/user/*`**: Profiles, social graph, auth helpers
  - Includes: login, followers, following, feed, username updates
- **`/api/spotify/*`**: Spotify API proxies and playback
  - Includes: search, artist, album, currently-playing, scrobble, sync-recent
- **`/api/reviews/*`**: Reviews, reactions, comments
  - Includes: CRUD reviews, reactions (like/love/fire), threaded comments
- **`/api/stats/*`**: Aggregated listening metrics
  - Includes: listening-stats (cached), album/track summaries

### Legacy Paths (Backward Compatible)
- **`/api/auth/*`**: Original auth endpoints
- **`/api/music/*`**: Original Spotify + scrobbling
- **`/api/reviews/*`** (legacy): Old review routes (still work)
- **`/api/users/*`**: User profiles
- **`/api/stats/*`**: Stats endpoints
- **`/api/discover/*`**: Discovery feed
- **`/api/comments/*`**: Standalone comments

**Why Both?**: Grouped paths use new controller pattern with `{ success, data }` responses. Legacy paths remain unchanged for existing mobile clients.

---
## 3. Controllers Pattern

### Before (Monolithic Route)
```ts
router.get('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Not found' });
    res.json(review);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

### After (Thin Route + Controller)
```ts
// Route (routes/reviewsNew.ts)
router.get('/:id', asyncHandler(controller.getReviewById));

// Controller (controllers/reviewsController.ts)
export async function getReviewById(req, res) {
  const review = await Review.findById(req.params.id);
  if (!review) return respond.error(res, 'Review not found', 404);
  respond.success(res, review);
}
```

**Benefits**:
- Logic testable in isolation
- Consistent error handling via middleware
- Uniform response shape `{ success, data }` or `{ success, error }`

---
## 4. Response Standardization

### New Grouped Endpoints
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Resource not found", "details": {...} }
```

### Legacy Endpoints
- Return raw payloads (arrays, objects) for backward compatibility.
- Client wrapper (`shared/api-client.ts`) normalizes legacy responses into `{ success, data }` shape.

---
## 5. Data Flow (Example: Get Listening Stats)

```
1. Client                 → GET /api/spotify/listening-stats?userId=...&force=1
2. Unified Router         → Dispatches to spotifyGroup
3. spotifyGroup           → Delegates to musicRoutes
4. musicRoutes            → Calls GET /listening-stats handler
5. Handler                → Checks cache (15s TTL)
6. (Cache miss/force)     → Queries MongoDB Scrobbles (last 200)
7. Aggregation            → Computes totalMinutes, topAlbums, albumCompletions
8. Cache update           → Stores result + ETag
9. Response               → Returns JSON (legacy format or { success, data })
10. Client                → Parses and renders
```

---
## 6. Database Models (Mongoose)

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **User** | Auth + profile | spotifyId, accessToken, refreshToken, username, followers |
| **Scrobble** | Track play record | userId, spotifyId, playedAt (rounded to 10s), albumId, durationMs |
| **AlbumStats** | Per-user album metrics | userId, albumKey, playCount, completedPlays, currentCycleUniqueTrackIds |
| **TrackStats** | Per-user track metrics | userId, trackKey, playCount, lastPlayedAt |
| **UserStatsSummary** | Lifetime totals | userId, totalScrobbles, lastScrobbled |
| **Review** | User review | userId, spotifyId, itemType, rating, reviewText, likes, reactionsByUser |
| **ReviewComment** | Threaded comments | reviewId, userId, text, parentCommentId |
| **CompletionEvent** | Album completion log | userId, albumId, completedAt (for trends) |
| **ServerStats** | Uptime metrics | totalPings, totalRestarts, firstStartTime |

---
## 7. External Integrations

### Spotify Web API
- **Auth**: OAuth 2.0 (PKCE for mobile, confidential for server)
- **Endpoints used**:
  - `/v1/me` (profile)
  - `/v1/me/player/currently-playing` (active track)
  - `/v1/me/player/recently-played` (backfill)
  - `/v1/search` (search tracks/albums)
  - `/v1/artists/{id}`, `/v1/albums/{id}` (metadata)
- **Token refresh**: Automatic via `/api/auth/refresh`

### MongoDB Atlas
- **Connection**: Via `mongoose.connect()` with auto-reconnect
- **Connection guard**: `ensureMongoConnected` middleware blocks requests if DB down
- **Indexes**: Unique on `(userId, spotifyId, playedAt)` for Scrobble deduplication

---
## 8. Middleware Stack

1. **CORS**: Allow all origins (mobile compatibility)
2. **Body Parser**: JSON + cookies
3. **Session**: Express sessions (24hr expiry)
4. **Request Logger**: Dev-only, masks sensitive params (tokens)
5. **MongoDB Connection Guard**: Ensures DB ready before processing
6. **Unified Router**: Groups + legacy mounts
7. **Error Handler**: Catches unhandled errors, returns `{ success: false, error }`

---
## 9. Caching Strategy

| Endpoint | TTL | Bust Trigger | ETag |
|----------|-----|--------------|------|
| `/music/listening-stats` | 15s | New scrobble detected or `force=1` | Yes |
| `/music/album` | None | — | No |
| `/music/artist` | None | — | No |

**Client Pattern**:
- Send `If-None-Match: <etag>` to receive 304 if unchanged.
- Use `force=1` to bypass cache (e.g., pull-to-refresh).

---
## 10. Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| **Background Scrobbler** | Every 10s (per active user) | Polls `/currently-playing`, auto-scrobbles when ≥40% |
| **Archive Job** | Every 24h | Deletes scrobbles older than `CLOUD_SCROBBLE_RETENTION_DAYS` (default 30) |
| **Uptime Ping** | Every 5 min (external) | UptimeRobot keeps Render container awake |

---
## 11. Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/spotify-tracker` |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | Required |
| `SPOTIFY_CLIENT_SECRET` | Spotify app secret | Required (server flow) |
| `SPOTIFY_REDIRECT_URI` | OAuth redirect | Required |
| `SPOTIFY_REDIRECT_URI_MOBILE` | Mobile deep link | Optional |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `CLOUD_ENABLE_SCROBBLES` | Store scrobbles in cloud | `true` |
| `CLOUD_SCROBBLE_RETENTION_DAYS` | Archive threshold | `30` |
| `SESSION_SECRET` | Session encryption key | Random default |
| `ADMIN_KEY` | Manual job trigger auth | Optional |

---
## 12. API Documentation

| Resource | URL | Purpose |
|----------|-----|---------|
| **Interactive Docs** | `http://localhost:5000/api-docs` | Swagger UI (try-it-out) |
| **OpenAPI Spec** | `server/docs/openapi.yaml` | Machine-readable contract |
| **Human Reference** | `docs/API_REFERENCE.md` | Screen mappings, recipes, examples |
| **Quick Reference** | `docs/08-API-Reference.md` | Grouped endpoint summary |

---
## 13. How to Add a New Endpoint

### Step 1: Define Controller
```ts
// server/src/controllers/statsController.ts
export async function getTopArtists(req, res) {
  const { userId } = req.params;
  const artists = await computeTopArtists(userId);
  respond.success(res, artists);
}
```

### Step 2: Add Route
```ts
// server/src/routes/groups/stats.ts
router.get('/top-artists/:userId', asyncHandler(controller.getTopArtists));
```

### Step 3: Document in OpenAPI
```yaml
# server/docs/openapi.yaml
/api/stats/top-artists/{userId}:
  get:
    tags: [Stats]
    summary: Get top artists for user
    parameters:
      - in: path
        name: userId
        required: true
        schema: { type: string }
    responses:
      '200':
        description: Top artists
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ApiSuccess' }
```

### Step 4: Regenerate Types
```bash
npx openapi-typescript server/docs/openapi.yaml -o shared/api-types.ts
```

### Step 5: Use in Client
```ts
// shared/api-client.ts
export const api = {
  stats: {
    topArtists: (userId: string) => request('GET', `/api/stats/top-artists/${userId}`),
  }
};
```

---
## 14. Testing Strategy

### Manual
```bash
# Health check
curl http://localhost:5000/api/health

# Auth flow
curl http://localhost:5000/api/auth/login?target=web

# Get reviews
curl http://localhost:5000/api/reviews/user/64a1b2c3d4e5f6g7h8i9j0k1
```

### Automated (Future)
- Jest for unit testing controllers
- Supertest for integration testing routes
- MongoDB Memory Server for isolated DB tests

---
## 15. Deployment

### Development
```bash
npm --prefix server run dev
# Server runs on http://0.0.0.0:5000
# LAN IP logged for mobile testing
```

### Production (Render)
- **Build**: `npm run build` (tsc compiles to `dist/`)
- **Start**: `npm start` (runs `dist/index.js`)
- **Environment**: Render injects env vars (MongoDB URI, Spotify keys)
- **Keep-Alive**: UptimeRobot pings `/ping` every 5 min

---
## 16. Security Notes

- **Tokens**: Never logged (masked in dev logger)
- **CORS**: Open for mobile; tighten in production if needed
- **Sessions**: HTTP-only cookies, secure flag in production
- **Rate Limiting**: Not yet implemented (future: express-rate-limit)
- **Input Validation**: Basic checks; enhance with Joi/Zod if needed

---
## 17. Performance Optimization

| Area | Strategy |
|------|----------|
| **DB Queries** | `.select()` only needed fields, `.lean()` for read-only |
| **Caching** | In-memory for stats (15s TTL), ETag support |
| **Pagination** | Limit queries to 50–200 items |
| **Batch Operations** | `bulkWrite` for stats updates |
| **Spotify API** | Avoid per-item calls in hot paths |

---
## 18. Extension Points

### Add New Domain
1. Create `server/src/controllers/domainController.ts`
2. Create `server/src/routes/groups/domain.ts`
3. Mount in `server/src/routes/index.ts`
4. Document in OpenAPI
5. Regenerate types

### Add Authentication Layer
- Implement JWT middleware
- Protect routes with auth guard
- Add user context to `req.user`

### Add Real-Time Features
- Integrate Socket.IO
- Emit events on review creation, reactions
- Subscribe clients to user feeds

---
## 19. Troubleshooting

| Issue | Solution |
|-------|----------|
| **MongoDB connection failed** | Check `MONGODB_URI`, verify Atlas IP whitelist |
| **Spotify 401** | Refresh access token via `/api/auth/refresh` |
| **Port in use** | Server auto-retries next port (5001, 5002, ...) |
| **Swagger UI not loading** | Verify `server/docs/openapi.yaml` exists and is valid YAML |
| **Grouped routes 404** | Ensure unified router mounted at `/api` in `index.ts` |

---
## 20. Future Enhancements

- [ ] Rate limiting per IP/user
- [ ] Redis for distributed caching
- [ ] WebSocket for real-time notifications
- [ ] GraphQL endpoint for flexible queries
- [ ] Automated tests (Jest + Supertest)
- [ ] Monitoring (Sentry, DataDog)
- [ ] CI/CD pipeline (GitHub Actions)

---
**End of Architecture Document**

This backend is now fully documented and ready for any UI to integrate. Use the grouped endpoints for new features and maintain legacy paths for existing clients.
