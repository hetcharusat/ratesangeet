# Production 500 Errors - Diagnosis & Fix

## Error Report (Nov 9, 2025)

### Affected Endpoints
1. `POST /api/music/scrobble` - 500 Internal Server Error
2. `GET /api/users/:id/activity` - 500 Internal Server Error  
3. `GET /api/users/:id` - 500 Internal Server Error

### Analysis

**NOT caused by recent changes:**
- Skip detection code (only affects `/sync-recent`)
- Reaction users endpoint (new, separate route)

**Likely causes:**
1. **MongoDB connection timeout** during Render cold start
2. **Missing user documents** causing query failures
3. **Malformed data** in reactions/stats collections
4. **Render deployment lag** (code not yet deployed)

### Immediate Fix Applied

**Commit `bac4350`**: Added defensive error handling to reaction users endpoint
- Check Map validity before iteration
- Try-catch around Map operations
- Early returns on empty data

### Root Cause Investigation Needed

#### 1. Check Render Deployment Status
- Verify latest commit is deployed
- Check Render logs for errors
- Confirm MongoDB connection string

#### 2. Database Integrity
- Verify all scrobbles have valid `userId` references
- Check for orphaned reactions (userId doesn't exist)
- Validate Map field serialization in MongoDB

#### 3. Add Defensive Code (TODO)

**Priority endpoints to harden:**

```typescript
// /api/music/scrobble
- ✅ Already has user validation
- Add timeout handling for Spotify API
- Add retry logic for MongoDB operations

// /api/users/:id
- Add null checks for user document
- Handle missing stats gracefully
- Add default values for undefined fields

// /api/users/:id/activity  
- Validate review userId population
- Handle missing user references
- Add pagination/limit to prevent timeouts
```

### Monitoring Plan

1. **Add request timing logs**:
   ```typescript
   const start = Date.now();
   // ... endpoint logic
   console.log(`[${req.path}] ${Date.now() - start}ms`);
   ```

2. **Add error context**:
   ```typescript
   catch (error) {
     console.error(`[${req.path}] Error:`, {
       message: error.message,
       stack: error.stack,
       userId: req.body.userId || req.params.id,
     });
   }
   ```

3. **Monitor Render metrics**:
   - Response times
   - Error rates
   - MongoDB connection pool
   - Memory usage

### Prevention

1. **All database queries should**:
   - Have `.lean()` for read-only operations
   - Include `.select()` to limit fields
   - Use `.limit()` on large collections
   - Have fallback/default values

2. **All Map field operations should**:
   - Check `instanceof Map` first
   - Wrap `.entries()` in try-catch
   - Convert to Array before iteration
   - Have empty array fallback

3. **All external API calls should**:
   - Have timeout configured
   - Include retry logic
   - Log request/response times
   - Handle 429 rate limits

### Deployment Strategy

1. ✅ **Immediate**: Defensive Map handling (deployed)
2. **Next**: Add timing/error logs to top 3 endpoints
3. **Then**: Database integrity check script
4. **Finally**: Comprehensive error handling audit

### Testing Checklist

Before declaring "fixed":
- [ ] All 3 endpoints return 200 consistently
- [ ] No 500 errors in production console for 24h
- [ ] Render logs show no MongoDB connection issues
- [ ] Scrobbling works end-to-end
- [ ] User profiles load without errors

### If Errors Persist

**Emergency rollback plan:**
```bash
git revert bac4350  # Revert safety fix
git revert f237275  # Revert like/dislike feature
git revert aff1f7d  # Revert skip detection
git push origin dev --force
```

**Then investigate:**
1. Check if errors existed before our changes
2. Review Render deployment logs
3. Check MongoDB Atlas metrics
4. Test with different user accounts
5. Check for rate limiting from Spotify API

---

## Current Status

- ✅ Safety fix deployed (`bac4350`)
- ⏳ Waiting for Render to redeploy
- 🔍 Monitoring for 500 errors to stop
- 📊 Need Render logs to confirm root cause
