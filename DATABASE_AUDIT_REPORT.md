# 🗄️ COMPREHENSIVE DATABASE SCHEMA ANALYSIS
**Date**: November 11, 2025  
**Database**: MongoDB Atlas (ratesangeet)  
**Total Collections**: 9  
**Total Documents**: 1,693

---

## 📊 EXECUTIVE SUMMARY

### 🔴 CRITICAL ISSUES FOUND

1. **MASSIVE DATA DUPLICATION** across all collections
2. **Redundant metadata** stored in 5+ different collections
3. **Inefficient storage**: Same album/track data repeated 1000+ times
4. **No normalized relations**: Everything embedded everywhere

### 💾 Storage Waste Analysis
- **albumName, artistName, albumArt** duplicated across: `scrobbles` (989×), `albumstats` (301×), `trackstats` (357×), `reviews` (12×) = **1,659 duplicates**
- **User metadata** duplicated in reviews, comments, scrobbles
- **Estimated waste**: ~60-70% of storage is redundant data

---

## 📦 COLLECTION-BY-COLLECTION ANALYSIS

### 1. 🎵 **scrobbles** (989 documents)
**Purpose**: Raw listening history (temporary - archived after 30 days per STORAGE_POLICY)

#### Schema:
```json
{
  "_id": "690f3cd118f5893b2101a410",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "spotifyId": "5NgwiwNXF6FXLREMyF7rkR",
  "trackName": "Jawaab",
  "artistName": "The Pursuetist House, tricksingh, Dishaan",
  "albumId": null,
  "albumName": "The Pursuetist House Vol. 1",
  "albumArt": "https://i.scdn.co/image/ab67616d0000b273d1c55358da6500bf2b1055b7",
  "durationMs": 131783,
  "playedAt": "2025-11-08T12:48:43.074Z",
  "source": "spotify",
  "createdAt": "2025-11-08T12:51:28.956Z",
  "updatedAt": "2025-11-08T12:51:28.956Z",
  "__v": 0
}
```

#### Indexes:
- `userId_1_playedAt_-1` (recent scrobbles)
- `userId_1_spotifyId_1_playedAt_1` (deduplication)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/music/scrobble` | Create scrobble (on 40% playback) |
| GET | `/api/music/scrobbles?userId&limit` | Fetch user scrobbles |
| POST | `/api/music/sync-recent` | Backfill from Spotify Recently Played |

#### 🔴 REDUNDANCY ISSUES:
- ❌ **trackName, artistName, albumName, albumArt** stored for EVERY scrobble
- ❌ These are IMMUTABLE Spotify metadata - should be referenced, not duplicated
- ❌ 989 documents × ~200 bytes metadata = **197 KB wasted**
- ❌ `albumId` is null in many docs (inconsistent)

#### ✅ WHAT TO KEEP:
- `userId`, `spotifyId`, `playedAt`, `source`, `durationMs`

#### ❌ WHAT TO REMOVE:
- `trackName`, `artistName`, `albumName`, `albumArt` → Should reference Tracks collection

---

### 2. 📈 **albumstats** (301 documents)
**Purpose**: Per-user album play counts and completion tracking

#### Schema:
```json
{
  "_id": "6910b70f18f5893b2101ae7e",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "albumKey": "6NhOJdcqSO1wHtPKK4QPgy",
  "albumId": "6NhOJdcqSO1wHtPKK4QPgy",
  "albumName": "Hastakshar - Ramesh Parekh",
  "artistName": "Parthiv Gohil",
  "albumArt": "https://i.scdn.co/image/ab67616d0000b2734413c5e288ebc203a4e5b395",
  "playCount": 2,
  "completedPlays": 0,
  "currentCycleUniqueTrackIds": [],
  "lastPlayedAt": "2025-11-09T15:01:40.000Z",
  "createdAt": "2025-11-09T15:45:09.239Z",
  "updatedAt": "2025-11-09T15:45:09.239Z",
  "__v": 0
}
```

#### Indexes:
- `userId_1_albumKey_1` (unique per user-album)
- `userId_1_playCount_-1` (top albums)
- `userId_1_completedPlays_-1` (completed albums)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/music/listening-stats?userId` | Home screen stats (uses albumstats) |
| Background Job | `archiveScrobbles.js` | Aggregates scrobbles → albumstats |

#### 🔴 REDUNDANCY ISSUES:
- ❌ **albumName, artistName, albumArt** duplicated 301 times
- ❌ Same album for different users = duplicate metadata
- ❌ 301 documents × ~150 bytes metadata = **45 KB wasted**

#### ✅ WHAT TO KEEP:
- `userId`, `albumKey`, `playCount`, `completedPlays`, `currentCycleUniqueTrackIds`, `lastPlayedAt`

#### ❌ WHAT TO REMOVE:
- `albumName`, `artistName`, `albumArt` → Reference Albums collection
- `albumId` duplicates `albumKey` (choose one)

---

### 3. 🎶 **trackstats** (357 documents)
**Purpose**: Per-user track play counts

#### Schema:
```json
{
  "_id": "6910b71018f5893b2101aea6",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "trackKey": "2hIeKWgUP5nZYKeON16GQa",
  "trackId": "2hIeKWgUP5nZYKeON16GQa",
  "trackName": "Mari Aankhman Tun",
  "artistName": "Parthiv Gohil",
  "albumName": "Hastakshar - Ramesh Parekh",
  "albumArt": "https://i.scdn.co/image/ab67616d0000b2734413c5e288ebc203a4e5b395",
  "playCount": 1,
  "lastPlayedAt": "2025-11-09T15:01:40.000Z",
  "createdAt": "2025-11-09T15:45:09.424Z",
  "updatedAt": "2025-11-09T15:45:09.424Z",
  "__v": 0
}
```

#### Indexes:
- `userId_1_trackKey_1` (unique per user-track)
- `userId_1_playCount_-1` (top tracks)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/music/listening-stats?userId` | Home screen stats (uses trackstats) |
| Background Job | `archiveScrobbles.js` | Aggregates scrobbles → trackstats |

#### 🔴 REDUNDANCY ISSUES:
- ❌ **trackName, artistName, albumName, albumArt** duplicated 357 times
- ❌ Same track for different users = duplicate metadata
- ❌ 357 documents × ~180 bytes metadata = **64 KB wasted**

#### ✅ WHAT TO KEEP:
- `userId`, `trackKey`, `playCount`, `lastPlayedAt`

#### ❌ WHAT TO REMOVE:
- `trackName`, `artistName`, `albumName`, `albumArt` → Reference Tracks collection
- `trackId` duplicates `trackKey` (choose one)

---

### 4. ⭐ **reviews** (12 documents)
**Purpose**: User ratings and reviews for tracks/albums

#### Schema:
```json
{
  "_id": "690f52bb6404c1f95cf4885e",
  "userId": "690f520b6404c1f95cf48848",
  "itemType": "track",
  "spotifyId": "3A4FRzgve9BjfKbvVXRIFO",
  "itemName": "Sparkle - movie ver.",
  "artistName": "RADWIMPS",
  "albumArt": "https://i.scdn.co/image/ab67616d0000b2733d1869d8c477d291a205a2d6",
  "rating": 4.5,
  "reviewText": null,
  "isPublic": true,
  "likes": 2,
  "reactionsCount": { "fire": 1, "like": 1 },
  "reactionsByUser": {
    "690f3c63bd0a03a91f3cd7fb": "fire",
    "68f76ebaaeea6e3e5f62416d": "like"
  },
  "listeningDate": "2025-11-08T14:24:59.920Z",
  "createdAt": "2025-11-08T14:24:59.921Z",
  "updatedAt": "2025-11-08T22:09:39.118Z",
  "__v": 0
}
```

#### Indexes:
- `userId_1_createdAt_-1` (user's reviews)
- `spotifyId_1_userId_1` (unique review per user-item)
- `isPublic_1_createdAt_-1` (public feed)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/reviews` | Create/update review |
| GET | `/api/reviews/user/:userId` | User's reviews |
| GET | `/api/reviews/public` | Public reviews feed |
| GET | `/api/reviews/:id` | Single review details |
| PUT | `/api/reviews/:id` | Update review |
| DELETE | `/api/reviews/:id` | Delete review |
| POST | `/api/reviews/:id/react` | Add reaction (like, fire, etc.) |

#### 🔴 REDUNDANCY ISSUES:
- ❌ **itemName, artistName, albumArt** duplicated in every review
- ⚠️ `likes` duplicates data in `reactionsCount` (can be computed)
- ⚠️ `reactionsByUser` could grow huge if popular (inefficient)

#### ✅ WHAT TO KEEP:
- `userId`, `itemType`, `spotifyId`, `rating`, `reviewText`, `isPublic`, `reactionsCount`, `listeningDate`

#### ❌ WHAT TO REMOVE:
- `itemName`, `artistName`, `albumArt` → Fetch from Tracks/Albums collection
- `likes` → Compute from `reactionsCount`

---

### 5. 💬 **reviewcomments** (13 documents)
**Purpose**: Comments and replies on reviews (threaded)

#### Schema:
```json
{
  "_id": "690f668e6404c1f95cf48b8e",
  "reviewId": "690f56c16404c1f95cf488ae",
  "userId": "690f520b6404c1f95cf48848",
  "text": "Hii",
  "parentId": null,
  "replyCount": 0,
  "createdAt": "2025-11-08T15:49:34.539Z",
  "__v": 0
}
```

#### Indexes:
- `reviewId_1_createdAt_-1` (review comments)
- `parentId_1_createdAt_1` (threaded replies)
- `userId_1` (user's comments)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/reviews/:id/comments` | Get review comments |
| POST | `/api/reviews/:id/comments` | Add comment |
| DELETE | `/api/reviews/comments/:commentId` | Delete comment |

#### ✅ EFFICIENT DESIGN:
- ✅ Minimal schema (only IDs + text)
- ✅ Proper parent-child relationship
- ✅ No metadata duplication

#### ⚠️ MINOR OPTIMIZATION:
- `replyCount` could be computed on-demand vs stored

---

### 6. 👤 **users** (8 documents)
**Purpose**: User profiles, auth tokens, social graph

#### Schema:
```json
{
  "_id": "690f3c63bd0a03a91f3cd7fb",
  "spotifyId": "qbgsut4sn1n311rl8d7h4nyt8",
  "displayName": "H",
  "email": "hetp2758@gmail.com",
  "username": "h",
  "profileImage": "https://i.scdn.co/image/ab6775700000ee856cb36e00c406ed0d7b2bb677",
  "accessToken": "BQCc3CVRhG-VsDXlOCStgqgmZGB16Xt2Wdx0-uS3pHR_...",
  "refreshToken": "AQDuBdvm1QgGvpNv3iVXHbIT7MLyGdsNKDHHCMB-pIBabyQDm8d1IG7KH00...",
  "tokenStatus": "active",
  "lastTokenRefreshAt": "2025-11-11T14:25:03.281Z",
  "consecutiveRefreshFailures": 0,
  "lastTokenError": "invalid_grant",
  "lastTokenErrorAt": "2025-11-10T18:28:37.637Z",
  "followers": ["690f7e6df1b8ec83dcf88673", "68f76ebaaeea6e3e5f62416d"],
  "following": ["690f3da7bd0a03a91f3cd812", "6910f6d56cee2fd5c7dba957"],
  "favAlbums": [],
  "favTracks": [],
  "createdAt": "2025-11-08T12:49:39.996Z",
  "__v": 0
}
```

#### Indexes:
- `spotifyId_1` (unique login)
- `username_1` (unique username)
- `username_text_displayName_text` (search)
- `tokenStatus_1` (health monitoring)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/callback` | Create/update user on login |
| GET | `/api/users/:id` | User profile |
| GET | `/api/users/:id/feed` | User's social feed |
| GET | `/api/users/:id/followers` | Followers list |
| GET | `/api/users/:id/following` | Following list |
| POST | `/api/users/:id/follow` | Follow user |
| POST | `/api/users/:id/unfollow` | Unfollow user |
| PUT | `/api/users/:id/username` | Update username |
| PUT | `/api/users/:id/profile` | Update profile |

#### ✅ GOOD DESIGN:
- ✅ Comprehensive user data
- ✅ Social graph (followers/following)
- ✅ Token health tracking

#### ⚠️ SECURITY CONCERN:
- ⚠️ **Tokens stored in plaintext** (should encrypt `accessToken`, `refreshToken`)

#### ℹ️ NOTES:
- `favAlbums`, `favTracks` empty (feature not implemented yet)

---

### 7. 📊 **userstatssummaries** (6 documents)
**Purpose**: Lifetime user statistics summary

#### Schema:
```json
{
  "_id": "6910b71018f5893b2101aed7",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "totalScrobbles": 199,
  "createdAt": "2025-11-09T15:45:09.619Z",
  "updatedAt": "2025-11-11T14:54:56.702Z",
  "__v": 0
}
```

#### Indexes:
- `userId_1` (unique per user)

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/music/listening-stats?userId` | Includes totalScrobbles from this collection |
| Background Job | `archiveScrobbles.js` | Updates summary |

#### ⚠️ OPTIMIZATION:
- ⚠️ **Too minimal** - only stores `totalScrobbles`
- ⚠️ Could include: `totalMinutes`, `uniqueArtists`, `uniqueAlbums`, `accountAge`
- ⚠️ Currently just a counter, not a "summary"

---

### 8. 🏆 **completionevents** (0 documents - EMPTY)
**Purpose**: Album completion events (when user finishes all tracks in an album)

#### Schema:
```typescript
// From model file
{
  userId: ObjectId,
  albumId: String,
  albumName: String,
  artistName: String,
  albumArt: String,
  completedAt: Date,
  totalTracks: Number,
  totalDurationMs: Number
}
```

#### Indexes:
- `userId_1_completedAt_-1` (user completion history)
- `completedAt_1` (recent completions)

#### API Endpoints:
- ❌ **NOT USED** - No routes write to this collection
- ❌ **DEAD CODE** - Background job has this logic but disabled

#### 🔴 ISSUE:
- ❌ **Orphaned collection** - model exists but never populated
- ❌ Feature half-implemented (completions tracked in `albumstats` instead)

#### 💡 RECOMMENDATION:
- **DELETE THIS COLLECTION** or implement the feature properly

---

### 9. 🖥️ **serverstats** (1 document - SINGLETON)
**Purpose**: Server uptime and health metrics

#### Schema:
```json
{
  "_id": "singleton",
  "totalPings": 564,
  "totalRestarts": 175,
  "firstStartTime": "2025-11-09T09:29:44.702Z",
  "lastRestartTime": "2025-11-11T14:23:53.037Z",
  "lastPingTime": "2025-11-11T14:55:44.991Z",
  "createdAt": "2025-11-09T09:29:44.708Z",
  "updatedAt": "2025-11-11T14:55:44.991Z",
  "__v": 0
}
```

#### API Endpoints:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/ping` | External uptime monitor (increments totalPings) |
| Internal | `server/src/index.ts` startup | Increments totalRestarts |

#### ✅ EFFICIENT:
- ✅ Singleton pattern (only 1 doc)
- ✅ Minimal overhead

---

## 🔥 CRITICAL REDUNDANCY BREAKDOWN

### Metadata Duplication Matrix

| Field | scrobbles | albumstats | trackstats | reviews | **TOTAL DUPLICATES** |
|-------|-----------|------------|------------|---------|---------------------|
| **trackName** | 989 | 0 | 357 | 12 (itemName) | **1,358** |
| **artistName** | 989 | 301 | 357 | 12 | **1,659** |
| **albumName** | 989 | 301 | 357 | 0 | **1,647** |
| **albumArt** | 989 | 301 | 357 | 12 | **1,659** |

### 💰 Storage Waste Calculation
```
trackName:   1,358 × 30 bytes avg  = 40.7 KB
artistName:  1,659 × 25 bytes avg  = 41.5 KB
albumName:   1,647 × 35 bytes avg  = 57.6 KB
albumArt:    1,659 × 80 bytes (URL) = 132.7 KB
─────────────────────────────────────────────
TOTAL WASTE: ~272 KB (just for these 4 fields!)
```

**Projected waste at scale (10,000 users, 100k scrobbles):**
- Current waste: ~272 KB for 1,693 docs
- At 100k docs: ~**16 MB wasted** just on metadata duplication
- MongoDB indexes on these fields: ~**24 MB additional waste**

---

## 📋 NORMALIZED SCHEMA PROPOSAL

### 🎯 NEW COLLECTIONS TO CREATE

#### **tracks** (master track metadata)
```json
{
  "_id": "spotify_track_id",
  "name": "Sparkle - movie ver.",
  "artistName": "RADWIMPS",
  "albumId": "spotify_album_id",
  "durationMs": 217000,
  "spotifyUri": "spotify:track:3A4FRzgve9BjfKbvVXRIFO",
  "isrc": "JPU011500123",
  "popularity": 75,
  "explicit": false,
  "createdAt": "2025-11-08T12:00:00Z",
  "updatedAt": "2025-11-08T12:00:00Z"
}
```
**Index**: `_id` (Spotify track ID)

---

#### **albums** (master album metadata)
```json
{
  "_id": "spotify_album_id",
  "name": "Your Name.",
  "artistName": "RADWIMPS",
  "albumArt": "https://i.scdn.co/image/ab67616d0000b2733d1869d8c477d291a205a2d6",
  "releaseDate": "2016-08-24",
  "totalTracks": 27,
  "albumType": "album",
  "spotifyUri": "spotify:album:2rHvRVCEAXhQN1uGMVHKxm",
  "genres": ["anime", "j-rock"],
  "label": "EMI Records",
  "createdAt": "2025-11-08T12:00:00Z",
  "updatedAt": "2025-11-08T12:00:00Z"
}
```
**Index**: `_id` (Spotify album ID)

---

### 🔧 REFACTORED COLLECTIONS

#### **scrobbles** (AFTER normalization)
```json
{
  "_id": "690f3cd118f5893b2101a410",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "trackId": "5NgwiwNXF6FXLREMyF7rkR",  // Reference to tracks
  "playedAt": "2025-11-08T12:48:43.074Z",
  "source": "spotify"
}
```
**Removed**: `trackName`, `artistName`, `albumName`, `albumArt`, `durationMs`  
**Space saved**: 989 × 150 bytes = **148 KB** (~70% reduction)

---

#### **albumstats** (AFTER normalization)
```json
{
  "_id": "6910b70f18f5893b2101ae7e",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "albumId": "6NhOJdcqSO1wHtPKK4QPgy",  // Reference to albums
  "playCount": 2,
  "completedPlays": 0,
  "currentCycleUniqueTrackIds": [],
  "lastPlayedAt": "2025-11-09T15:01:40.000Z"
}
```
**Removed**: `albumName`, `artistName`, `albumArt`, `albumKey` (duplicate)  
**Space saved**: 301 × 120 bytes = **36 KB** (~60% reduction)

---

#### **trackstats** (AFTER normalization)
```json
{
  "_id": "6910b71018f5893b2101aea6",
  "userId": "690f3c63bd0a03a91f3cd7fb",
  "trackId": "2hIeKWgUP5nZYKeON16GQa",  // Reference to tracks
  "playCount": 1,
  "lastPlayedAt": "2025-11-09T15:01:40.000Z"
}
```
**Removed**: `trackName`, `artistName`, `albumName`, `albumArt`, `trackKey` (duplicate)  
**Space saved**: 357 × 140 bytes = **50 KB** (~65% reduction)

---

#### **reviews** (AFTER normalization)
```json
{
  "_id": "690f52bb6404c1f95cf4885e",
  "userId": "690f520b6404c1f95cf48848",
  "itemType": "track",
  "itemId": "3A4FRzgve9BjfKbvVXRIFO",  // Reference to tracks/albums
  "rating": 4.5,
  "reviewText": null,
  "isPublic": true,
  "reactionsCount": { "fire": 1, "like": 1 },
  "reactionsByUser": { ... },
  "listeningDate": "2025-11-08T14:24:59.920Z"
}
```
**Removed**: `itemName`, `artistName`, `albumArt`, `likes` (computed)  
**Space saved**: 12 × 100 bytes = **1.2 KB**

---

### 📊 TOTAL SAVINGS SUMMARY

| Collection | Before | After | Saved | % Reduction |
|------------|--------|-------|-------|-------------|
| scrobbles | 989 docs × 280 bytes | 989 docs × 130 bytes | **148 KB** | **54%** |
| albumstats | 301 docs × 200 bytes | 301 docs × 80 bytes | **36 KB** | **60%** |
| trackstats | 357 docs × 220 bytes | 357 docs × 80 bytes | **50 KB** | **64%** |
| reviews | 12 docs × 300 bytes | 12 docs × 200 bytes | **1.2 KB** | **33%** |
| **TOTAL** | **~411 KB** | **~176 KB** | **~235 KB** | **~57%** |

**At 100k documents scale**: Save **~13 MB** of storage + **~20 MB** of index overhead

---

## 🔄 API IMPACT ANALYSIS

### Routes That Need Updates

#### 1. `POST /api/music/scrobble`
**Current**: Saves full metadata with scrobble  
**After**: 
1. Check if `trackId` exists in `tracks` collection
2. If not, fetch from Spotify API and cache in `tracks`
3. Save scrobble with only `trackId` reference
4. Lookup track metadata on read (JOIN operation)

---

#### 2. `GET /api/music/scrobbles`
**Current**: Returns scrobbles with embedded metadata  
**After**:
```javascript
// Aggregate with $lookup
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
  { $unwind: '$track' },
  {
    $lookup: {
      from: 'albums',
      localField: 'track.albumId',
      foreignField: '_id',
      as: 'album'
    }
  },
  { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } }
]);
```

---

#### 3. `GET /api/music/listening-stats`
**Current**: Reads metadata from `albumstats`, `trackstats`  
**After**: Add $lookup to join with `albums`, `tracks` collections

---

#### 4. `POST /api/reviews`
**Current**: Saves `itemName`, `artistName`, `albumArt`  
**After**: Only save `itemId` (Spotify ID), fetch metadata on read

---

#### 5. Background Jobs
**`archiveScrobbles.js`**: 
- Currently aggregates scrobbles with embedded metadata
- After: Need $lookup joins when building stats

---

## 🎯 MIGRATION PLAN

### Phase 1: Create New Collections (NO DOWNTIME)
```javascript
// Step 1: Extract unique tracks from scrobbles
db.scrobbles.aggregate([
  { $group: {
    _id: "$spotifyId",
    name: { $first: "$trackName" },
    artistName: { $first: "$artistName" },
    albumId: { $first: "$albumId" },
    durationMs: { $first: "$durationMs" }
  }},
  { $out: "tracks" }
]);

// Step 2: Extract unique albums
db.albumstats.aggregate([
  { $group: {
    _id: "$albumId",
    name: { $first: "$albumName" },
    artistName: { $first: "$artistName" },
    albumArt: { $first: "$albumArt" }
  }},
  { $out: "albums" }
]);
```

### Phase 2: Update Application Code (DUAL WRITES)
- Keep writing old fields for backward compatibility
- Also write/read from new `tracks`/`albums` collections
- Update all API routes to use $lookup

### Phase 3: Verify Data Integrity
- Run consistency checks
- Ensure all `trackId` references exist in `tracks`
- Ensure all `albumId` references exist in `albums`

### Phase 4: Drop Redundant Fields (AFTER TESTING)
```javascript
// Remove redundant fields from scrobbles
db.scrobbles.updateMany({}, {
  $unset: {
    trackName: "",
    artistName: "",
    albumName: "",
    albumArt: "",
    durationMs: ""
  }
});

// Similar for albumstats, trackstats, reviews
```

### Phase 5: Cleanup & Monitor
- Drop unused `completionevents` collection
- Monitor query performance
- Adjust indexes as needed

---

## 🚨 RISKS & CONSIDERATIONS

### Performance Impact
- **$lookup operations** are slower than embedded data
- Need proper indexes on `tracks._id` and `albums._id`
- Cache frequently accessed tracks/albums in Redis/memory

### Data Consistency
- Spotify metadata can change (rare but possible)
- Need periodic sync job to update `tracks`/`albums` from Spotify API

### Migration Complexity
- ~1,659 documents to migrate
- Need careful testing before production rollout
- Rollback plan required

---

## 💡 ADDITIONAL RECOMMENDATIONS

### 1. Encrypt Sensitive Data
```javascript
// User model
accessToken: { type: String, required: true, encrypted: true },
refreshToken: { type: String, required: true, encrypted: true }
```

### 2. Implement Caching
```javascript
// Redis cache for frequently accessed metadata
const track = await redis.get(`track:${trackId}`);
if (!track) {
  track = await Track.findById(trackId);
  await redis.setex(`track:${trackId}`, 3600, JSON.stringify(track));
}
```

### 3. Add Missing Indexes
```javascript
// For faster aggregations
db.scrobbles.createIndex({ trackId: 1 });
db.albumstats.createIndex({ albumId: 1 });
db.trackstats.createIndex({ trackId: 1 });
```

### 4. Archive Old Scrobbles
- Current policy: 30 days in MongoDB
- Consider moving to cheaper storage (S3, cold storage) after 90 days
- Keep only aggregated stats in hot storage

---

## 📝 CONCLUSION

### Current State
- ✅ App works fine for small scale (<10k docs)
- ❌ **57% storage waste** from metadata duplication
- ❌ Orphaned collection (`completionevents`)
- ⚠️ Security concern (plaintext tokens)

### Recommended Actions (Priority Order)

1. **HIGH PRIORITY**: Normalize `scrobbles`, `albumstats`, `trackstats` to reference `tracks`/`albums`
2. **MEDIUM PRIORITY**: Encrypt `accessToken`, `refreshToken`
3. **MEDIUM PRIORITY**: Delete or implement `completionevents` properly
4. **LOW PRIORITY**: Implement Redis caching for hot metadata
5. **LOW PRIORITY**: Optimize `reactionsByUser` in `reviews` (use separate collection if grows large)

### Estimated Effort
- **Phase 1-2**: 2-3 days (create collections + update code)
- **Phase 3-4**: 1-2 days (migration + testing)
- **Total**: **~1 week** for complete normalization

---

**Generated**: November 11, 2025  
**Next Review**: After implementing Phase 1-2 of migration plan
