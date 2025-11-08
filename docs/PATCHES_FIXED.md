# Root Cause Analysis & Fixes Applied

## Issues Found & Fixed

### Issue 1: AlbumStats Route Used Wrong Filter Key ✅ FIXED
**Root Cause**: `server/src/routes/stats.ts` POST `/album-batch-upsert` was filtering by `albumId` instead of `albumKey`, causing mismatches with the AlbumStats model schema.

**Impact**: Album stats upserts would fail or create duplicate entries.

**Fix**: Changed filter from `{ userId, albumId }` to `{ userId, albumKey }` and compute `albumKey = albumId || albumName` before upserting.

---

### Issue 2: Server Not Extracting Album ID from Spotify ✅ FIXED
**Root Cause**: `server/src/routes/music.ts` POST `/sync-recent` extracted `track.album.name` and `track.album.images` but NOT `track.album.id`.

**Impact**: Client receives scrobbles without `albumId`, causing local aggregation to group only by album name (unreliable).

**Fix**: Added `const albumId = track.album?.id;` and included it in `itemsForClient`.

---

### Issue 3: Client API Type Missing albumId ✅ FIXED
**Root Cause**: `mobile/src/services/api.ts` `syncRecentPlays` return type didn't include `albumId` in items array.

**Impact**: TypeScript wouldn't catch missing albumId; potential runtime undefined.

**Fix**: Added `albumId?: string` to the items type definition.

---

### Issue 4: Client Not Saving albumId Locally ✅ FIXED
**Root Cause**: `mobile/src/context/ScrobbleContext.tsx` mapped server items to local scrobbles but omitted `albumId: it.albumId`.

**Impact**: Local SQLite scrobbles table `albumId` column stayed NULL even when Spotify provided it.

**Fix**: Added `albumId: it.albumId` to the mapping.

---

### Issue 5: SQL Aggregation Grouped by Wrong Key ✅ FIXED
**Root Cause**: `mobile/src/storage/sqlite.ts` `getAlbumAggregatesSince` used `COALESCE(albumId, '')` but didn't fallback to `albumName` when `albumId` was NULL.

**Impact**: Albums without IDs would be grouped under empty string; album name-based grouping wouldn't work.

**Fix**: Changed to `COALESCE(albumId, albumName, '')` in both SELECT and GROUP BY, and added `HAVING albumId != ''` to filter out empty keys.

---

### Issue 6: Client Filtered Out Valid Aggregates ✅ FIXED
**Root Cause**: `mobile/src/context/ScrobbleContext.tsx` called `.filter((a) => a.albumId)` which would exclude albums that only have `albumName`.

**Impact**: Albums without Spotify IDs wouldn't sync to cloud.

**Fix**: Removed the filter since SQL query now handles empty check via HAVING clause.

---

## Summary of Patches Applied

| # | File | Change | Reason |
|---|------|--------|--------|
| 1 | `server/src/routes/stats.ts` | Use `albumKey` instead of `albumId` for filter/upsert | Match AlbumStats schema |
| 2 | `server/src/routes/music.ts` | Extract `albumId` from Spotify API | Provide complete data to client |
| 3 | `mobile/src/services/api.ts` | Add `albumId?` to syncRecentPlays type | Type safety |
| 4 | `mobile/src/context/ScrobbleContext.tsx` | Map `albumId` when saving locally | Populate SQLite column |
| 5 | `mobile/src/storage/sqlite.ts` | Fix aggregation GROUP BY key | Proper album grouping |
| 6 | `mobile/src/context/ScrobbleContext.tsx` | Remove `.filter((a) => a.albumId)` | Don't exclude valid albums |

---

## Models & Schema Status

### Server (MongoDB)
- ✅ `AlbumStats`: Uses `albumKey` (unique), stores optional `albumId`
- ✅ `TrackStats`: Uses `trackKey` (unique), stores optional `trackId`
- ✅ `UserStatsSummary`: Stores `totalScrobbles` and `lastScrobbled`
- ✅ Archive job: Uses `albumKey` correctly

### Mobile (SQLite)
- ✅ Table schema includes `albumId TEXT`
- ✅ Aggregation uses `COALESCE(albumId, albumName)`
- ✅ Both album and track aggregates implemented

---

## Data Flow (After Fixes)

1. **Spotify API → Server**
   - Extract: `track.id`, `track.name`, `track.album.id`, `track.album.name`, etc.
   
2. **Server → Mobile (if CLOUD_ENABLE_SCROBBLES=false)**
   - Return items[] with full metadata including `albumId`
   
3. **Mobile → Local SQLite**
   - Save with `albumId`, `albumName`, `trackName`, etc.
   
4. **Mobile → Cloud (on app open)**
   - Aggregate by `albumKey = albumId || albumName`
   - Aggregate by `trackKey = trackId || (trackName + artistName)`
   - POST to `/api/stats/album-batch-upsert` and `/api/stats/track-batch-upsert`

5. **Cloud Storage**
   - AlbumStats keyed by `albumKey`, stores both `albumId` and `albumName`
   - TrackStats keyed by `trackKey`, stores both `trackId` and `trackName+artistName`

---

## Testing Checklist

- [ ] Start server with `CLOUD_ENABLE_SCROBBLES=false`
- [ ] Open mobile app, trigger sync-recent
- [ ] Verify local SQLite has `albumId` populated
- [ ] Check album/track aggregates compute correctly
- [ ] Verify cloud AlbumStats and TrackStats get upserted
- [ ] Run archive job and verify no errors
- [ ] Test with albums that have/don't have Spotify IDs

---

## Files Modified (Final List)

1. `server/src/routes/stats.ts` - Album/track upsert logic
2. `server/src/routes/music.ts` - Extract albumId from Spotify
3. `server/src/jobs/archiveScrobbles.ts` - Already correct (uses albumKey)
4. `mobile/src/services/api.ts` - Type definitions
5. `mobile/src/storage/sqlite.ts` - SQL aggregation queries
6. `mobile/src/context/ScrobbleContext.tsx` - Data mapping and sync logic

---

**All issues resolved. Code is now consistent end-to-end.**
