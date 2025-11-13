# Hybrid Normalization - Implementation Checklist

**Track progress across all phases of hybrid normalization migration**

---

## Phase 1: Model Creation ✅ COMPLETE
- [x] Create `Track.ts` model with indexes
- [x] Create `Album.ts` model with indexes
- [x] Create `Artist.ts` model with indexes
- [x] All models include proper Mongoose references
- [x] Indexes created for performance (.populate() queries)

**Date completed**: May 11, 2025  
**Result**: 3 new models, 0 errors

---

## Phase 2: Data Migration ✅ COMPLETE
- [x] Run `hybrid-migration-prechecks.ts` (identify entities to create)
- [x] Run `hybrid-migration-run.ts` (execute migration)
- [x] Verify all collections created:
  - [x] 36 artists created
  - [x] 43 albums created
  - [x] 54 tracks created
- [x] Verify all scrobbles updated:
  - [x] 167/167 scrobbles have trackId ✅
  - [x] 167/167 scrobbles have albumRefId ✅
  - [x] 167/167 scrobbles have artistId ✅
- [x] Test sample query with .populate()

**Date completed**: May 11, 2025  
**Result**: 100% success rate (0 scrobbles skipped)

---

## Phase 3: Scrobble Model Update ✅ COMPLETE
- [x] Add `trackId` field to IScrobble interface
- [x] Add `albumRefId` field to IScrobble interface
- [x] Add `artistId` field to IScrobble interface
- [x] Add indexes to Mongoose schema
- [x] Keep old fields (trackName, albumName, albumArt, artistName) for backward compatibility

**Date completed**: May 11, 2025  
**Result**: Backward compatible schema

---

## Phase 4: Service Layer Creation ✅ COMPLETE
- [x] Create `HybridNormalizationService.ts`
- [x] Implement `findOrCreateArtist()`
- [x] Implement `findOrCreateAlbum()`
- [x] Implement `findOrCreateTrack()`
- [x] Implement `normalizeScrobbleData()` (complete flow)
- [x] Implement `bulkGetAlbumArts()` (batch fetch)

**Date completed**: May 11, 2025  
**Result**: Centralized normalization logic

---

## Phase 5: Route Updates 🔄 IN PROGRESS

### v2/scrobbles.ts ✅ COMPLETE
- [x] Import HybridNormalizationService
- [x] POST `/batch-upsert` - Call normalizeScrobbleData() on write
- [x] POST `/batch-upsert` - Add trackId, albumRefId, artistId to upserts
- [x] GET `/recent` - Add .populate('albumRefId', 'albumArt')
- [x] GET `/recent` - Map albumArt into response, remove albumRefId object
- [x] Register v2 routes in `routes/index.ts`

**Date completed**: May 11, 2025  
**Test result**: ✅ All tests passing (albumArt present, 137ms response)

### v2/scrobbles.ts (remaining endpoints) ⏳ PENDING
- [ ] GET `/archive-ready` - Add .populate() if returns scrobbles with albumArt
- [ ] Review other v2 endpoints for albumArt usage

**Expected time**: 30 minutes

### music.ts ⏳ PENDING
- [ ] POST `/scrobble` - Add HybridNormalizationService.normalizeScrobbleData()
- [ ] POST `/scrobble` - Add trackId, albumRefId, artistId to scrobble upsert
- [ ] POST `/scrobbles/batch-upsert` - Same normalization logic
- [ ] Test: Create new scrobble, verify Track/Album/Artist created

**Expected time**: 1 hour

### stats.ts ⏳ PENDING
- [ ] GET `/top-albums` - Add .populate() or bulkGetAlbumArts()
- [ ] GET `/top-albums` - Map albumArt into response
- [ ] GET `/top-tracks` - Review if needs albumArt
- [ ] Test: Verify albumArt present in top albums

**Expected time**: 45 minutes

### home.ts ⏳ PENDING
- [ ] GET `/home` - Add .populate('albumRefId', 'albumArt') to recent scrobbles
- [ ] GET `/home` - Map albumArt into response
- [ ] Test: Verify albumArt present, performance <100ms

**Expected time**: 30 minutes

---

## Phase 6: Comprehensive Testing ⏳ PENDING

### Endpoint Tests
- [x] GET `/api/v2/scrobbles/recent` - albumArt displays ✅
- [ ] POST `/api/v2/scrobbles/batch-upsert` - creates normalized entities
- [ ] POST `/api/music/scrobble` - creates normalized entities
- [ ] GET `/api/stats/top-albums` - albumArt via .populate()
- [ ] GET `/api/home` - performance <100ms
- [ ] All endpoints: No albumRefId objects in responses

### Performance Tests
- [ ] Home screen load: < 100ms
- [ ] Recent scrobbles: < 150ms
- [ ] Top albums: < 200ms
- [ ] Memory usage: No leaks over 1 hour

### Mobile App Tests
- [ ] Scrobble new track → appears in history with albumArt
- [ ] View top albums → albumArt displays
- [ ] View home screen → recent scrobbles have albumArt
- [ ] Offline cache → works without changes
- [ ] No errors in mobile console

### Database Verification
- [ ] All scrobbles have references (trackId, albumRefId, artistId)
- [ ] All albums have albumArt
- [ ] No orphaned entities (tracks/albums/artists not linked)
- [ ] Indexes exist and used by queries

---

## Phase 7: Optional Cleanup ⏳ PENDING

### Prerequisites (MUST complete before Phase 7)
- [ ] All routes updated and tested
- [ ] Mobile app tested and working
- [ ] Dev server monitored for 24 hours
- [ ] No errors in production logs
- [ ] Storage metrics verified

### Cleanup Tasks
- [ ] Remove `albumArt` field from scrobbles collection
- [ ] Optional: Remove `artistName` field from scrobbles collection
- [ ] Keep `trackName`, `albumName` for fast display
- [ ] Verify mobile app works after cleanup
- [ ] Measure storage savings (expected: 81.70 KB → ~44 KB)

**Expected time**: 1 hour  
**Expected savings**: 46% storage reduction

---

## Bug Fixes ✅ COMPLETE

### Field Naming Conflict
- [x] Issue: Migration created `albumId` ObjectId (conflicts with Spotify album ID)
- [x] Fix: Ran `fix-albumrefid-field.ts` to rename → `albumRefId`
- [x] Cleanup: Ran `cleanup-duplicate-albumid.ts` to remove duplicate ObjectId field
- [x] Result: Clean separation (albumRefId = reference, albumName = display)

**Date fixed**: May 11, 2025

---

## Production Deployment Checklist ⏳ PENDING

### Pre-Deploy
- [ ] All routes updated
- [ ] All tests passing
- [ ] Mobile app tested
- [ ] Dev server monitored 24 hours
- [ ] Storage metrics verified
- [ ] Rollback plan documented
- [ ] Backup MongoDB Atlas

### Deploy
- [ ] Deploy server to Render
- [ ] Verify MongoDB connection
- [ ] Run smoke tests on production
- [ ] Test mobile app against production API

### Post-Deploy (48h monitoring)
- [ ] Monitor error logs (no 500s)
- [ ] Track API response times
- [ ] Verify mobile app works
- [ ] Check storage savings
- [ ] User feedback (no complaints)

### After 48h Success
- [ ] Plan Phase 7 cleanup (remove albumArt from scrobbles)
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## Rollback Plan

### If Issues Found
1. **Stop production server** immediately
2. **Revert code** to commit before migration:
   ```bash
   git revert <migration-commit-hash>
   git push origin main
   ```
3. **Delete new collections** (if needed):
   ```javascript
   db.tracks.drop()
   db.albums.drop()
   db.artists.drop()
   ```
4. **Scrobbles unchanged**: Old fields still present, app works as before
5. **Zero data loss**, 5-minute rollback time

---

## Progress Summary

### Overall Completion: 70% ✅

| Phase | Status | Date Completed |
|-------|--------|----------------|
| Phase 1: Models | ✅ COMPLETE | May 11, 2025 |
| Phase 2: Migration | ✅ COMPLETE | May 11, 2025 |
| Phase 3: Scrobble Model | ✅ COMPLETE | May 11, 2025 |
| Phase 4: Service Layer | ✅ COMPLETE | May 11, 2025 |
| Phase 5: Routes | 🔄 40% DONE | In Progress |
| Phase 6: Testing | ⏳ PENDING | - |
| Phase 7: Cleanup | ⏳ PENDING | - |
| Production Deploy | ⏳ PENDING | - |

### Routes Completion: 2/8 (25%)
- ✅ v2/scrobbles.ts POST /batch-upsert
- ✅ v2/scrobbles.ts GET /recent
- ⏳ v2/scrobbles.ts GET /archive-ready
- ⏳ music.ts POST /scrobble
- ⏳ music.ts POST /scrobbles/batch-upsert
- ⏳ stats.ts GET /top-albums
- ⏳ stats.ts GET /top-tracks
- ⏳ home.ts GET /home

---

## Next Actions

**Immediate** (continue Phase 5):
1. Update `v2/scrobbles.ts` GET `/archive-ready` endpoint
2. Update `music.ts` scrobbling routes
3. Update `stats.ts` query routes
4. Update `home.ts` query route

**After Route Updates** (Phase 6):
1. Run comprehensive test suite
2. Test mobile app integration
3. Monitor dev server for 24 hours

**Before Production** (Prerequisites):
1. All routes updated and tested ✅
2. Mobile app works ✅
3. 24h monitoring complete ✅
4. Backup MongoDB Atlas ✅

**Production Ready** (Deploy):
1. Deploy to Render
2. Monitor for 48 hours
3. Execute Phase 7 cleanup
4. Celebrate! 🎉

---

**Last updated**: May 11, 2025  
**Current phase**: Phase 5 (Route Updates)  
**Blocking**: None  
**ETA**: 3-4 hours remaining for all route updates
