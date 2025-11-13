# Quick E2E Test Helper for V2 System
# Run this after playing songs on Spotify

param(
    [string]$userId = '690f3c63bd0a03a91f3cd7fb',
    [switch]$Detailed
)

function Show-TestHeader {
    param([string]$title)
    Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

function Show-Section {
    param([string]$name)
    Write-Host "`n[$name]" -ForegroundColor Yellow
}

function Show-Success {
    param([string]$msg)
    Write-Host "✅ $msg" -ForegroundColor Green
}

function Show-Warning {
    param([string]$msg)
    Write-Host "⚠️  $msg" -ForegroundColor Yellow
}

function Show-Error {
    param([string]$msg)
    Write-Host "❌ $msg" -ForegroundColor Red
}

# Main Test
Show-TestHeader "V2 E2E Quick Test"

# Test 1: Server Health
Show-Section "1. Server Health"
try {
    $ping = Invoke-RestMethod -Uri 'http://localhost:5000/ping'
    Show-Success "Server responding: $ping"
} catch {
    Show-Error "Server not responding!"
    exit 1
}

# Test 2: Recent Scrobbles
Show-Section "2. Recent Scrobbles"
$scrobbles = Invoke-RestMethod -Uri "http://localhost:5000/api/music/scrobbles/recent?userId=$userId&limit=10"
Write-Host "Total scrobbles: $($scrobbles.data.Count)"

if ($scrobbles.data.Count -gt 0) {
    Write-Host "`nMost recent:" -ForegroundColor White
    $scrobbles.data | Select-Object -First 5 | Format-Table `
        @{L='Track';E={$_.trackName.Substring(0,[Math]::Min(30,$_.trackName.Length))}},
        @{L='Artist';E={$_.artistName.Substring(0,[Math]::Min(20,$_.artistName.Length))}},
        isScrobbled,
        @{L='PlayedAt';E={([DateTime]$_.playedAt).ToString('HH:mm:ss')}}
    
    # Check for duplicates
    $trackIds = $scrobbles.data | Select-Object -ExpandProperty spotifyId
    $uniqueIds = $trackIds | Select-Object -Unique
    if ($trackIds.Count -ne $uniqueIds.Count) {
        Show-Warning "Possible duplicates detected!"
        $grouped = $scrobbles.data | Group-Object spotifyId | Where-Object { $_.Count -gt 1 }
        foreach ($g in $grouped) {
            Write-Host "  - '$($g.Group[0].trackName)': $($g.Count) entries"
        }
    } else {
        Show-Success "No duplicates found (dedup working!)"
    }
} else {
    Show-Warning "No scrobbles yet. Play some songs on Spotify and wait 30s."
}

# Test 3: Track Stats
Show-Section "3. Track Stats"
$tracks = Invoke-RestMethod -Uri "http://localhost:5000/api/stats/track/$userId?limit=10"
Write-Host "Total tracks: $($tracks.data.Count)"

if ($tracks.data.Count -gt 0) {
    $tracks.data | Select-Object -First 5 | Format-Table `
        @{L='Track';E={$_.trackName.Substring(0,[Math]::Min(30,$_.trackName.Length))}},
        @{L='Artist';E={$_.artistName.Substring(0,[Math]::Min(20,$_.artistName.Length))}},
        playCount,
        @{L='LastPlayed';E={([DateTime]$_.lastPlayedAt).ToString('HH:mm')}}
    
    # Validate play counts
    $totalPlays = ($tracks.data | Measure-Object -Property playCount -Sum).Sum
    Write-Host "Total plays across all tracks: $totalPlays"
}

# Test 4: Album Stats
Show-Section "4. Album Stats"
$albums = Invoke-RestMethod -Uri "http://localhost:5000/api/stats/album/$userId?limit=10"
Write-Host "Total albums: $($albums.data.Count)"

if ($albums.data.Count -gt 0) {
    $albums.data | Select-Object -First 5 | Format-Table `
        @{L='Album';E={$_.albumName.Substring(0,[Math]::Min(30,$_.albumName.Length))}},
        @{L='Artist';E={$_.artistName.Substring(0,[Math]::Min(20,$_.artistName.Length))}},
        totalTracks,
        @{L='Played';E={$_.uniqueTracksPlayed.Count}},
        @{L='Progress%';E={[Math]::Round($_.progressPercent, 1)}},
        albumPlayCount
    
    # Check for completions
    $completed = $albums.data | Where-Object { $_.albumPlayCount -gt 0 }
    if ($completed.Count -gt 0) {
        Show-Success "Album completions detected:"
        foreach ($a in $completed) {
            Write-Host "  - '$($a.albumName)' completed $($a.albumPlayCount) time(s)"
        }
    }
}

# Test 5: User Stats Summary
Show-Section "5. User Stats Summary"
try {
    $summary = Invoke-RestMethod -Uri "http://localhost:5000/api/music/listening-stats?userId=$userId"
    $stats = $summary.data
    
    Write-Host "Total scrobbles: $($stats.totalScrobbles)" -ForegroundColor White
    Write-Host "Total minutes: $($stats.totalMinutes)" -ForegroundColor White
    Write-Host "Unique artists: $($stats.uniqueArtistsCount)" -ForegroundColor White
    
    if ($stats.lastScrobbled) {
        Write-Host "Last scrobbled: '$($stats.lastScrobbled.trackName)' by $($stats.lastScrobbled.artistName)" -ForegroundColor White
    }
    
    # Validation
    if ($stats.totalScrobbles -eq $scrobbles.data.Count) {
        Show-Success "Summary stats match scrobbles count"
    } else {
        Show-Warning "Summary stats ($($stats.totalScrobbles)) != scrobbles count ($($scrobbles.data.Count))"
    }
} catch {
    Show-Error "Failed to fetch user stats summary"
}

# Test 6: Cache & Performance
Show-Section "6. Cache & Performance"
$measure1 = Measure-Command {
    $response1 = Invoke-WebRequest -Uri "http://localhost:5000/api/stats/album/$userId?limit=5"
}
$etag1 = $response1.Headers.ETag
$size1 = $response1.Content.Length

Write-Host "First request: $($measure1.TotalMilliseconds)ms, Size: $size1 bytes"
Write-Host "ETag: $etag1"

Start-Sleep -Milliseconds 500

$measure2 = Measure-Command {
    $response2 = Invoke-WebRequest -Uri "http://localhost:5000/api/stats/album/$userId?limit=5"
}
$etag2 = $response2.Headers.ETag

Write-Host "Second request: $($measure2.TotalMilliseconds)ms"
if ($etag1 -eq $etag2) {
    Show-Success "Cache working (ETags match)"
} else {
    Show-Warning "ETags differ (might be expected if data changed)"
}

# Summary
Show-TestHeader "Test Summary"

$results = @{
    'Server Health' = $true
    'Scrobbles Created' = $scrobbles.data.Count -gt 0
    'No Duplicates' = ($trackIds.Count -eq $uniqueIds.Count)
    'Track Stats' = $tracks.data.Count -gt 0
    'Album Stats' = $albums.data.Count -gt 0
    'Cache Working' = ($etag1 -eq $etag2)
}

foreach ($key in $results.Keys) {
    if ($results[$key]) {
        Show-Success $key
    } else {
        Show-Warning "$key - Not tested or needs attention"
    }
}

Write-Host "`n📋 Full testing plan: docs/03-features/V2_E2E_TESTING_PLAN.md" -ForegroundColor Cyan
Write-Host "🎵 Next: Play songs on Spotify, wait 30s, run this script again`n" -ForegroundColor White
