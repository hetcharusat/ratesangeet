# Phase 6: Local Server Testing Guide

**Purpose**: Validate Phase 4 + 5 changes before deployment
**Prerequisites**: Server running on `http://localhost:5000`
**Tools**: PowerShell + Invoke-RestMethod

---

## Test 1: Health Check ✅
```powershell
Invoke-RestMethod -Uri 'http://localhost:5000/ping'
# Expected: "pong"
```

---

## Test 2: Stats - Albums (Default)
```powershell
# Replace USER_ID with your actual MongoDB user ObjectId
$userId = "507f1f77bcf86cd799439011"  # Example user ID

$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId" `
  -Method GET

# Check response structure
$response | ConvertTo-Json -Depth 3

# Verify:
# - success: true
# - data: array of albums (max 20)
# - cache.hasMore: true/false
# - cache.nextCursor: ObjectId string or null
```

---

## Test 3: Stats - Albums (Paginated)
```powershell
# First page
$page1 = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId?limit=5" `
  -Method GET

# Second page using cursor
$cursor = $page1.cache.nextCursor
$page2 = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId?limit=5&before=$cursor" `
  -Method GET

# Verify:
# - page1.data.length = 5
# - page2.data.length <= 5
# - page1.data[0]._id != page2.data[0]._id (different results)
```

---

## Test 4: Stats - Albums (Sorted by Completion)
```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId?limit=10&sort=albumPlayCount" `
  -Method GET

# Verify:
# - Albums sorted by albumPlayCount DESC
# - Each album has progressPercent field
```

---

## Test 5: Stats - Tracks (Default)
```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/track/$userId?limit=10" `
  -Method GET

# Verify:
# - success: true
# - data: array of tracks (max 10)
# - cache.hasMore: true/false
# - cache.nextCursor: ObjectId string or null
```

---

## Test 6: Stats - Tracks (Sorted by Recent)
```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/track/$userId?limit=10&sort=lastPlayedAt" `
  -Method GET

# Verify:
# - Tracks sorted by lastPlayedAt DESC (most recent first)
```

---

## Test 7: Compression (Check Headers)
```powershell
$response = Invoke-WebRequest `
  -Uri "http://localhost:5000/api/stats/album/$userId" `
  -Method GET

# Check response headers
$response.Headers

# Verify:
# - Content-Encoding: gzip (if response > 1KB)
# - Content-Length: small size (compressed)
# - X-API-Envelope: transitional-v1
```

---

## Test 8: ETag / Conditional GET
```powershell
# First request - get ETag
$response1 = Invoke-WebRequest `
  -Uri "http://localhost:5000/api/stats/album/$userId" `
  -Method GET

$etag = $response1.Headers.ETag

# Second request - use If-None-Match
try {
  $response2 = Invoke-WebRequest `
    -Uri "http://localhost:5000/api/stats/album/$userId" `
    -Method GET `
    -Headers @{ 'If-None-Match' = $etag }
  
  Write-Host "Status: $($response2.StatusCode)"
} catch {
  if ($_.Exception.Response.StatusCode -eq 304) {
    Write-Host "✅ 304 Not Modified (cache hit)"
  }
}
```

---

## Test 9: Cache TTL (30 seconds)
```powershell
# First request
$response1 = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId" `
  -Method GET

Write-Host "Cache expires at: $($response1.cache.expiresAt)"
Write-Host "Current time: $(Get-Date -Format 'o')"

# Wait 35 seconds
Start-Sleep -Seconds 35

# Second request (should be fresh, not cached)
$response2 = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId" `
  -Method GET

# Verify:
# - response2.cache.expiresAt > response1.cache.expiresAt (new cache entry)
```

---

## Test 10: Force Bypass Cache
```powershell
# Normal request (cache hit possible)
$response1 = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId" `
  -Method GET

# Force fresh data
$response2 = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId?force=1" `
  -Method GET

# Verify:
# - Both succeed
# - response2.cache.source: 'database' (forced)
```

---

## Test 11: V2 Snapshot (Server-Assisted Scrobbling)
```powershell
# Get user and access token (replace with real values)
$userId = "507f1f77bcf86cd799439011"
$accessToken = "BQC4u7..."  # Spotify access token

# Mock playback snapshot
$snapshot = @{
  spotifyId = "3n3Ppam7vgaVa1iaRUc9Lp"  # Example track
  trackName = "Mr. Brightside"
  artistName = "The Killers"
  albumId = "4OHNH3sDzIxnmUADXzv2kT"
  albumName = "Hot Fuss"
  durationMs = 222973
  progressMs = 120000  # 2 minutes (> 40% threshold)
  timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  isPlaying = $true
  device = "PowerShell Test"
}

$body = @{
  userId = $userId
  accessToken = $accessToken
  snapshot = $snapshot
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/scrobble/v2/snapshot" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

# Verify:
# - action: 'scrobbled' | 'duplicate' | 'too-early'
# - stats: { totalScrobbles, ... }
```

---

## Test 12: Rate Limiting (Snapshot Endpoint)
```powershell
# Send 151 requests in 1 minute (should hit limit at 150)
$userId = "507f1f77bcf86cd799439011"
$accessToken = "BQC4u7..."

$snapshot = @{
  spotifyId = "test-track"
  trackName = "Test"
  artistName = "Test Artist"
  durationMs = 180000
  progressMs = 90000
  timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  isPlaying = $true
}

$body = @{
  userId = $userId
  accessToken = $accessToken
  snapshot = $snapshot
} | ConvertTo-Json

for ($i = 1; $i -le 151; $i++) {
  try {
    $response = Invoke-RestMethod `
      -Uri "http://localhost:5000/api/scrobble/v2/snapshot" `
      -Method POST `
      -ContentType "application/json" `
      -Body $body
    
    Write-Host "Request $i - OK"
  } catch {
    if ($_.Exception.Response.StatusCode -eq 429) {
      Write-Host "✅ Request $i - Rate limit hit (429 Too Many Requests)"
      break
    }
  }
  
  Start-Sleep -Milliseconds 400  # ~150 requests/min
}

# Verify:
# - First 150 succeed
# - 151st returns 429 Too Many Requests
```

---

## Test 13: Payload Size Check
```powershell
# Get stats with compression
$response = Invoke-WebRequest `
  -Uri "http://localhost:5000/api/stats/album/$userId?limit=100" `
  -Method GET

$compressedSize = $response.Content.Length
Write-Host "Compressed payload size: $compressedSize bytes"

# Verify:
# - compressedSize < 30000 (< 30 KB target)
# - Content-Encoding: gzip
```

---

## Test 14: Album Progress Percentage
```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId?limit=5" `
  -Method GET

# Check first album
$album = $response.data[0]
Write-Host "Album: $($album.albumName)"
Write-Host "Total Tracks: $($album.totalTracks)"
Write-Host "Unique Played: $($album.uniqueTracksPlayed.Count)"
Write-Host "Progress: $($album.progressPercent)%"

# Verify:
# - progressPercent = (uniqueTracksPlayed.length / totalTracks) * 100
# - Only albums with totalTracks >= 4 have progress
```

---

## Test 15: Max Limit Enforcement
```powershell
# Try to request more than max (100)
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/stats/album/$userId?limit=500" `
  -Method GET

# Verify:
# - data.length <= 100 (hard cap)
# - cache.hasMore: true (if more results exist)
```

---

## Validation Checklist

### Functionality
- [ ] Health check returns "pong"
- [ ] Albums endpoint returns paginated results
- [ ] Tracks endpoint returns paginated results
- [ ] Sorting works (playCount, lastPlayedAt, albumPlayCount)
- [ ] Cursor pagination works (before parameter)
- [ ] Progress percentage calculated correctly
- [ ] Max limit enforced (100 items)
- [ ] V2 snapshot endpoint processes scrobbles

### Performance
- [ ] Compression active (Content-Encoding: gzip)
- [ ] Payload sizes < 30 KB (typical)
- [ ] ETag responses working (304 Not Modified)
- [ ] Cache TTL = 30s (check expiresAt)
- [ ] Force bypass works (?force=1)

### Security
- [ ] Rate limits active (429 after threshold)
- [ ] Snapshot rate limit: 150/min
- [ ] Batch upsert rate limit: 100/min
- [ ] Rate limits **disabled in dev** (NODE_ENV !== production)

### Response Format
- [ ] `success: true` in all successful responses
- [ ] `cache` object present with metadata
- [ ] `hasMore` and `nextCursor` in paginated responses
- [ ] `progressPercent` in album stats

---

## Notes

### Getting User ID
If you don't have a user ID, you can:
1. Check MongoDB: `db.users.findOne({})._id`
2. Login to mobile app and check logs
3. Use test-scenario-v2.ts output (shows created user ID)

### Getting Access Token
1. Login to mobile app
2. Check network logs for any Spotify API call
3. Extract `Authorization: Bearer <token>` header
4. Or use Spotify's [Web API Console](https://developer.spotify.com/console/get-current-user/)

### Production vs Development
- **Development** (`NODE_ENV=development` or not set):
  - Rate limits disabled
  - Verbose console logging
  - No compression threshold (compress all)
- **Production** (`NODE_ENV=production`):
  - Rate limits active
  - Minimal logging
  - Compression only if > 1KB

---

## Expected Results Summary

| Test | Expected Outcome | Pass Criteria |
|------|------------------|---------------|
| Health Check | "pong" | Response = "pong" |
| Albums Default | 20 albums | data.length <= 20 |
| Albums Paginated | 5 albums per page | data.length = 5 |
| Albums Sorted | Sorted by albumPlayCount | data[0].albumPlayCount >= data[1].albumPlayCount |
| Tracks Default | 10 tracks | data.length <= 10 |
| Tracks Sorted | Sorted by lastPlayedAt | data[0].lastPlayedAt >= data[1].lastPlayedAt |
| Compression | gzip header | Content-Encoding: gzip |
| ETag | 304 response | StatusCode = 304 |
| Cache TTL | 30s expiry | expiresAt ~30s after cachedAt |
| Force Bypass | Fresh data | cache.source = 'database' |
| V2 Snapshot | Scrobble processed | action = 'scrobbled' |
| Rate Limit | 429 after threshold | StatusCode = 429 |
| Payload Size | < 30 KB | Content-Length < 30000 |
| Progress % | Calculated correctly | progressPercent = (played/total)*100 |
| Max Limit | <= 100 items | data.length <= 100 |

---

**Status**: Ready for testing
**Next**: Run tests and document results in Phase 6 completion summary
