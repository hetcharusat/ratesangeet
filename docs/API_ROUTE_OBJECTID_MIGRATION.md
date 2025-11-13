# API Route Updates for ObjectId Schema

**Status**: 🚧 IN PROGRESS  
**Priority**: CRITICAL - Required after schema migration

## Overview

After converting `userId` from `String` to `Types.ObjectId` in models, all API routes must convert string user IDs to ObjectId before querying.

## Helper Utility Created ✅

**File**: `server/src/utils/db.ts`

```typescript
import { toObjectId } from '../../utils/db.js';

// Convert string to ObjectId (throws if invalid)
const userId = toObjectId(userIdString);

// Safe conversion (returns null if invalid)
const userId = toObjectIdSafe(userIdString);
```

## Route Files Requiring Updates

### 1. ✅ **UPDATED**: `server/src/routes/v2/scrobbles.ts`

**Lines Updated**:
- Line 40: Added `toObjectId` import
- Line 43-48: Convert `userIdString` to `userId` ObjectId before queries

**Pattern**:
```typescript
// OLD
const userId = req.headers['x-user-id'] as string;

// NEW
const userIdString = req.headers['x-user-id'] as string;
const userId = toObjectId(userIdString); // Throws if invalid
```

**Remaining in this file**:
- Line 261: GET `/recent` endpoint
- Line 306: GET `/archive-ready` endpoint  
- Line 350: POST `/ack-archive` endpoint

### 2. 🚧 **NEEDS UPDATE**: `server/src/routes/stats.ts`

**Queries to fix**:
- Line 106: `AlbumStats.find({ userId })`
- Line 239: `TrackStats.find({ userId })`

**Pattern**:
```typescript
// Add import
import { toObjectId } from '../utils/db.js';

// In route handler
const userIdString = req.headers['x-user-id'] as string;
const userId = toObjectId(userIdString);
```

### 3. 🚧 **NEEDS UPDATE**: `server/src/routes/scrobbleV2.ts`

**Queries to fix**:
- Line 141: `TrackStats.findOne({ userId: String(userId), trackKey })`
  - Change to: `TrackStats.findOne({ userId: toObjectId(userId), trackKey })`
- Line 148: `TrackStats.findOneAndUpdate({ userId, trackKey }, ...)`
- Line 181: `AlbumStats.findOneAndUpdate({ userId, albumKey }, ...)`
- Line 213, 242: `AlbumStats.updateOne({ userId, albumKey }, ...)`
- Line 255: `UserStatsSummary.findOneAndUpdate({ userId }, ...)`

**Critical**: This file has `String(userId)` casts that **must be removed**:
```typescript
// WRONG (after migration)
const existingTrack = await TrackStats.findOne({ userId: String(userId), trackKey });

// CORRECT
const userId = toObjectId(userIdString);
const existingTrack = await TrackStats.findOne({ userId, trackKey });
```

### 4. 🚧 **NEEDS UPDATE**: `server/src/routes/music.ts`

**Critical file with many queries**. Lines:
- 414: `UserStatsSummary.findOneAndUpdate({ userId }, ...)`
- 483: `AlbumStats.findOneAndUpdate({ userId: String(userId), albumKey }, ...)`
- 510, 529, 550: `AlbumStats.updateOne({ userId: String(userId), albumKey }, ...)`
- 521: `AlbumStats.findById(stats._id)`
- 683: `TrackStats.findOne({ userId: String(userId), trackKey })`
- 689: `TrackStats.findOneAndUpdate({ userId: String(userId), trackKey }, ...)`
- 721: `AlbumStats.findOneAndUpdate({ userId: String(userId), albumKey }, ...)`
- 751, 778: `AlbumStats.updateOne({ userId: String(userId), albumKey }, ...)`
- 786: `UserStatsSummary.findOneAndUpdate({ userId: String(userId) }, ...)`
- 1158: `AlbumStats.find({ userId: String(userId), albumPlayCount: { $gt: 0 } })`
- 1519: `UserStatsSummary.findOneAndUpdate({ userId: String(userId) }, ...)`

**Systematic fix required**: Replace all `String(userId)` with proper ObjectId conversion at route entry.

### 5. 🚧 **NEEDS UPDATE**: `server/src/routes/home.ts`

**Queries to fix**:
- Line 68: `AlbumStats.find({ userId: user.spotifyId })`
- Line 75: `TrackStats.find({ userId: user.spotifyId })`
- Line 82: `UserStatsSummary.findOne({ userId: user.spotifyId })`

**Note**: Using `user.spotifyId` - need to convert to ObjectId if it's the User document's `_id`.

## Systematic Update Strategy

### Step 1: Add Import to All Route Files
```typescript
import { toObjectId } from '../utils/db.js'; // or ../../utils/db.js
```

### Step 2: Convert at Route Entry Point
```typescript
router.post('/endpoint', async (req, res) => {
  try {
    // Get string userId
    const userIdString = req.body.userId || 
                        req.headers['x-user-id'] || 
                        req.query.userId as string;
    
    if (!userIdString) {
      return res.status(401).json({ error: 'Unauthorized: userId required' });
    }
    
    // Convert to ObjectId (throws if invalid)
    let userId;
    try {
      userId = toObjectId(userIdString);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }
    
    // Now use userId ObjectId in all queries...
    const stats = await AlbumStats.find({ userId });
  } catch (error) {
    // ...
  }
});
```

### Step 3: Remove All `String(userId)` Casts
```typescript
// BEFORE (wrong after migration)
const stats = await AlbumStats.findOne({ userId: String(userId), albumKey });

// AFTER (correct)
const stats = await AlbumStats.findOne({ userId, albumKey });
```

## Testing Checklist

After updating all routes:

- [ ] Test POST `/api/v2/scrobbles/batch-upsert` with valid userId
- [ ] Test GET `/api/v2/scrobbles/recent` with valid userId
- [ ] Test GET `/api/stats/albums` with valid userId
- [ ] Test GET `/api/stats/tracks` with valid userId
- [ ] Test GET `/api/stats/summary` with valid userId
- [ ] Test all endpoints with **invalid** userId format (should return 400)
- [ ] Test all endpoints with **missing** userId (should return 401)
- [ ] Verify queries return correct data (compare before/after migration)

## Error Handling

### Invalid ObjectId Format
```typescript
// Input: "not-a-valid-objectid"
// Response: 400 Bad Request
{ "error": "Invalid userId format" }
```

### Missing userId
```typescript
// Input: no x-user-id header
// Response: 401 Unauthorized
{ "error": "Unauthorized: userId required" }
```

### Orphaned Records (userId not in users collection)
```typescript
// Query succeeds but returns no data
// Consider adding middleware to validate userId exists in users collection
```

## Migration Order

1. ✅ **DONE**: Fix schema definitions (AlbumStats, TrackStats, UserStatsSummary, CompletionEvent)
2. ✅ **DONE**: Create `utils/db.ts` helper
3. ✅ **DONE**: Update `routes/v2/scrobbles.ts` (partial - batch-upsert only)
4. 🚧 **TODO**: Update remaining endpoints in `routes/v2/scrobbles.ts`
5. 🚧 **TODO**: Update `routes/stats.ts`
6. 🚧 **TODO**: Update `routes/scrobbleV2.ts`
7. 🚧 **TODO**: Update `routes/music.ts` (most critical - many queries)
8. 🚧 **TODO**: Update `routes/home.ts`
9. 🚧 **TODO**: Run full integration test suite
10. 🚧 **TODO**: Run database migration script
11. 🚧 **TODO**: Deploy to staging
12. 🚧 **TODO**: Production deployment

## Alternative: Middleware Approach

Instead of updating each route individually, create a middleware:

```typescript
// server/src/middleware/parseUserId.ts
import { Request, Response, NextFunction } from 'express';
import { toObjectId } from '../utils/db.js';

export function parseUserId(req: Request, res: Response, next: NextFunction) {
  const userIdString = req.body.userId || 
                      req.headers['x-user-id'] || 
                      req.query.userId as string;
  
  if (!userIdString) {
    return res.status(401).json({ error: 'Unauthorized: userId required' });
  }
  
  try {
    (req as any).userId = toObjectId(userIdString);
    (req as any).userIdString = userIdString;
    next();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }
}

// Usage in routes
import { parseUserId } from '../middleware/parseUserId.js';

router.post('/endpoint', parseUserId, async (req, res) => {
  const userId = (req as any).userId; // Already ObjectId
  const stats = await AlbumStats.find({ userId });
  // ...
});
```

**Recommendation**: Use middleware approach for cleaner code and consistent validation.

---

**Last Updated**: November 12, 2025  
**Next Action**: Create `parseUserId` middleware and apply to all v2 routes
