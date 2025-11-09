# Background Scrobbling System

## Overview
Comprehensive background scrobbling system that keeps scrobbles in sync even when the app is closed, using Spotify's Recently Played API.

## Architecture

### 1. Client-Side Sync (On App Open)
**Location**: `mobile/src/context/ScrobbleContext.tsx`

When user opens the app:
1. Fetches last 50 Recently Played tracks from Spotify
2. Saves new scrobbles to server (with deduplication)
3. Updates local SQLite cache
4. Syncs aggregate stats (AlbumStats, TrackStats)

**Flow**:
```
App Opens → ScrobbleContext.startPolling()
         → syncRecentPlays(accessToken, userId)
         → Server /sync-recent endpoint
         → Save to MongoDB (dedupe via unique index)
         → Update AlbumStats, TrackStats, UserStatsSummary
         → Return new scrobbles count
```

### 2. Server-Side Cron Job (Every 45 Minutes)
**Location**: `server/src/jobs/backgroundScrobbler.ts`

Runs automatically on server:
1. Processes all users sequentially (staggered with 5s delays)
2. Checks if access token is expired, refreshes if needed
3. Fetches last 50 Recently Played tracks per user
4. Saves new scrobbles to MongoDB (dedupe via unique index)
5. Updates aggregate stats for each user

**Flow**:
```
Server Startup → 60s delay → startBackgroundScrobbler()
              → Run immediately
              → Schedule recurring (every 45 min)
              
For Each User:
  Check Token Expired? → Refresh if needed → Update User record
  Fetch Recently Played (50 tracks)
  For Each Track:
    Round playedAt to 10s (deduplication)
    findOneAndUpdate with upsert (unique index prevents duplicates)
    If new: Aggregate stats (AlbumStats, TrackStats, UserStatsSummary)
  Wait 5s before next user (CPU throttling)
```

## Key Features

### ✅ Automatic Token Refresh
- Background job detects expired tokens (401 errors)
- Automatically refreshes using refresh token
- Updates User record with new tokens
- Retries fetch with fresh token

### ✅ Deduplication Strategy
Uses existing unique index: `{ userId, spotifyId, playedAt }`

**10-Second Rounding**:
```typescript
const roundedMs = Math.floor(playedAt.getTime() / 10000) * 10000;
const roundedPlayedAt = new Date(roundedMs);
```

Why? Spotify's Recently Played timestamps can vary slightly across polls. Rounding to 10s ensures the same track gets the same `playedAt` value, so MongoDB's unique index prevents duplicates.

### ✅ CPU Efficiency (Free Tier Friendly)
- **Staggered execution**: 5s delay between users
- **Single-threaded**: Only one user processed at a time
- **Timeout protection**: 15s timeout per API call
- **Error isolation**: One user failure doesn't stop others

### ✅ Stats Auto-Update
Every new scrobble automatically updates:
- **AlbumStats**: `playCount`, `lastPlayedAt` per album
- **TrackStats**: `playCount`, `lastPlayedAt` per track
- **UserStatsSummary**: `totalScrobbles` lifetime count

### ✅ Hybrid Storage Compliance
- If `CLOUD_ENABLE_SCROBBLES=true`: Saves to MongoDB + updates stats
- If `CLOUD_ENABLE_SCROBBLES=false`: Returns tracks to client for local SQLite only

## Configuration

### Environment Variables

#### Client-Side (Mobile)
No config needed - uses existing `syncRecentPlays()` API call.

#### Server-Side (Background Job)
```env
# Enable/disable background scrobbler
BACKGROUND_SCROBBLE_ENABLED=true  # default: true

# How often to run (milliseconds)
BACKGROUND_SCROBBLE_INTERVAL_MS=2700000  # default: 45 minutes

# Delay between users (milliseconds)
BACKGROUND_SCROBBLE_USER_DELAY_MS=5000  # default: 5 seconds

# Cloud storage (existing)
CLOUD_ENABLE_SCROBBLES=true  # default: true
```

### Disabling Background Scrobbler
```env
BACKGROUND_SCROBBLE_ENABLED=false
```

## Limitations & Trade-offs

### ⚠️ The 50-Track Window
Spotify's Recently Played API returns maximum 50 tracks.

**Scenarios**:
- ✅ User plays 30 songs in 45 min → All captured
- ✅ User plays 50 songs in 45 min → All captured
- ❌ User plays 80 songs in 45 min → **Only last 50 captured** (30 lost)

**Mitigation**:
- 45-minute interval reduces likelihood of >50 plays
- Average song is 3-4 minutes, 50 songs = ~3 hours of listening
- Most users won't exceed this in 45 minutes

### ⚠️ Scrobble Threshold Bypass
**Compromise**: Treats all Recently Played as "scrobbled"
- Real-time scrobbling: Only counts tracks played ≥40%
- Background scrobbling: Counts all Recently Played (no duration check)

**Why?**
- Spotify Recently Played doesn't include playback progress
- We only get `played_at` timestamp, not "how long played"
- Assumption: If Spotify logged it as "played", user listened to it

**Impact**:
- User skips after 10 seconds → Still counted as scrobble
- More lenient than real-time, but maintains listening history completeness

### ⚠️ Free Tier CPU Constraints
**Problem**: Render free tier has limited CPU
- Can't process all users simultaneously
- Must stagger execution to avoid timeouts

**Solution**:
- Sequential processing (one user at a time)
- 5-second delays between users
- Estimated time for 100 users: ~8.3 minutes (5s × 100)

## API Reference

### Client-Side

#### `syncRecentPlays(accessToken, userId)`
Fetches Recently Played from Spotify and saves new scrobbles.

**Request**:
```typescript
POST /api/music/sync-recent
{
  accessToken: string,
  userId: string
}
```

**Response**:
```typescript
{
  success: boolean,
  inserted: number,        // New scrobbles added
  checked: number,         // Total tracks processed (max 50)
  items?: Array<{          // Only if CLOUD_ENABLE_SCROBBLES=false
    spotifyId: string,
    trackName: string,
    artistName: string,
    albumId?: string,
    albumName?: string,
    albumArt?: string,
    durationMs?: number,
    playedAt: string       // ISO timestamp
  }>
}
```

### Server-Side

#### Manual Run (Testing)
```bash
# Run once manually
cd server
npx tsx src/jobs/backgroundScrobbler.ts

# Watch logs
npm run dev  # Background scrobbler starts after 60s
```

#### Logs Format
```
🎵 Starting background scrobbler job...
✅ MongoDB connected
📊 Found 3 users to process

[1/3] Processing user: user_123
✅ User user_123: 15 new scrobbles from 50 tracks

[2/3] Processing user: user_456
🔄 Token expired for user user_456, refreshing...
✅ User user_456: 8 new scrobbles from 50 tracks (token refreshed)

⏳ Waiting 5000ms before next user...

🎉 Background scrobbler job completed
📊 Stats: 2 success, 0 failures, 23 new scrobbles
```

## Testing

### Test Client-Side Sync
1. Play 5-10 songs on Spotify with app closed
2. Open app
3. Check logs for sync result:
   ```
   [SCROBBLE] Backfill: 8 new scrobbles
   ```
4. Verify songs appear in History screen

### Test Server-Side Cron
1. Start server: `npm run dev`
2. Wait 60 seconds (startup delay)
3. Check logs for cron start:
   ```
   🎵 Starting background scrobbler...
   ```
4. Verify users are processed sequentially
5. Check MongoDB for new scrobbles

### Test Token Refresh
1. Manually expire a user's access token in MongoDB
2. Trigger sync (client or server)
3. Verify token refresh in logs:
   ```
   🔄 Token expired, refreshing...
   ✅ New scrobbles added (token refreshed)
   ```

### Test Deduplication
1. Run sync twice in a row
2. Verify second run shows:
   ```
   inserted: 0  // No duplicates
   ```

## Monitoring

### Health Checks
```bash
# Check if background scrobbler is running
curl http://localhost:5000/api/health

# Check recent scrobbles for a user
curl "http://localhost:5000/api/music/scrobbles?userId=USER_ID&limit=10"

# Check user stats
curl "http://localhost:5000/api/stats/user-stats?userId=USER_ID"
```

### Common Issues

#### "No new scrobbles inserted"
- User hasn't played anything new since last sync
- All 50 Recently Played are already in database
- **Expected behavior** if user syncs frequently

#### "Token refresh failed"
- Refresh token expired (rare, 1 year expiry)
- User needs to re-authenticate in app
- Check User record in MongoDB for valid refreshToken

#### "Background scrobbler not running"
- Check `BACKGROUND_SCROBBLE_ENABLED=true`
- Verify server started successfully
- Check logs 60 seconds after startup

## Performance

### Benchmarks (Estimated)
- **Single user sync**: ~2-3 seconds
  - Spotify API call: ~1s
  - MongoDB upsert (50 tracks): ~1s
  - Stats aggregation: ~0.5s

- **100 users (sequential)**: ~8-10 minutes
  - Processing time: ~3s per user × 100 = ~5 min
  - Stagger delays: 5s × 100 = ~8.3 min
  - **Total**: ~13 minutes per cron run

### Optimization Strategies
1. **Reduce user delay** (if CPU allows):
   ```env
   BACKGROUND_SCROBBLE_USER_DELAY_MS=2000  # 2s instead of 5s
   ```

2. **Increase cron interval** (less frequent):
   ```env
   BACKGROUND_SCROBBLE_INTERVAL_MS=5400000  # 90 minutes
   ```

3. **Batch operations** (already implemented):
   - Uses `bulkWrite()` for stats updates
   - Single `findOneAndUpdate()` per scrobble (with upsert)

## Future Improvements

### 1. Parallel Processing (Requires Upgrade)
```typescript
// Process 5 users at a time (needs better CPU)
const BATCH_SIZE = 5;
for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(processUser));
  await sleep(5000);  // Stagger batches
}
```

### 2. Smart Scheduling
Only sync users who are active:
```typescript
// Track last app open time
const activeUsers = await User.find({ 
  lastActiveAt: { $gt: Date.now() - 7 * 24 * 60 * 60 * 1000 } // Active in last 7 days
});
```

### 3. Delta Sync
Track cursor per user to avoid re-checking old tracks:
```typescript
// Save cursor in User model
interface IUser {
  // ...
  lastScrobbleCursor?: number;  // Unix timestamp
}

// Use cursor in API call
const params = { 
  limit: 50, 
  after: user.lastScrobbleCursor 
};
```

### 4. Webhook Alternative (Premium Spotify API)
Replace polling with Spotify Web Playback SDK events:
- Real-time updates (no 45-min delay)
- No API rate limits
- Requires Spotify Premium API access

## Related Files

### Server
- `server/src/jobs/backgroundScrobbler.ts` - Main cron job
- `server/src/routes/music.ts` - `/sync-recent` endpoint
- `server/src/index.ts` - Cron job initialization
- `server/src/models/Scrobble.ts` - Scrobble schema with unique index
- `server/src/models/User.ts` - User schema with tokens

### Client
- `mobile/src/context/ScrobbleContext.tsx` - Client-side sync integration
- `mobile/src/services/api.ts` - `syncRecentPlays()` API call
- `mobile/src/storage/sqlite.ts` - Local scrobble storage

### Documentation
- `docs/02-architecture/SMART_SCROBBLE_ALGORITHM.md` - Real-time scrobbling (40% threshold)
- `docs/02-architecture/HYBRID_STORAGE.md` - Cloud vs local storage strategy
- `docs/03-features/BACKGROUND_SCROBBLING.md` - **This document**

---

**Last Updated**: November 9, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
