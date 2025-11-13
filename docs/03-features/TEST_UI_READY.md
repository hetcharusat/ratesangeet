# 🧪 V2 Test UI - Ready for Manual Testing!

## Overview
Created a dedicated **Test Scrobble Screen** in the mobile app for manual V2 system testing with real-time feedback.

## What Was Added

### 1. New Screen: `TestScrobbleScreen.tsx`
**Location**: `mobile/src/screens/TestScrobbleScreen.tsx`

**Features**:
- ✅ Real-time current playback display from Spotify
- ✅ Progress percentage calculator (shows if ≥40% for scrobble)
- ✅ Manual "Send Snapshot Now" button
- ✅ Recent scrobbles list (last 10)
- ✅ Top tracks stats (top 5 by play count)
- ✅ Top albums with completion progress
- ✅ Pull-to-refresh for instant updates
- ✅ Testing instructions built-in

### 2. Navigation Update
**Added to**: `mobile/src/navigation/MainNavigator.tsx`

New "Test" tab with flask icon 🧪 in bottom navigation (5th tab)

## How to Use

### 1. Open the App
```bash
# If mobile isn't running:
cd mobile
npm run start
# Press 'a' for Android or 'i' for iOS
```

### 2. Navigate to Test Tab
Tap the **flask icon (🧪)** in the bottom navigation

### 3. Manual Testing Flow

#### Step 1: Play a Song on Spotify
- Open Spotify (desktop or mobile)
- Play any song
- App will auto-detect within 5 seconds

#### Step 2: Check Progress
The **Current Playback** card shows:
- Track name, artist, album
- Progress: `108s / 240s`
- Percentage: `45%`
- Status: `✅ Will scrobble (≥40%)` or `⏳ Not yet (needs 40%)`

#### Step 3: Send Snapshot
**Option A** (Manual - instant):
- Tap **"Send Snapshot Now"** button
- See instant alert with response
- Data updates automatically after 2s

**Option B** (Automatic - wait 30s):
- V2 context polls every 30 seconds
- Pull down to refresh stats

#### Step 4: Verify Results
Check the cards below:
- **📊 Current Stats**: Total scrobbles, tracks, albums
- **🎶 Recent Scrobbles**: Last 10 scrobbles with timestamps
- **🎵 Top Tracks**: Most played tracks
- **💿 Top Albums**: Album completion progress

### 4. Test Specific Features

#### ✅ Deduplication Test
1. Play same song 3 times in a row
2. Tap "Send Snapshot Now" 3 times
3. Pull to refresh
4. **Expected**: Only 1 scrobble (not 3!)

#### ✅ Skip Detection Test
1. Play a song for only 10-15 seconds (< 40%)
2. Skip to next song
3. Wait 30s or send manual snapshot
4. **Expected**: Skipped track NOT in scrobbles list

#### ✅ Album Completion Test
1. Choose an album with 4+ tracks (e.g., 11 tracks)
2. Play 8 different tracks from that album (8/11 = 73% > 70%)
3. Check **Top Albums** card
4. **Expected**: 
   - Progress: 73%
   - Completions: 1
   - Album play count incremented

## UI Components

### Current Playback Card
```
🎵 Current Playback
─────────────────────
MAFIA
Babymonster
DRIP
─────────────────────
Progress: 108s / 240s
Percentage: 45%
✅ Will scrobble (≥40%)

[Send Snapshot Now] [Refresh Playback]
```

### Recent Scrobbles Card
```
🎶 Recent Scrobbles (Last 10 scrobbles)
─────────────────────
1. MAFIA
   Babymonster
   ✅ Scrobbled
   02:34:15 PM

2. Drip
   Babymonster  
   ✅ Scrobbled
   02:32:10 PM
```

### Top Albums Card
```
💿 Top Albums (Album completion progress)
─────────────────────
1. DRIP
   Babymonster
   Plays: 8 | Completions: 1
   Progress: 73% ✅
```

## Testing Checklist

Use the **📋 Testing Instructions** card at the bottom of the screen:

- [ ] Play song >40% → verify scrobble created
- [ ] Same song 3x → verify only 1 scrobble (dedup working)
- [ ] Skip song <40% → verify NOT scrobbled
- [ ] Play 70%+ of 4+ track album → verify completion
- [ ] Pull to refresh → verify stats update
- [ ] Manual snapshot button → verify instant response

## Live Data Flow

```
Spotify Playing
    ↓ (5s auto-poll)
Current Playback Card (updates)
    ↓ (manual tap OR 30s V2 poll)
Send Snapshot to Server
    ↓
Server Processes (40%, dedup, album logic)
    ↓ (2s delay)
Stats Cards Update (pull to refresh)
    ↓
Recent Scrobbles, Top Tracks, Top Albums
```

## Troubleshooting

### "No track playing" shown?
- Open Spotify and play a song
- Wait 5 seconds for auto-detection
- Tap "Refresh Playback" button

### Snapshot fails?
- Check server is running: `http://localhost:5000/ping`
- Verify user is logged in (accessToken present)
- Check server logs for errors

### Stats not updating?
- Pull down to refresh
- Wait 2 seconds after sending snapshot
- Check database: `.\test-e2e-quick.ps1`

### Duplicates appearing?
- **This is the bug we're testing for!**
- If duplicates appear, check `playedAtRounded10s` values in DB
- Verify dedup logic in `scrobbleV2.ts`

## Next Steps After Testing

1. **Complete manual tests** using this UI
2. **Run quick test script**: `.\test-e2e-quick.ps1`
3. **Verify no duplicates** in database
4. **Test album completion** (4-track min, 70%)
5. **Check home screen** loads <1.5s with skeleton UI

## Files Modified

- ✅ `mobile/src/screens/TestScrobbleScreen.tsx` (NEW - 400 lines)
- ✅ `mobile/src/navigation/MainNavigator.tsx` (added Test tab)

---

**🎯 Test UI is ready! Open the mobile app and tap the flask icon (🧪) to start testing!**
