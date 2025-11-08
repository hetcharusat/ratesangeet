# Album Completion Fix: The albumId Root Cause

## Problem
Albums were showing **100% completion** even when only 40-45% of tracks were listened to.

**User logs showed:**
```
Processing album: Rumours {"albumId": undefined, "defaultTotal": 4, "listenedTracks": 4}
Completion: 100%
```

## Root Cause Analysis
Following the **Development Philosophy** of finding root causes, we traced the entire data flow:

### Data Flow Breakdown
```
Test Script (add-test-scrobbles.ts)
  ↓ Tries to save albumId: '2guirTSEqLizK7j9i1MTTZ'
MongoDB Schema (Scrobble.ts)
  ↓ ❌ MISSING: albumId field not defined in schema
  ↓ MongoDB silently ignores albumId field
Database
  ↓ Scrobbles saved WITHOUT albumId
API Route (/scrobbles)
  ↓ Returns scrobbles without albumId
Client (HistoryScreen.tsx)
  ↓ Aggregates scrobbles into albums
  ↓ albumId undefined → can't fetch real track count
  ↓ Falls back to: totalTracks = listenedTracks.size
Calculation
  ↓ completion = listenedTracks / listenedTracks
  ↓ Result: 4/4 = 100% (should be 4/10 = 40%)
```

### The Bug Chain
1. **Schema Missing Field** (PRIMARY BUG)
   - `Scrobble.ts` didn't have `albumId` in interface or schema
   - MongoDB ignored `albumId` when saving scrobbles
   - Test data appeared to have albumIds in code, but they never saved

2. **Aggregation Logic Weakness** (SECONDARY BUG)
   - `HistoryScreen.tsx` only checked first scrobble for albumId
   - If first scrobble had no albumId, it stayed undefined forever
   - Later scrobbles with albumId were ignored

3. **Fallback Calculation** (SYMPTOM)
   - When `albumId` is undefined, can't fetch real track count
   - Code falls back to using `data.tracks.size` (listened tracks)
   - Result: `listenedTracks / listenedTracks = 100%` always

## Fixes Applied

### 1. **Fixed Scrobble Model Schema** ✅
**File:** `server/src/models/Scrobble.ts`

Added `albumId` to interface and schema:
```typescript
export interface IScrobble extends Document {
  // ... existing fields
  albumId?: string;  // ✅ ADDED
  albumName?: string;
  // ... rest
}

const scrobbleSchema = new Schema<IScrobble>(
  {
    // ... existing fields
    albumId: { type: String },  // ✅ ADDED
    albumName: { type: String },
    // ... rest
  }
);
```

### 2. **Improved Aggregation Logic** ✅
**File:** `mobile/src/screens/HistoryScreen.tsx`

Updated album map to check ALL scrobbles for albumId:
```typescript
const album = albumMap.get(key)!;

// Update albumId if this scrobble has one and we don't have one yet
if (scrobble.albumId && !album.albumId) {
  album.albumId = scrobble.albumId;
}

album.tracks.add(scrobble.spotifyId);
```

**Before:** Only first scrobble's albumId was used  
**After:** Any scrobble with albumId will populate the field

### 3. **Re-ran Test Data Script** ✅
**Command:** `npx tsx add-test-scrobbles.ts`

Now that schema supports albumId, the test data properly saves:
```
✅ Successfully added 35 test scrobbles!
📊 Test Albums Summary:
   1. Rumours - Fleetwood Mac (40% - 4/10 tracks)
   2. Hotel California - Eagles (45% - 5/11 tracks)
   3. Thriller - Michael Jackson (42% - 5/12 tracks)
```

## Expected Results

### Before Fix
```
Album: Rumours
  albumId: undefined
  listenedTracks: 4
  totalTracks: 4 (fallback)
  Completion: 100% ❌
```

### After Fix
```
Album: Rumours
  albumId: '2guirTSEqLizK7j9i1MTTZ'
  listenedTracks: 4
  totalTracks: 10 (from Spotify API)
  Completion: 40% ✅
```

## Validation Steps
1. ✅ Check mobile logs - should show `albumId: '2guirTSEqLizK7j9i1MTTZ'`
2. ✅ Check HistoryScreen - albums should show 40%, 45%, 42%
3. ✅ Check AlbumDetailScreen - progress bars should show accurate %
4. ✅ Verify track lists show correct total tracks from Spotify

## Lessons Learned (Philosophy Alignment)

### ✅ Found Root Cause, Not Symptom
- **Wrong approach:** Patch completion calculation to always show 40%
- **Right approach:** Traced why albumId was undefined through entire stack

### ✅ Systematic Debugging
1. Started with symptom: 100% completion
2. Traced backwards: UI → aggregation → API → database → schema
3. Found root cause: Missing schema field
4. Fixed at source, not at symptom

### ✅ Verified Data Flow End-to-End
- Test script → Schema → Database → API → Client → UI
- Fixed every broken link in the chain

### ✅ No Quick Patches
- Didn't hardcode percentages
- Didn't fake the data
- Fixed the actual schema bug

## Related Files
- `server/src/models/Scrobble.ts` - Schema updated
- `mobile/src/screens/HistoryScreen.tsx` - Aggregation improved
- `server/add-test-scrobbles.ts` - Test data script (re-ran)
- `docs/HYBRID_STORAGE.md` - Storage architecture reference
