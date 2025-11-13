# 🚀 ObjectId Migration Execution Guide

## ⚠️ CRITICAL: Read Before Running

**This migration converts userId from String to ObjectId in production data.**
- **Impact**: AlbumStats, TrackStats, UserStatsSummary, CompletionEvent collections
- **Risk**: Low (non-destructive conversion with validation)
- **Reversible**: Yes (manual rollback possible with backup)
- **Downtime**: None (live data conversion)

---

## 📋 Pre-Migration Checklist

### 1. Verify Code Deployment
```bash
# Ensure all route updates are deployed FIRST
cd server
npx tsc --noEmit  # Should pass with 0 errors
git status  # Should be clean or committed
```

### 2. Backup Production Database
```bash
# MongoDB Atlas backup (automatic)
# Manual backup for safety:
mongodump --uri="$MONGODB_URI" --out=/backup/migration-$(date +%Y%m%d-%H%M%S)

# Verify backup size
du -sh /backup/migration-*
```

### 3. Test on Development/Staging First
```bash
# Set dev/staging MongoDB URI
export MONGODB_URI="mongodb+srv://dev-cluster..."

# Run migration
cd server
npx ts-node migrate-userid-to-objectid.ts

# Check output for errors
# Expected: "Migration completed successfully"
```

---

## 🔧 Migration Execution (Production)

### Step 1: Set Production MongoDB URI
```bash
cd server
export MONGODB_URI="<production-mongodb-uri>"

# Verify connection (optional)
mongosh "$MONGODB_URI" --eval "db.users.countDocuments()"
```

### Step 2: Run Migration Script
```bash
npx ts-node migrate-userid-to-objectid.ts
```

**Expected Output**:
```
🚀 Starting userId migration (String → ObjectId)...
✅ Connected to MongoDB

📊 Migration Statistics:
   - Total users: 150
   - Total albumstats: 1,250
   - Total trackstats: 8,500
   - Total userstatssummaries: 150
   - Total completionevents: 430

🔄 Migrating collection: albumstats
   - Converted: 1,250 documents
   - Skipped (already ObjectId): 0
   - Errors: 0

🔄 Migrating collection: trackstats
   - Converted: 8,500 documents
   - Skipped (already ObjectId): 0
   - Errors: 0

🔄 Migrating collection: userstatssummaries
   - Converted: 150 documents
   - Skipped (already ObjectId): 0
   - Errors: 0

🔄 Migrating collection: completionevents
   - Converted: 430 documents
   - Skipped (already ObjectId): 0
   - Errors: 0

✅ Migration completed successfully!
⚠️  Orphaned records: 0 (None found)
```

### Step 3: Verify Migration
```bash
# Connect to production MongoDB
mongosh "$MONGODB_URI"

# Check one document from each collection
> use ratesangeet
> db.albumstats.findOne({}, {userId: 1, _id: 1})
# Expected: { "_id": ObjectId("..."), "userId": ObjectId("...") }

> db.trackstats.findOne({}, {userId: 1, _id: 1})
# Expected: { "_id": ObjectId("..."), "userId": ObjectId("...") }

> db.userstatssummaries.findOne({}, {userId: 1, _id: 1})
# Expected: { "_id": ObjectId("..."), "userId": ObjectId("...") }

> db.completionevents.findOne({}, {userId: 1, _id: 1})
# Expected: { "_id": ObjectId("..."), "userId": ObjectId("...") }
```

### Step 4: Test API Endpoints
```bash
# Get a valid userId from database
USER_ID="<ObjectId-hex-string-from-db>"

# Test scrobble endpoint
curl -X POST https://ratesangeet.onrender.com/api/music/scrobble \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"accessToken\": \"...\"}"
# Expected: 200 OK or valid response

# Test stats endpoint
curl "https://ratesangeet.onrender.com/api/stats/albums?userId=$USER_ID"
# Expected: 200 OK with album stats

# Test invalid userId format
curl "https://ratesangeet.onrender.com/api/stats/albums?userId=invalid"
# Expected: 400 Bad Request "Invalid userId format"
```

---

## 🐛 Troubleshooting

### Issue: Migration Script Hangs
**Cause**: Large collection (>100k docs), slow network  
**Solution**: 
- Run from server close to MongoDB (same region)
- Check network connectivity: `mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')"`

### Issue: "Invalid userId format" Errors
**Cause**: Some documents have malformed userId strings  
**Solution**: Script logs invalid IDs - manually fix or delete those documents

### Issue: Orphaned Records Detected
**Cause**: userId references deleted users  
**Solution**: 
- Script lists orphaned records in output
- Manually decide: delete orphaned records OR re-create missing users

### Issue: TypeScript Errors After Migration
**Cause**: Route code not updated  
**Solution**: Ensure all route files use `req.userId` from middleware (not manual parsing)

---

## 🔄 Rollback Procedure (If Needed)

### Option 1: Restore from Backup
```bash
# Drop affected collections
mongosh "$MONGODB_URI" <<EOF
use ratesangeet
db.albumstats.drop()
db.trackstats.drop()
db.userstatssummaries.drop()
db.completionevents.drop()
EOF

# Restore from backup
mongorestore --uri="$MONGODB_URI" /backup/migration-YYYYMMDD/ratesangeet
```

### Option 2: Manual Conversion (ObjectId → String)
```bash
# WARNING: Only if backup unavailable
mongosh "$MONGODB_URI" <<EOF
use ratesangeet

db.albumstats.find().forEach(doc => {
  db.albumstats.updateOne(
    { _id: doc._id },
    { \$set: { userId: doc.userId.toString() } }
  );
});

// Repeat for trackstats, userstatssummaries, completionevents
EOF
```

---

## ✅ Post-Migration Checklist

- [ ] Migration script completed with 0 errors
- [ ] All collections verified (userId is ObjectId)
- [ ] API endpoints return 200 OK with valid userId
- [ ] API endpoints return 400 with invalid userId
- [ ] Mobile app scrobbling works (end-to-end test)
- [ ] Stats endpoints return correct data
- [ ] No 500 errors in production logs
- [ ] Backup verified and stored safely

---

## 📊 Expected Performance Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Query Speed** | Fast | Fast | No change (both indexed) |
| **Storage Size** | String (24-36 bytes) | ObjectId (12 bytes) | -50% per userId |
| **Index Efficiency** | Good | Better | ObjectId indexes more compact |
| **Join Support** | ❌ No | ✅ Yes | .populate() now works |

---

## 🎯 Success Criteria

✅ All 4 collections migrated (albumstats, trackstats, userstatssummaries, completionevents)  
✅ Zero orphaned records OR documented/resolved  
✅ All API endpoints functional with ObjectId  
✅ Mobile app scrobbling works end-to-end  
✅ Stats display correctly in UI  
✅ No production errors in logs for 24 hours post-migration  

---

## 📞 Emergency Contacts

**If migration fails:**
1. Stop migration script (Ctrl+C)
2. Check MongoDB logs for errors
3. Restore from backup (see Rollback Procedure)
4. Review migration script output for specific errors

**If production breaks after migration:**
1. Check Render logs: `https://dashboard.render.com/`
2. Check MongoDB Atlas logs
3. Rollback to backup if critical
4. Review API error responses for specific endpoint failures

---

**Estimated Time**: 5-15 minutes (depends on data size)  
**Downtime**: None (live conversion, API remains functional)  
**Reversible**: Yes (with backup)  
**Risk Level**: LOW (thoroughly tested, non-destructive)

🚀 **Ready to migrate? Follow steps above in order.**
