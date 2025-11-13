# Phase 11: End-to-End Testing Plan

## Overview
Test the complete V2 system flow from Spotify playback → scrobbling → stats → archive.

**Test Environment**: Local (server + mobile simulator/device)
**Test User**: 690f3c63bd0a03a91f3cd7fb
**Duration**: ~30 minutes

---

## Pre-Test Setup

### 1. Start Services
```powershell
# Terminal 1: Start server
cd C:\Users\hetp2\OneDrive\Desktop\spotiireate\server
npm run dev

# Terminal 2: Start mobile (Expo)
cd C:\Users\hetp2\OneDrive\Desktop\spotiireate\mobile
npm run start
# Then press 'a' for Android or 'i' for iOS
```

### 2. Verify Server Health
```powershell
Invoke-RestMethod -Uri 'http://localhost:5000/ping'
# Expected: "pong"
```

### 3. Clear Test Data (Optional - Fresh Start)
```javascript
// In MongoDB Compass or mongo shell
use ratesangeet;
db.scrobbles.deleteMany({ userId: '690f3c63bd0a03a91f3cd7fb' });
db.trackstats.deleteMany({ userId: '690f3c63bd0a03a91f3cd7fb' });
db.albumstats.deleteMany({ userId: '690f3c63bd0a03a91f3cd7fb' });
db.userstatssummaries.deleteMany({ userId: '690f3c63bd0a03a91f3cd7fb' });
```

---

## Test Suite

### Test 1: Server-Assisted Scrobbling ✅
**Goal**: Verify V2 snapshot endpoint processes playback correctly

#### Steps:
1. Open Spotify on your device/desktop
2. Play a song (choose one you can easily verify)
3. Let it play for at least 40% (e.g., if 3min song, play ~1:12)
4. Wait 30 seconds for mobile app to poll and send snapshot
5. Check server logs for: `[REQ] POST /api/scrobble/v2/snapshot`

#### Verification Queries:
```powershell
# Check scrobbles collection
$userId = '690f3c63bd0a03a91f3cd7fb'
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/music/scrobbles/recent?userId=$userId&limit=5"
$response.data | Format-Table spotifyId, trackName, artistName, isScrobbled, playedAt

# Check track stats
$tracks = Invoke-RestMethod -Uri "http://localhost:5000/api/stats/track/$userId?limit=5"
$tracks.data | Format-Table trackName, artistName, playCount, lastPlayedAt

# Expected Results:
# - 1 scrobble in scrobbles collection (isScrobbled=true)
# - 1 entry in trackstats (playCount=1)
# - userstatssummaries.totalScrobbles = 1
```

### Test 2: Deduplication (Critical!) ✅
**Goal**: Verify same track session doesn't create duplicate scrobbles

#### Steps:
1. Continue playing the same song from Test 1
2. Wait for 3 more polling cycles (3 × 30s = 90s)
3. Song should still be playing during these polls

#### Verification:
```powershell
# Check scrobbles - should still be only 1 for this track
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/music/scrobbles/recent?userId=$userId&limit=10"
$trackId = $response.data[0].spotifyId
$duplicates = $response.data | Where-Object { $_.spotifyId -eq $trackId }
Write-Host "Scrobbles for track $trackId : $($duplicates.Count)"
# Expected: 1 (not 4!)

# Check track stats
$tracks = Invoke-RestMethod -Uri "http://localhost:5000/api/stats/track/$userId?limit=5"
$track = $tracks.data | Where-Object { $_.trackId -eq $trackId }
Write-Host "Play count: $($track.playCount)"
# Expected: 1 (dedup working!)
```

### Test 3: Skip Detection ✅
**Goal**: Verify tracks skipped before 40% are NOT scrobbled

#### Steps:
1. Play a new song on Spotify
2. Skip it after only 10-15 seconds (< 40%)
3. Wait 30 seconds for next poll

#### Verification:
```powershell
# Check recent scrobbles
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/music/scrobbles/recent?userId=$userId&limit=10"
$response.data | Select-Object -First 5 | Format-Table trackName, isScrobbled, progressMs, durationMs

# Expected: Skipped track should either:
# - Not appear at all, OR
# - Appear with isScrobbled=false
```

### Test 4: Replay Guard (15 min) ✅
**Goal**: Verify same track replayed immediately is NOT double-counted

#### Steps:
1. Play a song to completion (or >40%)
2. Immediately replay the same song from the beginning
3. Wait 30 seconds for poll

#### Verification:
```powershell
# Check track stats
$tracks = Invoke-RestMethod -Uri "http://localhost:5000/api/stats/track/$userId?limit=5"
$tracks.data[0] | Format-List trackName, playCount, lastPlayedAt, replayGuardAt

# Expected: playCount should still be 1 (not 2)
# replayGuardAt should be set to prevent double-counting

# Wait 15 minutes, then replay again - playCount should increment to 2
```

### Test 5: Album Completion (4-track min, 70%) ✅
**Goal**: Verify album completion logic works correctly

#### Steps:
1. Choose an album with at least 4 tracks (e.g., "Hot Fuss" by The Killers - 11 tracks)
2. Play 8 different tracks from this album (8/11 = 72.7% > 70% threshold)
3. Wait 30 seconds after each track for polling

#### Verification:
```powershell
# Check album stats
$albums = Invoke-RestMethod -Uri "http://localhost:5000/api/stats/album/$userId?limit=10"
$album = $albums.data | Where-Object { $_.albumName -like '*Hot Fuss*' }

Write-Host "Album: $($album.albumName)"
Write-Host "Total tracks: $($album.totalTracks)"
Write-Host "Unique played: $($album.uniqueTracksPlayed.Count)"
Write-Host "Progress: $($album.progressPercent)%"
Write-Host "Album play count (completions): $($album.albumPlayCount)"
Write-Host "Last completed: $($album.lastCompletedAt)"

# Expected:
# - uniqueTracksPlayed.Count = 8
# - progressPercent = 72% (or 73%, depends on rounding)
# - albumPlayCount = 1 (completion triggered!)
# - uniqueTracksPlayed reset to [] (ready for next cycle)
```

### Test 6: Stats Summary ✅
**Goal**: Verify user stats summary updates correctly

#### Steps:
After completing tests 1-5, check aggregated stats

#### Verification:
```powershell
# Get user stats summary
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/music/listening-stats?userId=$userId"
$response.data | Format-List totalScrobbles, totalMinutes, uniqueArtistsCount, lastScrobbled

# Expected:
# - totalScrobbles = number of valid scrobbles (40%+ plays)
# - totalMinutes = sum of all scrobble durations
# - lastScrobbled has most recent track info
```

### Test 7: Incremental Home Loading ✅
**Goal**: Verify mobile home screen loads fast with skeleton UI

#### Steps:
1. Open mobile app (already running from setup)
2. Navigate to Home screen
3. Observe loading behavior
4. Time how long until stats appear

#### Expected Behavior:
- **0-200ms**: Skeleton UI visible immediately (no blank screen)
- **200-800ms**: Stats cards populate (totalScrobbles, hours, artists)
- **800-1500ms**: Top albums list appears
- **Total**: < 1.5s perceived load time

#### Manual Verification:
- Pull-to-refresh should work
- Stats should update when new scrobbles added
- No full-page spinner blocking UI

### Test 8: Archive Job (Simulated) ✅
**Goal**: Verify archive job can fetch eligible scrobbles

**Note**: Since we just created test data, scrobbles won't be >83 days old. We'll test the endpoint manually.

#### Verification:
```powershell
# Test archive-ready endpoint (simulated old date)
$oldDate = (Get-Date).AddDays(-90).ToString('o')
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/music/scrobbles/archive-ready?userId=$userId&before=$oldDate"

Write-Host "Archive-ready scrobbles: $($response.data.Count)"
# Expected: 0 (since our test data is fresh)

# To properly test, you'd need to:
# 1. Manually update playedAt to 90+ days ago in MongoDB
# 2. Run archive job on mobile (will trigger on app focus)
# 3. Verify SQLite archive table has data
# 4. Verify cloud scrobbles deleted after ACK
```

### Test 9: Rate Limiting ✅
**Goal**: Verify rate limits protect endpoints

#### Test Snapshot Rate Limit (150/min):
```powershell
# Simulate rapid polling (should be blocked after 150 requests)
$userId = '690f3c63bd0a03a91f3cd7fb'
$accessToken = 'YOUR_ACCESS_TOKEN'  # Get from mobile app logs

$snapshot = @{
  spotifyId = "test-track-id"
  trackName = "Test Track"
  artistName = "Test Artist"
  durationMs = 180000
  progressMs = 90000
  timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  isPlaying = $true
} | ConvertTo-Json

for ($i = 1; $i -le 155; $i++) {
  try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/scrobble/v2/snapshot" `
      -Method POST -ContentType "application/json" `
      -Body (@{ userId=$userId; accessToken=$accessToken; snapshot=$snapshot } | ConvertTo-Json)
    Write-Host "Request $i : OK"
  } catch {
    if ($_.Exception.Response.StatusCode -eq 429) {
      Write-Host "✅ Rate limit hit at request $i (429 Too Many Requests)"
      break
    }
  }
  Start-Sleep -Milliseconds 400
}

# Expected: 429 error around request 150-155
```

### Test 10: Cache & ETag Behavior ✅
**Goal**: Verify caching reduces server load

#### Steps:
```powershell
# First request - cache miss
$response1 = Invoke-WebRequest -Uri "http://localhost:5000/api/stats/album/$userId?limit=5"
$etag1 = $response1.Headers.ETag
Write-Host "First request ETag: $etag1"
Write-Host "First request size: $($response1.Content.Length) bytes"

# Second request - should be cached
Start-Sleep -Seconds 2
$response2 = Invoke-WebRequest -Uri "http://localhost:5000/api/stats/album/$userId?limit=5"
$etag2 = $response2.Headers.ETag
Write-Host "Second request ETag: $etag2"
Write-Host "ETags match: $($etag1 -eq $etag2)"

# Third request with If-None-Match - should get 304
try {
  $response3 = Invoke-WebRequest -Uri "http://localhost:5000/api/stats/album/$userId?limit=5" `
    -Headers @{ 'If-None-Match' = $etag1 }
} catch {
  if ($_.Exception.Response.StatusCode -eq 304) {
    Write-Host "✅ 304 Not Modified received (cache working!)"
  }
}

# Wait 31 seconds, cache should expire (30s TTL)
Start-Sleep -Seconds 31
$response4 = Invoke-WebRequest -Uri "http://localhost:5000/api/stats/album/$userId?limit=5"
$etag4 = $response4.Headers.ETag
Write-Host "After TTL ETag: $etag4"
Write-Host "ETag changed after TTL: $($etag1 -ne $etag4)"
# Expected: true (new cache entry)
```

---

## Critical Validations Checklist

### Scrobbling Logic
- [ ] ✅ Track played to 40% creates scrobble (isScrobbled=true)
- [ ] ✅ Same track polled 3+ times = only 1 scrobble (dedup working)
- [ ] ✅ Track skipped <40% does NOT create scrobble
- [ ] ✅ Replay within 15 min does NOT double-count (replay guard)
- [ ] ✅ playedAtRounded10s used for dedup key

### Album Completion
- [ ] ✅ Albums with <4 tracks are ignored (singles/EPs)
- [ ] ✅ Playing 70% of unique tracks triggers completion
- [ ] ✅ albumPlayCount increments on completion
- [ ] ✅ uniqueTracksPlayed resets after completion
- [ ] ✅ Replaying completed album counts as new cycle

### Stats & Aggregations
- [ ] ✅ trackstats.playCount accurate
- [ ] ✅ albumstats.playCount accurate
- [ ] ✅ albumstats.progressPercent calculated correctly
- [ ] ✅ userstatssummaries.totalScrobbles accurate
- [ ] ✅ Stats update in real-time (<30s delay)

### Performance
- [ ] ✅ Home screen loads <1.5s (perceived)
- [ ] ✅ Skeleton UI shows immediately (no blank screen)
- [ ] ✅ Stats cards populate progressively
- [ ] ✅ API responses <30 KB (compressed)
- [ ] ✅ Cache TTL = 30s working

### Optimization
- [ ] ✅ Compression active (Content-Encoding: gzip)
- [ ] ✅ ETag responses working (304 Not Modified)
- [ ] ✅ Rate limits enforced (429 after threshold)
- [ ] ✅ Pagination working (hasMore, nextCursor)
- [ ] ✅ Minimal projections (.select() + .lean())

### Mobile
- [ ] ✅ ScrobbleContextV2 polls every 30s
- [ ] ✅ Archive job runs on app focus (max 1/day)
- [ ] ✅ Pull-to-refresh works
- [ ] ✅ No client-side complexity (server does everything)

---

## Known Limitations (Not Bugs)

1. **Archive job**: Requires scrobbles >83 days old to test fully
2. **Rate limits**: Disabled in development (NODE_ENV !== 'production')
3. **JWT auth**: Not yet implemented (Phase 5 partial - using x-user-id header)
4. **Offline sync**: Not yet implemented (V2 focuses on online real-time)

---

## Troubleshooting

### No scrobbles appearing?
- Check server logs for POST /api/scrobble/v2/snapshot
- Verify Spotify is actually playing (not paused)
- Check mobile app has valid access token
- Ensure song played >40% before poll

### Duplicate scrobbles?
- Check playedAtRounded10s values in MongoDB
- Verify dedup logic: `floor((timestamp - progressMs) / 10000) * 10000`
- Check if multiple users/devices polling same account

### Album completion not triggering?
- Verify album has ≥4 tracks (check totalTracks in albumstats)
- Count unique tracks played (check uniqueTracksPlayed array)
- Calculate: uniqueTracksPlayed.length / totalTracks >= 0.7

### Stats not updating?
- Check cache TTL (30s delay expected)
- Force refresh with ?force=1 query param
- Verify userstatssummaries document exists

---

## Success Criteria

✅ All 10 tests passing
✅ No duplicate scrobbles
✅ Album completion working (4-track min, 70%)
✅ Stats accurate and real-time
✅ Home screen <1.5s load
✅ Rate limits protecting endpoints
✅ Cache reducing server load
✅ Mobile V2 context working (zero complexity)

**When all checkboxes are ✅, Phase 11 is complete and ready for Phase 12 (deployment)!**
