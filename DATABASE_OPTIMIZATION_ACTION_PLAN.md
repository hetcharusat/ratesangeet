# 🎯 DATABASE OPTIMIZATION - ACTION PLAN

## 🚨 PROBLEM SUMMARY
You're storing the same song/album metadata **1,659 times** across different tables. This wastes storage and makes updates difficult.

**Example of waste**:
```
Song: "Sparkle" by RADWIMPS
Stored in:
  - scrobbles table: 10 times (every time you played it)
  - trackstats table: 1 time (your play count)
  - reviews table: 1 time (your review)
  
Total: Stored "Sparkle" metadata 12 times!
Multiply this by 1,000+ songs = HUGE WASTE
```

---

## ✅ SOLUTION (Simple Version)

### Before (Current - BAD):
```
scrobbles: { trackName: "Sparkle", artistName: "RADWIMPS", ... }
trackstats: { trackName: "Sparkle", artistName: "RADWIMPS", ... }
reviews: { itemName: "Sparkle", artistName: "RADWIMPS", ... }
```
❌ Repeated 1,659 times!

### After (Normalized - GOOD):
```
tracks: { _id: "spotify_id_123", name: "Sparkle", artistName: "RADWIMPS" }
scrobbles: { trackId: "spotify_id_123" } ← Just reference it!
trackstats: { trackId: "spotify_id_123" } ← Just reference it!
reviews: { itemId: "spotify_id_123" } ← Just reference it!
```
✅ Stored once, referenced everywhere!

---

## 📋 STEP-BY-STEP MIGRATION

### Step 1: Create New Tables (1 day)
```javascript
// Create tracks table
db.createCollection("tracks");

// Create albums table  
db.createCollection("albums");

// Extract unique tracks from existing data
db.scrobbles.aggregate([
  { $group: {
    _id: "$spotifyId",
    name: { $first: "$trackName" },
    artistName: { $first: "$artistName" },
    albumId: { $first: "$albumId" }
  }},
  { $out: "tracks" }
]);
```

### Step 2: Update Code (2 days)
Update these files to use new structure:

#### `server/src/routes/music.ts`
```javascript
// OLD: Save full metadata
await Scrobble.create({
  userId,
  spotifyId,
  trackName: "Sparkle",      // ❌ Remove
  artistName: "RADWIMPS",    // ❌ Remove
  albumName: "Your Name",    // ❌ Remove
  albumArt: "https://...",   // ❌ Remove
  playedAt: new Date()
});

// NEW: Just save reference
// Step 1: Ensure track exists
let track = await Track.findById(spotifyId);
if (!track) {
  // Fetch from Spotify and cache
  track = await fetchAndCacheTrack(spotifyId);
}

// Step 2: Save scrobble with reference only
await Scrobble.create({
  userId,
  trackId: spotifyId,         // ✅ Just reference
  playedAt: new Date()
});
```

#### `server/src/routes/music.ts` (GET endpoint)
```javascript
// OLD: Return embedded data
const scrobbles = await Scrobble.find({ userId })
  .sort({ playedAt: -1 })
  .limit(200);
// Returns: [{ trackName: "Sparkle", artistName: "RADWIMPS", ... }]

// NEW: Join with tracks table
const scrobbles = await Scrobble.aggregate([
  { $match: { userId } },
  { $sort: { playedAt: -1 } },
  { $limit: 200 },
  {
    $lookup: {
      from: 'tracks',
      localField: 'trackId',
      foreignField: '_id',
      as: 'track'
    }
  },
  { $unwind: '$track' }
]);
// Returns same structure, but data comes from tracks table!
```

### Step 3: Test Everything (1 day)
- Test scrobbling new songs
- Test history page loads
- Test stats calculations
- Test reviews

### Step 4: Cleanup Old Data (1 day)
```javascript
// Remove redundant fields
db.scrobbles.updateMany({}, {
  $unset: {
    trackName: "",
    artistName: "",
    albumName: "",
    albumArt: ""
  }
});

// Same for albumstats, trackstats, reviews
```

---

## 🔢 EXPECTED RESULTS

### Storage Savings
| Table | Before | After | Saved |
|-------|--------|-------|-------|
| scrobbles | 277 KB | 129 KB | **53%** ⬇️ |
| albumstats | 60 KB | 24 KB | **60%** ⬇️ |
| trackstats | 79 KB | 29 KB | **63%** ⬇️ |
| **TOTAL** | **511 KB** | **440 KB** | **14%** ⬇️ |

At 100,000 documents scale: **Save ~13 MB** 💰

### Performance Impact
- ✅ Faster updates (update track once, reflects everywhere)
- ✅ Consistent data (no mismatches)
- ⚠️ Slightly slower reads (needs JOIN) - fix with caching

---

## ⚠️ OTHER ISSUES FOUND

### 1. Dead Collection: `completionevents`
- **Problem**: Table exists but never used (0 documents)
- **Fix**: Delete it
```javascript
db.completionevents.drop();
```

### 2. Security: Tokens Not Encrypted
- **Problem**: Spotify access tokens stored in plaintext
- **Fix**: Use encryption
```javascript
// Add to User model
accessToken: { 
  type: String, 
  required: true,
  get: decrypt,  // Decrypt when reading
  set: encrypt   // Encrypt when saving
}
```

### 3. Missing Caching
- **Problem**: Fetching same track metadata repeatedly
- **Fix**: Add Redis cache
```javascript
// Cache hot tracks in memory
const track = await redis.get(`track:${trackId}`);
if (!track) {
  track = await Track.findById(trackId);
  await redis.setex(`track:${trackId}`, 3600, JSON.stringify(track));
}
```

---

## 🎯 PRIORITY ACTIONS

### 🔴 HIGH PRIORITY (Do First)
1. **Normalize scrobbles** - Biggest waste (989 docs)
2. **Delete completionevents** - Dead code
3. **Test on staging** - Before production

### 🟡 MEDIUM PRIORITY (Do Next)
4. **Encrypt tokens** - Security issue
5. **Add Redis caching** - Performance boost
6. **Normalize albumstats/trackstats** - More savings

### 🟢 LOW PRIORITY (Later)
7. **Add monitoring** - Track storage savings
8. **Optimize reviews reactions** - Only if grows large

---

## 📊 FILES CHANGED SUMMARY

### Models to Create
- [ ] `server/src/models/Track.ts` (NEW)
- [ ] `server/src/models/Album.ts` (NEW)

### Models to Update
- [ ] `server/src/models/Scrobble.ts` (remove metadata fields)
- [ ] `server/src/models/AlbumStats.ts` (remove metadata fields)
- [ ] `server/src/models/TrackStats.ts` (remove metadata fields)
- [ ] `server/src/models/Review.ts` (remove metadata fields)

### Routes to Update
- [ ] `server/src/routes/music.ts` (all endpoints)
- [ ] `server/src/routes/reviews.ts` (POST, GET endpoints)
- [ ] `server/src/routes/stats.ts` (listening-stats)

### Jobs to Update
- [ ] `server/src/jobs/archiveScrobbles.ts` (add $lookup)

### Estimated Time
- **Phase 1 (Create tables)**: 1 day
- **Phase 2 (Update code)**: 2 days
- **Phase 3 (Testing)**: 1 day
- **Phase 4 (Cleanup)**: 1 day
- **TOTAL**: ~5 days (1 week)

---

## 🚀 QUICK WIN (2 Hours)

If you want a quick fix TODAY:

### Delete Dead Collection
```javascript
cd server
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await mongoose.connection.db.dropCollection('completionevents');
  console.log('✅ Deleted completionevents');
  process.exit(0);
});
"
```

### Add Missing Index
```javascript
db.scrobbles.createIndex({ trackId: 1 });
db.albumstats.createIndex({ albumId: 1 });
db.trackstats.createIndex({ trackId: 1 });
```

---

## 📞 NEED HELP?

### Commands to Run

1. **See what's in database**:
```bash
cd server
node analyze-database.js
```

2. **Backup before migration**:
```bash
mongodump --uri="mongodb+srv://..." --out=backup_$(date +%Y%m%d)
```

3. **Test migration script**:
```bash
node migrate-normalize.js --dry-run
```

---

**Next Steps**: 
1. Review `DATABASE_AUDIT_REPORT.md` (full technical details)
2. Review `DATABASE_SCHEMA_QUICK_REF.md` (visual diagrams)
3. Decide on timeline for migration
4. Start with Phase 1 (create new tables)

**Questions?** Check the full reports or ask! 🚀
