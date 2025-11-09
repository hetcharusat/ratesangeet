# Background Jobs - Timing & Manual Triggers

## ⏰ Automatic Job Schedule

### 1. Keep-Alive Ping (GitHub Actions)
- **Frequency**: Every 5 minutes
- **Purpose**: Keep Render server awake (prevent spin-down)
- **File**: `.github/workflows/keep-alive.yml`
- **Cron**: `*/5 * * * *`

### 2. Background Scrobbler
- **Frequency**: Every 30 minutes
- **Purpose**: Fetch recently played tracks from Spotify for all users
- **First Run**: 60 seconds after server starts
- **Environment Variable**: `BACKGROUND_SCROBBLE_INTERVAL_MS=1800000` (30 min)
- **Details**:
  - Fetches last 50 tracks per user
  - Auto-refreshes expired tokens
  - 5-second delay between users
  - Updates AlbumStats, TrackStats, UserStatsSummary

### 3. Archive Job
- **Frequency**: Every 24 hours
- **Purpose**: Clean up old scrobbles from cloud (keeps last 30 days)
- **First Run**: 30 seconds after server starts
- **Environment Variable**: `ARCHIVE_RETENTION_DAYS=90`
- **Details**:
  - Archives scrobbles older than retention period
  - Keeps last 200 scrobbles regardless of age
  - Aggregates counts into AlbumStats/TrackStats

## 🚀 Manual Trigger Endpoints

### Trigger Background Scrobbler

**Endpoint**: `POST /api/admin/trigger-scrobbler`

**Request**:
```bash
curl -X POST https://ratesangeet.onrender.com/api/admin/trigger-scrobbler \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "YOUR_ADMIN_KEY"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Background scrobbler triggered successfully",
  "note": "Job is running in background. Check server logs for progress."
}
```

### Trigger Archive Job

**Endpoint**: `POST /api/admin/trigger-archive`

**Request**:
```bash
curl -X POST https://ratesangeet.onrender.com/api/admin/trigger-archive \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "YOUR_ADMIN_KEY"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Archive job triggered successfully",
  "note": "Job is running in background. Check server logs for progress."
}
```

## 🔐 Security

**Admin Key Setup** (Render Dashboard):
1. Go to https://dashboard.render.com
2. Select `ratesangeet` service
3. Go to **Environment** tab
4. Add environment variable:
   - Key: `ADMIN_KEY`
   - Value: `your-secret-admin-key-here` (generate a strong random string)
5. Save changes (server will restart)

**Authorization**:
- Both endpoints require `adminKey` in request body
- Returns `401 Unauthorized` if key doesn't match
- Keep your admin key secret (don't commit to git)

## 📊 Monitoring Job Execution

### Check Render Logs
```
✅ MongoDB connected successfully
🚀 Server running on http://0.0.0.0:5000

# After 30 seconds:
🗄️  Starting archive job...
🗄️  Archive job starting { RETENTION_DAYS: 90, KEEP_RECENT_COUNT: 200, DRY_RUN: false }

# After 60 seconds:
🎵 Starting background scrobbler...
🎵 Starting background scrobbler job...
📊 Found 7 users to process
[1/7] Processing user: qbgsut4sn1n311rl8d7h4nyt8
✅ User qbgsut4sn1n311rl8d7h4nyt8: 2 new scrobbles from 50 tracks
⏳ Waiting 5000ms before next user...

# After all users:
🎉 Background scrobbler job completed
📊 Stats: 2 success, 5 failures, 4 new scrobbles
```

### Manual Trigger Logs
```
🎵 Manual trigger: Starting background scrobbler...
🎵 Starting background scrobbler job...
📊 Found 7 users to process
...
```

## 🛠️ Use Cases for Manual Triggers

1. **Testing**: Test scrobbler without waiting 30 minutes
2. **Debugging**: Reproduce issues with fresh data
3. **Maintenance**: Force sync after fixing bugs
4. **User Support**: Manually sync for specific users who report issues
5. **Development**: Test changes locally without waiting

## ⚙️ Configuration Options

### Background Scrobbler
```bash
# Render Environment Variables
BACKGROUND_SCROBBLE_ENABLED=true          # Enable/disable job
BACKGROUND_SCROBBLE_INTERVAL_MS=1800000   # 30 minutes (default)
BACKGROUND_SCROBBLE_USER_DELAY_MS=5000    # 5 seconds between users
```

### Archive Job
```bash
ARCHIVE_RETENTION_DAYS=90      # Keep scrobbles for 90 days
ARCHIVE_KEEP_RECENT=200        # Always keep last 200 scrobbles
ARCHIVE_DRY_RUN=false          # Set to true for testing
```

## 🚨 Troubleshooting

### Scrobbler Not Running
1. Check `BACKGROUND_SCROBBLE_ENABLED=true` in Render env
2. Check server logs for errors
3. Verify MongoDB connection is stable
4. Try manual trigger to isolate issue

### Archive Job Failures
1. Check retention settings
2. Verify MongoDB connection
3. Check if users have scrobbles older than retention period
4. Use `ARCHIVE_DRY_RUN=1` to test without deleting

### Manual Trigger Returns 401
1. Verify `ADMIN_KEY` is set in Render environment
2. Check adminKey in request matches exactly
3. Restart server after adding ADMIN_KEY

## 📝 Notes

- Jobs run **in background** (non-blocking)
- Jobs use **shared MongoDB connection** (no separate connect/disconnect)
- Jobs fail **gracefully** without crashing server
- Manual triggers **do not** affect automatic schedule
- All times in **production logs are UTC**
