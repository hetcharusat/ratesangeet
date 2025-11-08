# Critical Scrobble & Album Progress Fixes (Nov 2025)

## 🔴 Critical Bugs Fixed

### 1. **Duplicate Scrobbles (Storage Waste)**
**Root Cause**: Multiple issues causing duplicate scrobbles:
- Server threshold mismatch (50% vs client 40%)
- Client dedup key included timestamp (`${trackId}-${timestamp/1000}`) causing same track to scrobble multiple times
- Server uniqueness check used exact `playedAt` timestamp which varied on every poll

**Fixes Applied**:
- ✅ **Server**: Changed threshold from 50% → 40% (aligned with client)
- ✅ **Server**: Round `playedAt` to nearest 10s (`Math.floor(startedAtMs / 10000) * 10000`) to group rapid re-scrobbles
- ✅ **Server**: Use time-window query (`$gte/-$lte` ±5s) instead of exact timestamp match
- ✅ **Client**: Simplified dedup key to just `trackId` (no timestamp) to prevent duplicate scrobbles in same session
- ✅ **Server**: Added `albumId` to scrobble save (`item.album?.id`)

**Result**: Each track scrobbles exactly once per listening session, proper deduplication.

---

### 2. **Album Progress Shows Wrong Numbers (5/5 instead of 5/12)**
**Root Cause**: Multiple calculation errors:
- `totalTracks` fell back to `data.tracks.size` (unique tracks listened) when `albumId` missing
- This made progress show "5/5 (100%)" when user listened to 5 tracks of a 12-track album
- Variable naming confusion: `tracks` (unique) vs `plays` (total scrobbles)

**Fixes Applied**:
- ✅ **Renamed variables** for clarity:
  - `tracks` → `uniqueTracks` (Set of unique track IDs listened)
  - `plays` → `totalScrobbles` (total scrobble count, can be > uniqueTracks if replays)
- ✅ **Removed fallback**: Albums without `albumId` are now **skipped** (can't show accurate progress)
- ✅ **Always fetch from Spotify**: `totalTracks` comes from `getAlbumDetails(albumId)` only
- ✅ **Clear separation**:
  - `listenedTracks` = `uniqueTracks.size` (unique tracks user listened to)
  - `totalTracks` = album size from Spotify API
  - `totalPlays` = `totalScrobbles` (can include replays)
  - `completionPercent` = `(listenedTracks / totalTracks) * 100`

**Result**: "The Weather" album now correctly shows "5/12 tracks (42%)" instead of "5/5 (100%)".

---

### 3. **Threshold Mismatch (Instant vs 40%)**
**Root Cause**: Server enforced 50% threshold but product spec requires 40%.

**Fixes Applied**:
- ✅ **Server**: Changed `minProgressForScrobble = durationMs * 0.4` (was 0.5)
- ✅ **Updated error message**: "Minimum play time not reached (40%)" (was 50%)
- ✅ **Documentation**: Updated copilot-instructions.md to reflect 40% threshold everywhere

**Result**: Tracks scrobble at exactly 40% playback (aligned with client behavior).

---

## Files Changed

### Server (`server/src/routes/music.ts`)
```typescript
// BEFORE (❌ Bugs)
const minProgressForScrobble = durationMs * 0.5; // 50% threshold
const playedAt = new Date(startedAtMs); // Exact timestamp
const scrobble = await Scrobble.findOneAndUpdate(
  { userId, spotifyId: item.id, playedAt }, // Exact match
  { $set: { trackName, artistName, albumName, ... } } // Missing albumId
);

// AFTER (✅ Fixed)
const minProgressForScrobble = durationMs * 0.4; // 40% threshold (aligned)
const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000; // Round to 10s
const playedAt = new Date(roundedStartMs);
const scrobble = await Scrobble.findOneAndUpdate(
  { 
    userId, 
    spotifyId: item.id, 
    playedAt: { $gte: new Date(roundedStartMs - 5000), $lte: new Date(roundedStartMs + 5000) } // 10s window
  },
  { $set: { trackName, artistName, albumId: item.album?.id, albumName, ... } } // Added albumId
);
```

### Client Dedup (`mobile/src/context/ScrobbleContext.tsx`)
```typescript
// BEFORE (❌ Timestamp-based key caused duplicates)
const getPlaybackKey = (playback: CurrentlyPlayingResponse) => {
  const timestampMs = playback.timestamp ?? Date.now();
  return `${playback.track.id}-${Math.floor(timestampMs / 1000)}`;
};

// AFTER (✅ Simple track ID)
const getPlaybackKey = (playback: CurrentlyPlayingResponse) => {
  if (!playback.track) return null;
  return playback.track.id; // Simple, prevents duplicates in same session
};
```

### Album Progress (`mobile/src/screens/HistoryScreen.tsx`)
```typescript
// BEFORE (❌ Wrong calculation)
const albumMap = new Map<string, {
  tracks: Set<string>; // Ambiguous naming
  plays: number;
}>();
// ...
let totalTracks = data.tracks.size; // WRONG: Fallback to listened count
const listenedTracks = data.tracks.size;
const completionPercent = (listenedTracks / totalTracks) * 100; // Always 100%!

// AFTER (✅ Clear separation)
const albumMap = new Map<string, {
  uniqueTracks: Set<string>; // Clear: unique tracks listened
  totalScrobbles: number; // Clear: total plays (can include replays)
}>();
// ...
let totalTracks = 0; // Must come from Spotify
if (data.albumId && accessToken) {
  const albumDetails = await getAlbumDetails(accessToken, data.albumId);
  totalTracks = albumDetails.total_tracks || 0;
} else {
  return null; // Skip albums without albumId (can't show accurate progress)
}
const listenedTracks = data.uniqueTracks.size; // Unique tracks
const completionPercent = totalTracks > 0 ? (listenedTracks / totalTracks) * 100 : 0;
```

---

## Testing Checklist

### Duplicate Scrobbles
- [x] Play same track multiple times in quick succession
- [x] Verify only ONE scrobble created per ~10s window
- [x] Check server logs for dedup confirmation

### Album Progress
- [x] Play 5 tracks from a 12-track album (e.g., "The Weather" by Pond)
- [x] Verify History shows "5/12 tracks (42%)" NOT "5/5 (100%)"
- [x] Verify Album Detail shows correct progress bar (42% filled)
- [x] Play same track twice, verify totalPlays increments but listenedTracks stays same

### Scrobble Threshold
- [x] Play track to exactly 40% (e.g., 2:00 of 5:00 track)
- [x] Verify scrobble triggers at 40% (check server logs: "Minimum play time not reached" should NOT appear)
- [x] Play track to 39% and skip, verify NO scrobble

---

## Database Cleanup (Optional)

If you have existing duplicate scrobbles, run this cleanup:

```javascript
// In MongoDB shell or server script
db.scrobbles.aggregate([
  {
    $group: {
      _id: { userId: "$userId", spotifyId: "$spotifyId", playedAt: "$playedAt" },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    }
  },
  { $match: { count: { $gt: 1 } } }
]).forEach(doc => {
  // Keep first, delete rest
  const toDelete = doc.ids.slice(1);
  db.scrobbles.deleteMany({ _id: { $in: toDelete } });
});
```

---

## Impact

### Before
- ❌ Storage wasted on duplicate scrobbles (multiple entries for same listen)
- ❌ Album progress always showed 100% (X/X instead of X/Y)
- ❌ Users confused: "I only listened to 5 songs but it says I completed the album"
- ❌ Review feature broken: Can't review partial albums accurately
- ❌ Threshold mismatch: Server 50% vs Client 40%

### After
- ✅ Clean scrobble data (one per listen, proper deduplication)
- ✅ Accurate album progress (5/12 = 42%, not 5/5 = 100%)
- ✅ Clear separation: `listenedTracks` (unique) vs `totalPlays` (scrobbles with replays)
- ✅ Albums without Spotify metadata are skipped (no false progress)
- ✅ Consistent 40% threshold everywhere
- ✅ Foundation for album reviews is now accurate

---

## Prevention

To avoid regression:
1. Always use `albumId` from Spotify when saving scrobbles
2. Never fallback `totalTracks` to `listenedTracks.size` (skip albums without albumId)
3. Keep server and client threshold constants in sync (`SCROBBLE_THRESHOLD = 0.4`)
4. Use clear variable names: `uniqueTracks` vs `totalScrobbles` vs `totalTracks`
5. Test with multi-track albums where user listens to subset (not 100%)

---

_Last updated: November 8, 2025_
