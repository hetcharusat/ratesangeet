# 🗺️ DATABASE SCHEMA QUICK REFERENCE

## Collection Overview (9 total)

```
📦 ratesangeet Database (1,693 documents)
│
├── 🎵 scrobbles (989) ────────────► Listening history
├── 📈 albumstats (301) ───────────► Per-user album stats
├── 🎶 trackstats (357) ───────────► Per-user track stats  
├── ⭐ reviews (12) ────────────────► User reviews/ratings
├── 💬 reviewcomments (13) ────────► Review comments
├── 👤 users (8) ───────────────────► User profiles & auth
├── 📊 userstatssummaries (6) ─────► Lifetime user stats
├── 🏆 completionevents (0) ───────► ❌ DEAD - Not used
└── 🖥️ serverstats (1) ────────────► Server health metrics
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SPOTIFY API                              │
│                 (Source of Truth)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Currently Playing / Recently Played
                   ▼
         ┌─────────────────────┐
         │  POST /api/music/   │
         │  scrobble           │
         └──────────┬──────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
   ┌────────────┐     ┌────────────┐
   │ scrobbles  │     │   users    │
   │  (989)     │     │    (8)     │
   │            │     │            │
   │ ❌ Stores  │     │ ✅ Profile │
   │ full track │     │ Auth tokens│
   │ metadata   │     │ Social     │
   └─────┬──────┘     └────────────┘
         │
         │ Background Job (archiveScrobbles.js)
         │ Runs every hour
         │
         ▼
   ┌─────────────────────────────────┐
   │  Aggregate into Stats Tables    │
   └────────┬────────────────────────┘
            │
            ├──────┬───────────┬──────────┐
            ▼      ▼           ▼          ▼
     ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
     │albumstats│ │track   │ │user    │ │Archive  │
     │  (301)   │ │stats   │ │stats   │ │(delete) │
     │          │ │(357)   │ │summaries│ │old      │
     │ ❌ Stores│ │        │ │(6)     │ │scrobbles│
     │ full     │ │❌ Stores│ │        │ │>30 days │
     │ album    │ │full    │ │✅ Just │ └─────────┘
     │ metadata │ │track   │ │counters│
     └──────────┘ │metadata│ └────────┘
                  └────────┘
                      │
                      │ Used by
                      ▼
          ┌────────────────────────┐
          │ GET /api/music/        │
          │ listening-stats        │
          │                        │
          │ Returns: Home Screen   │
          │ Stats (Top Albums,     │
          │ Total Plays, etc.)     │
          └────────────────────────┘

┌─────────────────────────────────────┐
│         REVIEWS FLOW                │
└─────────────────────────────────────┘

  User rates track/album
         │
         ▼
  ┌──────────────┐
  │ POST /api/   │
  │ reviews      │
  └──────┬───────┘
         │
         ▼
  ┌────────────┐     ┌─────────────────┐
  │  reviews   │────►│ reviewcomments  │
  │   (12)     │     │      (13)       │
  │            │     │                 │
  │ ❌ Stores  │     │ ✅ Efficient    │
  │ item       │     │ Just IDs + text │
  │ metadata   │     └─────────────────┘
  └────────────┘
         │
         │ Used by
         ▼
  ┌──────────────────┐
  │ GET /api/reviews/│
  │ public           │
  │                  │
  │ GET /api/reviews/│
  │ user/:userId     │
  └──────────────────┘
```

---

## API Endpoint → Collection Mapping

### Authentication (`/api/auth/*`)
| Method | Endpoint | Writes To | Reads From |
|--------|----------|-----------|------------|
| POST | `/auth/callback` | `users` | `users` |
| POST | `/auth/refresh` | `users` (updates tokens) | `users` |

### Music/Scrobbling (`/api/music/*`)
| Method | Endpoint | Writes To | Reads From |
|--------|----------|-----------|------------|
| POST | `/music/scrobble` | `scrobbles` | `users` |
| GET | `/music/scrobbles` | - | `scrobbles` |
| POST | `/music/sync-recent` | `scrobbles` | `users` |
| GET | `/music/listening-stats` | - | `albumstats`, `trackstats`, `userstatssummaries`, `scrobbles` |

### Reviews (`/api/reviews/*`)
| Method | Endpoint | Writes To | Reads From |
|--------|----------|-----------|------------|
| POST | `/reviews` | `reviews` | `reviews` |
| GET | `/reviews/public` | - | `reviews` |
| GET | `/reviews/user/:userId` | - | `reviews` |
| GET | `/reviews/:id` | - | `reviews` |
| PUT | `/reviews/:id` | `reviews` | `reviews` |
| DELETE | `/reviews/:id` | `reviews` (delete) | `reviews` |
| POST | `/reviews/:id/react` | `reviews` (update reactions) | `reviews` |
| GET | `/reviews/:id/comments` | - | `reviewcomments` |
| POST | `/reviews/:id/comments` | `reviewcomments` | `reviews` |

### Users/Social (`/api/users/*`)
| Method | Endpoint | Writes To | Reads From |
|--------|----------|-----------|------------|
| GET | `/users/:id` | - | `users`, `scrobbles`, `reviews` |
| GET | `/users/:id/feed` | - | `users`, `reviews` |
| GET | `/users/:id/followers` | - | `users` |
| GET | `/users/:id/following` | - | `users` |
| POST | `/users/:id/follow` | `users` (both users) | `users` |
| POST | `/users/:id/unfollow` | `users` (both users) | `users` |
| PUT | `/users/:id/username` | `users` | `users` |
| PUT | `/users/:id/profile` | `users` | `users` |

### Background Jobs
| Job | Frequency | Writes To | Reads From |
|-----|-----------|-----------|------------|
| `archiveScrobbles.js` | Every hour | `albumstats`, `trackstats`, `userstatssummaries` | `scrobbles` |
| `archiveScrobbles.js` (cleanup) | After aggregation | `scrobbles` (deletes >30 days) | `scrobbles` |

---

## Redundant Data Map

### 🔴 CRITICAL: Same data in multiple places

```
TRACK METADATA (trackName, artistName, albumName, albumArt)
┌──────────────┐
│  SPOTIFY API │ ← Source of Truth
└──────┬───────┘
       │
       └─────┬─────────┬────────────┬──────────┐
             │         │            │          │
             ▼         ▼            ▼          ▼
       ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐
       │scrobbles │ │album   │ │track   │ │reviews │
       │  989×    │ │stats   │ │stats   │ │  12×   │
       │          │ │ 301×   │ │ 357×   │ │        │
       └──────────┘ └────────┘ └────────┘ └────────┘
             ▲         ▲            ▲          ▲
             └─────────┴────────────┴──────────┘
                    ALL DUPLICATES!
              Should reference single source
```

### Field Duplication Count
- `trackName`: **1,358 duplicates** (scrobbles + trackstats + reviews)
- `artistName`: **1,659 duplicates** (all 4 collections)
- `albumName`: **1,647 duplicates** (scrobbles + albumstats + trackstats)
- `albumArt`: **1,659 duplicates** (all 4 collections)

---

## Proposed Normalized Structure

```
┌──────────────┐
│  SPOTIFY API │
└──────┬───────┘
       │
       │ Fetch once, cache forever
       ▼
┌────────────────────────────────────┐
│   NEW: tracks Collection           │
│   (_id = Spotify Track ID)         │
│                                    │
│   {                                │
│     _id: "spotify_track_id",       │
│     name: "Song Name",             │
│     artistName: "Artist",          │
│     albumId: "spotify_album_id",   │
│     durationMs: 217000             │
│   }                                │
└──────────┬─────────────────────────┘
           │
           │ Referenced by
           │
     ┌─────┼─────┬──────────┬─────────┐
     │     │     │          │         │
     ▼     ▼     ▼          ▼         ▼
┌─────┐ ┌────┐ ┌──────┐ ┌───────┐ ┌──────┐
│scro │ │albu│ │track │ │reviews│ │... │
│bbles│ │msta│ │stats │ │       │ │    │
│     │ │ts  │ │      │ │       │ │    │
│ONLY:│ │ONLY│ │ONLY: │ │ONLY:  │ │    │
│     │ │    │ │      │ │       │ │    │
│user │ │user│ │user  │ │user   │ │    │
│Id   │ │Id  │ │Id    │ │Id     │ │    │
│track│ │albu│ │track │ │itemId │ │    │
│Id   │ │mId │ │Id    │ │rating │ │    │
│play │ │play│ │play  │ │text   │ │    │
│edAt │ │Coun│ │Count │ │       │ │    │
└─────┘ │t   │ └──────┘ └───────┘ └────┘
        └────┘

NO MORE DUPLICATE METADATA! 🎉
All metadata lives in tracks/albums collections
Stats tables only store IDs + counters
```

---

## Index Strategy

### Current Indexes (9 collections)
```
scrobbles:
  - userId_1_playedAt_-1 ✅ (recent scrobbles)
  - userId_1_spotifyId_1_playedAt_1 ✅ (deduplication)

albumstats:
  - userId_1_albumKey_1 ✅ (unique per user-album)
  - userId_1_playCount_-1 ✅ (top albums)
  - userId_1_completedPlays_-1 ✅ (completed albums)

trackstats:
  - userId_1_trackKey_1 ✅ (unique per user-track)
  - userId_1_playCount_-1 ✅ (top tracks)

reviews:
  - userId_1_createdAt_-1 ✅ (user reviews timeline)
  - spotifyId_1_userId_1 ✅ (unique review per item)
  - isPublic_1_createdAt_-1 ✅ (public feed)

reviewcomments:
  - reviewId_1_createdAt_-1 ✅ (comment threads)
  - parentId_1_createdAt_1 ✅ (nested replies)
  - userId_1 ✅ (user's comments)

users:
  - spotifyId_1 ✅ (unique login)
  - username_1 ✅ (unique username)
  - username_text_displayName_text ✅ (search)
  - tokenStatus_1 ✅ (health monitoring)

userstatssummaries:
  - userId_1 ✅ (unique per user)

completionevents:
  - userId_1_completedAt_-1 ❌ (unused)
  - completedAt_1 ❌ (unused)

serverstats:
  - _id_ (default)
```

### Recommended New Indexes (after normalization)
```
tracks:
  - _id (Spotify track ID) ✅ PRIMARY
  - albumId_1 🆕 (for album lookups)

albums:
  - _id (Spotify album ID) ✅ PRIMARY
  - artistName_1 🆕 (for artist page)

scrobbles:
  - trackId_1 🆕 (for $lookup joins)

albumstats:
  - albumId_1 🆕 (for $lookup joins)

trackstats:
  - trackId_1 🆕 (for $lookup joins)
```

---

## Storage Efficiency Comparison

### Current (Denormalized)
```
Collection      Docs    Avg Size    Total      
─────────────────────────────────────────────
scrobbles       989     280 bytes   277 KB    
albumstats      301     200 bytes    60 KB    
trackstats      357     220 bytes    79 KB    
reviews          12     300 bytes     4 KB    
OTHER           334      varies      91 KB    
─────────────────────────────────────────────
TOTAL         1,693                 511 KB    
```

### After Normalization
```
Collection      Docs    Avg Size    Total      
─────────────────────────────────────────────
scrobbles       989     130 bytes   129 KB  ⬇️ 53%
albumstats      301      80 bytes    24 KB  ⬇️ 60%
trackstats      357      80 bytes    29 KB  ⬇️ 63%
reviews          12     200 bytes     2 KB  ⬇️ 33%
tracks (NEW)    500     250 bytes   125 KB  🆕
albums (NEW)    200     200 bytes    40 KB  🆕
OTHER           334      varies      91 KB  →
─────────────────────────────────────────────
TOTAL         2,693                 440 KB  ⬇️ 14%
```

**Savings**: 71 KB now, **13 MB at 100k docs scale**

---

## Migration Checklist

### ✅ Pre-Migration
- [x] Database audit complete
- [ ] Backup production database
- [ ] Create `tracks` collection schema
- [ ] Create `albums` collection schema
- [ ] Write migration scripts
- [ ] Test migration on staging data

### 🔄 Phase 1: Dual Write (NO DOWNTIME)
- [ ] Update `/music/scrobble` to cache tracks
- [ ] Keep writing old fields for compatibility
- [ ] Update background jobs to populate tracks/albums
- [ ] Monitor for 1 week

### 🔄 Phase 2: Read Migration
- [ ] Update all GET endpoints to use $lookup
- [ ] Add Redis caching for hot tracks/albums
- [ ] Performance test vs baseline
- [ ] Rollback plan ready

### 🗑️ Phase 3: Cleanup (AFTER TESTING)
- [ ] Drop redundant fields from scrobbles
- [ ] Drop redundant fields from albumstats
- [ ] Drop redundant fields from trackstats
- [ ] Drop redundant fields from reviews
- [ ] Drop `completionevents` collection
- [ ] Rebuild indexes
- [ ] Monitor storage reduction

---

## Quick Stats

- **Total Documents**: 1,693
- **Active Collections**: 8 (1 is dead)
- **Storage Waste**: ~57% (272 KB / 475 KB)
- **Redundant Fields**: 4 fields × 1,659 duplicates
- **Migration Time**: ~1 week
- **Expected Savings**: 14% now, **~30% at scale**

---

**Last Updated**: November 11, 2025  
**See Full Report**: `DATABASE_AUDIT_REPORT.md`
