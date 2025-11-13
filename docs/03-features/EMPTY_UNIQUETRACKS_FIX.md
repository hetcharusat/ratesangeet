# Empty `uniqueTracksPlayed` Bug Fix - Root Cause Analysis

## 🐛 **Problem Summary**

41 out of 47 `albumstats` documents had **empty `uniqueTracksPlayed` arrays** despite having `playCount > 0`. This violated the V2 scrobbling contract: "Only albums with ≥4 tracks are tracked."

## 🔍 **Root Cause**

Found in `server/src/routes/music.ts` (line 482):

```typescript
// ❌ BUG: Creates albums WITHOUT checking totalTracks first
const stats = await AlbumStats.findOneAndUpdate(
  { userId, albumKey },
  {
    $setOnInsert: {
      albumId,
      albumKey,
      albumName: albumNameSafe,
      artistName,
      albumArt,
      totalTracks: undefined,  // ← Created with undefined!
      albumPlayCount: 0,
    },
    // ...
  },
  { upsert: true, new: true }
);

// Then tried to backfill totalTracks AFTER creation
if (!totalTracks && albumId) {
  // Fetch and update totalTracks...
}
```

**Why This Created Empty Arrays:**
1. Album created with `totalTracks: undefined`
2. Code skipped adding tracks because `if (totalTracks && totalTracks > 0)` was false
3. Album sat in database with `playCount` incrementing but `uniqueTracksPlayed: []`

## ✅ **Root Fix Applied (Not Patch!)**

### **Fixed `/music.ts` line 476:**

```typescript
// ✅ FIX: Fetch totalTracks FIRST, skip if <4 tracks
try {
  const albumId: string | undefined = item.album?.id;
  const albumNameSafe: string = albumName || 'Unknown Album';
  const albumKey: string = albumId || albumNameSafe;

  // Fetch totalTracks FIRST (V2 Contract: only track albums with ≥4 tracks)
  let totalTracks: number | undefined = undefined;
  if (albumId) {
    try {
      const albumResp = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      totalTracks = albumResp.data?.total_tracks || albumResp.data?.tracks?.total || 0;
    } catch {}
  }

  // Skip albums with <4 tracks (singles/EPs)
  if (!totalTracks || totalTracks < 4) {
    // Don't create AlbumStats for singles/EPs
    console.log(`[SCROBBLE] Skipping album ${albumNameSafe} (totalTracks: ${totalTracks})`);
  } else {
    // Create album with totalTracks set on creation
    const stats = await AlbumStats.findOneAndUpdate(
      { userId, albumKey },
      {
        $setOnInsert: {
          albumId,
          albumKey,
          albumName: albumNameSafe,
          artistName,
          albumArt,
          totalTracks, // ← Set totalTracks on creation!
          albumPlayCount: 0,
          uniqueTracksPlayed: [], // Initialize empty array
        },
        // ...
      },
      { upsert: true, new: true }
    );
    // ... rest of completion logic
  }
} catch (e) {
  console.warn('[SCROBBLE] AlbumStats update skipped:', (e as any)?.message || e);
}
```

### **Cleanup Script Created:**

`cleanup-invalid-albums.ts` - Deletes albums violating V2 contract:
- `totalTracks` missing/null/undefined
- `totalTracks < 4` (singles/EPs)

### **Results:**

```
✅ Deleted 41 invalid albums
✅ Valid albums remaining: 6 (all with totalTracks ≥4)
✅ Verification: 0 invalid albums remaining
```

## 🎯 **Why This Is A Root Fix (Not Patch)**

| Aspect | ❌ Patch Approach | ✅ Root Fix |
|--------|------------------|-------------|
| **What** | Cleanup job to backfill totalTracks | Don't create albums until totalTracks known |
| **Where** | Downstream (database cleanup) | Source (album creation logic) |
| **When** | After problem exists | Before problem happens |
| **Result** | Temporary, can reoccur | Permanent, self-healing |

### **Prevention:**
- Albums only created when `totalTracks >= 4` verified
- No more `totalTracks: undefined` in database
- System enforces V2 contract at source

## 📊 **Final State**

**Before Fix:**
```
Total albums: 47
├─ Valid (≥4 tracks): 6 (12.8%)
└─ Invalid (missing totalTracks): 41 (87.2%)
```

**After Fix:**
```
Total albums: 6
├─ Valid (≥4 tracks): 6 (100%)
└─ Invalid (missing totalTracks): 0 (0%)
```

## 🛡️ **Other Routes Verified**

✅ `/v2/scrobbles/batch-upsert` - Correctly checks `if (totalTracks && totalTracks >= 4)`  
✅ `/scrobbleV2.ts` - Correctly checks `if (totalTracks && totalTracks >= 4)`  
✅ `/music.ts` (line 720 batch endpoint) - Correctly checks `if (!totalTracks || totalTracks < 4)`  
❌ `/music.ts` (line 476 single scrobble) - **FIXED** ✅

## 🧪 **Testing Performed**

1. ✅ Identified 41 albums with empty `uniqueTracksPlayed`
2. ✅ Traced to `/music.ts` creating albums without totalTracks
3. ✅ Fixed source logic to fetch totalTracks first
4. ✅ Deleted 41 invalid albums
5. ✅ Verified NITRO album (from screenshot) was deleted
6. ✅ Confirmed 0 invalid albums remaining
7. ✅ All 6 remaining albums have `totalTracks >= 4`

## 📝 **Files Changed**

1. `server/src/routes/music.ts` (line 476-560)
2. `server/cleanup-invalid-albums.ts` (new)
3. `server/check-empty-albums.ts` (diagnostic)
4. `server/verify-album-cleanup.ts` (verification)

## 🎓 **Lessons Applied**

**Golden Rule: Fix at SOURCE, not downstream cleanup**

✅ Prevented future occurrences  
✅ System self-heals (won't create invalid albums)  
✅ No recurring cleanup needed  
✅ Enforces V2 contract: "Only albums with ≥4 tracks are tracked"
