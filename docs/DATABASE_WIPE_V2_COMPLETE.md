# V2 Database Wipe & Rebuild - Completed ✅

**Date**: November 12, 2025  
**Status**: Clean database with V2 schemas

## What Was Done

### 1. ✅ Dropped ALL Collections
- `reviewcomments`
- `userstatssummaries`
- `users`
- `reviews`
- `completionevents`
- `scrobbles`
- `albumstats`
- `trackstats`

### 2. ✅ Created V2 Collections with New Schemas
All collections recreated with V2 fields:
- **scrobbles**: Added `playedAtRounded10s`, `isScrobbled`, TTL 90d
- **trackstats**: Added `replayGuardAt` for 15-min replay protection
- **albumstats**: Added `uniqueTracksPlayed[]`, `albumPlayCount`, `totalTracks`
- **userstatssummaries**: Ready for aggregated stats

### 3. ✅ All Indexes Created
**Scrobbles**:
- `userId_1_spotifyId_1_playedAtRounded10s_1` (unique dedup key)
- `playedAt_1` (TTL index for 90-day retention)
- `userId_1_playedAt_-1` (fast recent queries)

**AlbumStats**:
- `userId_1_albumKey_1` (unique per user+album)
- `userId_1_albumPlayCount_-1` (leaderboard by completions)
- `userId_1_lastPlayedAt_-1` (recent activity)

**TrackStats**:
- `userId_1_trackKey_1` (unique per user+track)
- `userId_1_playCount_-1` (top tracks)
- `userId_1_lastPlayedAt_-1` (recent plays)

### 4. ✅ Schema Verified
All V2 features ready:
- Server-assisted scrobbling (40% threshold)
- Deduplication via `playedAtRounded10s`
- Replay guard (15-min window)
- Album completion (4-track min, 70% threshold)
- 90-day TTL with auto-cleanup

## Current State
- **Database**: Clean, 0 records
- **Server**: Running, healthy (ping: pong)
- **Collections**: 8 total, all indexed
- **Schema conflicts**: RESOLVED ✅

## Ready for Testing

### Quick Test Flow
```powershell
# 1. Play songs on Spotify (>40% duration)
# 2. Wait 30 seconds for V2 context poll
# 3. Run quick test
.\test-e2e-quick.ps1

# 4. Check specific data
$userId = '690f3c63bd0a03a91f3cd7fb'
Invoke-RestMethod "http://localhost:5000/api/music/scrobbles/recent?userId=$userId&limit=10"
```

### What to Test Next
1. **Scrobbling**: Play 3-5 songs, verify no duplicates
2. **Skip detection**: Skip song <40%, verify NOT scrobbled
3. **Album completion**: Play 4+ tracks from same album (70%+ unique)
4. **Stats accuracy**: Verify playCount, albumPlayCount match reality
5. **Performance**: Home screen <1.5s load with skeleton UI

## Files
- **Wipe script**: `server/wipe-and-rebuild-database.ts`
- **Test script**: `test-e2e-quick.ps1`
- **Full plan**: `docs/03-features/V2_E2E_TESTING_PLAN.md`

---

**Status**: ✅ Clean slate ready - No schema conflicts - V2 testing can begin!
