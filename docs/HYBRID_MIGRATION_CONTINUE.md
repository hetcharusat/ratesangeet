# Hybrid Normalization - Continue Implementation Guide

**Quick reference for updating remaining routes to use hybrid normalization**

---

## Current Status ✅

**Completed**:
- ✅ Track, Album, Artist models created with indexes
- ✅ Migration executed (167/167 scrobbles, 36 artists, 43 albums, 54 tracks)
- ✅ HybridNormalizationService created
- ✅ `v2/scrobbles.ts` batch-upsert updated (writes normalized entities)
- ✅ `v2/scrobbles.ts` GET `/recent` updated (populates albumArt)
- ✅ Tests passing (100% reference integrity)

**Pending**:
- ⏳ Update remaining v2/scrobbles endpoints
- ⏳ Update music.ts scrobbling routes
- ⏳ Update stats.ts, home.ts query routes
- ⏳ Phase 7: Remove albumArt/artistName from scrobbles (after 24h monitoring)

---

## Pattern 1: Update WRITE Routes (Scrobbling)

**When**: Any route that creates/updates scrobbles  
**Goal**: Automatically create normalized Track/Album/Artist entities

### Example: `music.ts` POST `/scrobble`

```typescript
// 1. Import service
import { HybridNormalizationService } from '../services/HybridNormalizationService.js';

// 2. Before scrobble upsert, normalize data
const normalized = await HybridNormalizationService.normalizeScrobbleData({
  spotifyId: track.id,
  trackName: track.name,
  artistName: track.artists[0]?.name || 'Unknown Artist',
  albumSpotifyId: track.album?.id,
  albumName: track.album?.name || 'Unknown Album',
  albumArt: track.album?.images?.[0]?.url,
  durationMs: track.duration_ms,
});

// 3. Add references to scrobble upsert
await Scrobble.findOneAndUpdate(
  { userId, spotifyId, playedAtRounded10s },
  {
    $setOnInsert: {
      trackName,
      albumName,
      artistName,
      // ... other fields
      
      // Add normalized references:
      ...(normalized.trackId && { trackId: normalized.trackId }),
      ...(normalized.albumId && { albumRefId: normalized.albumId }),
      ...(normalized.artistId && { artistId: normalized.artistId }),
    },
    $set: {
      // ... update fields
    },
  },
  { upsert: true }
);
```

### Files to Update:
- [ ] `server/src/routes/music.ts` POST `/scrobble`
- [ ] `server/src/routes/music.ts` POST `/scrobbles/batch-upsert`

---

## Pattern 2: Update READ Routes (Queries)

**When**: Any route that returns scrobbles with albumArt  
**Goal**: Fetch albumArt from albums collection via `.populate()`

### Example: `stats.ts` GET `/top-albums`

```typescript
// 1. If querying scrobbles, add .populate()
const scrobbles = await Scrobble.find({ userId })
  .select('trackName albumName artistName playedAt albumRefId') // Include albumRefId
  .populate('albumRefId', 'albumArt') // Fetch only albumArt from albums collection
  .sort({ playedAt: -1 })
  .limit(50)
  .lean();

// 2. Map populated albumArt into response (remove albumRefId object)
const mapped = scrobbles.map(item => ({
  ...item,
  albumArt: (item.albumRefId as any)?.albumArt || undefined,
  albumRefId: undefined, // Remove populated object from response
}));

return res.json({ items: mapped });
```

### Alternative: Bulk Fetch for Aggregations

If you're aggregating by album (not returning individual scrobbles):

```typescript
import { HybridNormalizationService } from '../services/HybridNormalizationService.js';

// 1. Get top albums by albumRefId
const topAlbums = await Scrobble.aggregate([
  { $match: { userId: new mongoose.Types.ObjectId(userId) } },
  { $group: {
    _id: '$albumRefId',
    albumName: { $first: '$albumName' },
    count: { $sum: 1 },
  }},
  { $sort: { count: -1 } },
  { $limit: 10 },
]);

// 2. Bulk fetch album arts
const albumRefIds = topAlbums
  .map(a => a._id)
  .filter(id => id); // Remove nulls
const albumArtsMap = await HybridNormalizationService.bulkGetAlbumArts(albumRefIds);

// 3. Map album art into results
const results = topAlbums.map(album => ({
  albumName: album.albumName,
  albumArt: albumArtsMap.get(album._id?.toString()) || undefined,
  playCount: album.count,
}));

return res.json({ topAlbums: results });
```

### Files to Update:
- [ ] `server/src/routes/v2/scrobbles.ts` GET `/archive-ready` (if returns scrobbles)
- [ ] `server/src/routes/stats.ts` GET `/top-albums`
- [ ] `server/src/routes/stats.ts` GET `/top-tracks` (if needs albumArt)
- [ ] `server/src/routes/home.ts` GET `/home` (recent scrobbles section)

---

## Pattern 3: Query Performance Tips

### Use `.select()` for Minimal Payloads
```typescript
// ❌ BAD: Fetches all fields
const scrobbles = await Scrobble.find({ userId });

// ✅ GOOD: Only fetch what you need
const scrobbles = await Scrobble.find({ userId })
  .select('trackName albumName artistName albumRefId playedAt')
  .populate('albumRefId', 'albumArt')
  .lean();
```

### Use `.lean()` for Read-Only Queries
```typescript
// ❌ BAD: Returns Mongoose documents (slower)
const scrobbles = await Scrobble.find({ userId });

// ✅ GOOD: Returns plain JavaScript objects
const scrobbles = await Scrobble.find({ userId }).lean();
```

### Index Usage Verification
```typescript
// Check if query uses indexes
const explain = await Scrobble.find({ userId })
  .select('trackName albumRefId')
  .explain('executionStats');

console.log('Index used:', explain.executionStats.totalDocsExamined);
// Should be close to nReturned (not scanning whole collection)
```

---

## Testing Checklist

### After Each Route Update:

1. **Test locally**:
   ```bash
   cd server
   npx tsx test-hybrid-migration.ts
   ```

2. **Manual API test**:
   ```bash
   # Example: Test updated endpoint
   curl http://localhost:5000/api/stats/top-albums \
     -H "x-user-id: YOUR_USER_ID"
   ```

3. **Verify response**:
   - ✅ albumArt is present (not null/undefined)
   - ✅ albumRefId object is removed from response
   - ✅ Response time < 150ms

4. **Check server logs**:
   - ✅ No errors
   - ✅ Query uses indexes (not full collection scan)

---

## Troubleshooting

### Issue: albumArt is null/undefined
```typescript
// Check if scrobble has albumRefId
const sample = await Scrobble.findOne({ userId }).lean();
console.log('Has albumRefId:', !!sample?.albumRefId);

// If false, scrobble needs normalization:
// Re-run batch-upsert OR manually normalize:
const normalized = await HybridNormalizationService.normalizeScrobbleData({...});
await Scrobble.updateOne(
  { _id: sample._id },
  { $set: { albumRefId: normalized.albumId } }
);
```

### Issue: albumRefId object in response
```typescript
// ❌ WRONG: Didn't map populated data
return res.json({ items: scrobbles });

// ✅ CORRECT: Map albumArt and remove albumRefId
const mapped = scrobbles.map(item => ({
  ...item,
  albumArt: (item.albumRefId as any)?.albumArt,
  albumRefId: undefined,
}));
return res.json({ items: mapped });
```

### Issue: Slow queries (>200ms)
```typescript
// 1. Check if .lean() is used
.lean() // Add this!

// 2. Check if .select() limits fields
.select('trackName albumName albumRefId') // Only needed fields

// 3. Verify index exists
await Scrobble.collection.getIndexes();
// Should show index on albumRefId
```

---

## Phase 7: Cleanup (AFTER 24h monitoring)

### Remove albumArt from Scrobbles Collection

**Only execute after confirming all endpoints work correctly!**

```typescript
// cleanup-phase7.ts
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGODB_URI!);

// Remove albumArt field (now fetched via .populate())
const result = await mongoose.connection.db!.collection('scrobbles').updateMany(
  { albumArt: { $exists: true } },
  { $unset: { albumArt: '' } }
);

console.log(`Removed albumArt from ${result.modifiedCount} scrobbles`);

// Optional: Remove artistName (fetch via .populate('artistId', 'name'))
const result2 = await mongoose.connection.db!.collection('scrobbles').updateMany(
  { artistName: { $exists: true } },
  { $unset: { artistName: '' } }
);

console.log(`Removed artistName from ${result2.modifiedCount} scrobbles`);

await mongoose.disconnect();
```

**Storage impact**: 81.70 KB → ~44 KB (46% savings)

---

## Quick Commands

```bash
# Start server
cd server && npm run dev

# Run comprehensive tests
cd server && npx tsx test-hybrid-migration.ts

# Check scrobble references
cd server && npx tsx debug-scrobbles.ts

# Test specific endpoint
curl http://localhost:5000/api/v2/scrobbles/recent?limit=10 \
  -H "x-user-id: YOUR_USER_ID"

# Check MongoDB collections
mongosh "YOUR_MONGODB_URI"
> use ratesangeet
> db.scrobbles.findOne()
> db.albums.findOne()
> db.tracks.findOne()
> db.artists.findOne()
```

---

## Success Criteria

### Route update is complete when:
- ✅ Write routes call `HybridNormalizationService.normalizeScrobbleData()`
- ✅ Read routes use `.populate('albumRefId', 'albumArt')`
- ✅ Response includes albumArt (not null)
- ✅ Response does NOT include albumRefId object
- ✅ Response time < 150ms
- ✅ No errors in server logs
- ✅ Tests passing

### Ready for production when:
- ✅ All routes updated
- ✅ Mobile app tested (works with new endpoints)
- ✅ Monitored dev server for 24 hours (no errors)
- ✅ Storage metrics verified (savings visible)
- ✅ Performance acceptable (<150ms)
- ✅ Rollback plan tested

---

## Resources

- **Main summary**: `docs/HYBRID_MIGRATION_SUMMARY.md`
- **Test script**: `server/test-hybrid-migration.ts`
- **Service**: `server/src/services/HybridNormalizationService.ts`
- **Models**: `server/src/models/{Track,Album,Artist}.ts`
- **Example route**: `server/src/routes/v2/scrobbles.ts`

---

**Last updated**: May 11, 2025  
**Status**: Phases 1-5 complete, ready to continue with remaining routes
