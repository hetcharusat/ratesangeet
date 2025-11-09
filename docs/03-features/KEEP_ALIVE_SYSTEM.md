# Keep-Alive System for Render Free Tier

## Problem: Render Free Tier Spin-Down

Render's free tier automatically spins down your service after **15 minutes of inactivity**. When a request comes in, it takes **30-60 seconds** to spin back up, causing poor user experience.

## Solution: Multi-Layer Keep-Alive Strategy

We use **3 complementary systems** to keep the server running 24/7:

### 1. ✅ GitHub Actions (Primary)
**File**: `.github/workflows/keep-alive.yml`

**How it works**:
- Runs every **5 minutes** via GitHub Actions cron
- Pings `https://ratesangeet.onrender.com/ping`
- Expects `200 OK` + "pong" response
- Free (GitHub Actions provides 2,000 minutes/month for free repos)

**Why 5 minutes?**
- Render spins down after **15 minutes** of inactivity
- Pinging every **5 minutes** = 3 pings per spin-down window
- Provides safety margin in case one ping fails

**Status**: ✅ Active (see `.github/workflows/keep-alive.yml`)

### 2. ✅ UptimeRobot Monitoring (Backup)
**Monitors**:
- Backend (Render): `m801757949-28611e67f3ccec3b8579fcdb`
- Frontend (Vercel): `m801757971-4ce2c38569b98bd14f832e86`

**How it works**:
- Pings every **5 minutes** (configurable)
- Monitors `https://ratesangeet.onrender.com/ping`
- Public dashboard: https://stats.uptimerobot.com/OyUXm4nc9m
- Free tier: 50 monitors, 5-minute intervals

**Benefits**:
- Acts as backup if GitHub Actions fails
- Provides public status page
- Email alerts on downtime
- 7-day/30-day uptime statistics

**Status**: ✅ Active (see README badges)

### 3. ✅ Server Self-Ping (Last Resort)
**File**: `server/src/index.ts`

**Code**:
```typescript
// Keep-alive ping counter
let pingCount = 0;
const startTime = Date.now();

app.get('/ping', (req, res) => {
  pingCount++;
  const now = new Date().toISOString();
  const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);
  console.log(`[PING] #${pingCount} at ${now} (uptime: ${uptimeMinutes}m)`);
  res.status(200).send('pong');
});
```

**Why this works**:
- Extremely lightweight (just returns "pong")
- Logs each ping for debugging
- Tracks server uptime and ping count
- No database queries = fast response

## Architecture Diagram

```
┌─────────────────┐     Every 5 min      ┌──────────────┐
│ GitHub Actions  │ ──────────────────►  │              │
│   (Primary)     │     GET /ping        │    Render    │
└─────────────────┘                      │   (Free)     │
                                         │              │
┌─────────────────┐     Every 5 min      │  spotirate   │
│  UptimeRobot    │ ──────────────────►  │    API       │
│   (Backup)      │     GET /ping        │              │
└─────────────────┘                      └──────────────┘
                                              │
                                              │ Response
                                              ▼
                                         "pong" (200 OK)
```

## Setup Instructions

### 1. GitHub Actions Setup (Already Done ✅)
No additional setup needed! The workflow is already configured and will run automatically.

**To manually trigger** (for testing):
1. Go to: https://github.com/hetcharusat/ratesangeet/actions
2. Click "Keep Render Server Alive"
3. Click "Run workflow" → "Run workflow"

### 2. UptimeRobot Setup

**Backend Monitor (Render)**:
1. Go to: https://uptimerobot.com/dashboard
2. Add New Monitor:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: **RateSangeet API (Render)**
   - URL: `https://ratesangeet.onrender.com/ping`
   - Monitoring Interval: **5 minutes**
   - Alert Contacts: (your email)
3. Save monitor ID: `m801757949-28611e67f3ccec3b8579fcdb` ✅

**Frontend Monitor (Vercel)** - Optional:
1. Add New Monitor:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: **RateSangeet Web (Vercel)**
   - URL: `https://your-vercel-url.vercel.app`
   - Monitoring Interval: **5 minutes**
2. Save monitor ID: `m801757971-4ce2c38569b98bd14f832e86` ✅

### 3. Verify Keep-Alive is Working

**Method 1: Check GitHub Actions**
```bash
# View workflow status
# https://github.com/hetcharusat/ratesangeet/actions/workflows/keep-alive.yml
```

**Method 2: Check UptimeRobot Dashboard**
```bash
# Public status page
# https://stats.uptimerobot.com/OyUXm4nc9m
```

**Method 3: Check Render Logs**
```bash
# Render Dashboard → spotirate-api → Logs
# Should see: [PING] #123 at 2025-11-09T12:34:56.789Z (uptime: 456m)
```

**Method 4: Manual Test**
```powershell
# Test from local machine
curl https://ratesangeet.onrender.com/ping
# Should return: pong
```

## Monitoring & Alerts

### What to Monitor:
- ✅ GitHub Actions workflow success rate
- ✅ UptimeRobot 7-day uptime percentage
- ✅ Render server response time
- ✅ Ping count in server logs

### Alert Thresholds:
- 🚨 **Critical**: Server down for > 10 minutes
- ⚠️ **Warning**: 2+ failed pings in a row
- 📊 **Info**: Uptime < 99% over 7 days

### Common Issues:

**Issue 1: GitHub Actions fails with 404**
- **Cause**: Render server spun down before workflow ran
- **Fix**: UptimeRobot backup will wake it up

**Issue 2: Render shows "Sleeping"**
- **Cause**: All keep-alive systems failed
- **Fix**: Manual wake-up via `/ping` endpoint

**Issue 3: High response time (>1s)**
- **Cause**: Server cold start (waking from sleep)
- **Fix**: Increase ping frequency or upgrade Render plan

## Cost Analysis

| Service | Free Tier | Usage | Cost |
|---------|-----------|-------|------|
| **GitHub Actions** | 2,000 min/month | ~150 min/month | $0 |
| **UptimeRobot** | 50 monitors | 2 monitors | $0 |
| **Render** | 750 hours/month | 720 hours/month | $0 |
| **Total** | - | - | **$0/month** |

**Calculation**:
- GitHub Actions: 5-min interval × 12 pings/hour × 24 hours × 30 days = 8,640 pings/month
- Each workflow run: ~1 minute
- 8,640 pings ÷ 60 min = **144 minutes/month** (well under 2,000 limit)

## Upgrade Path (If Needed)

If free tier limits become insufficient:

1. **Render Starter Plan** ($7/month)
   - No spin-down (always-on)
   - Eliminates need for keep-alive
   - Faster cold starts

2. **UptimeRobot Pro** ($7/month)
   - 1-minute intervals (instead of 5)
   - SMS alerts
   - 50+ monitors

3. **GitHub Actions** (stay free)
   - 2,000 minutes enough for most use cases

## Best Practices

✅ **Do**:
- Keep `/ping` endpoint simple (no DB queries)
- Monitor both workflow and UptimeRobot
- Set up email alerts for downtime
- Check logs weekly for anomalies

❌ **Don't**:
- Add auth to `/ping` (keep it public for monitors)
- Query database in ping handler (slows response)
- Reduce ping frequency below 5 minutes (GitHub Actions rate limits)
- Forget to update monitor IDs in README badges

## Troubleshooting

### Server Still Spinning Down?

1. **Check GitHub Actions**:
   ```bash
   # Go to: https://github.com/hetcharusat/ratesangeet/actions
   # Verify "Keep Render Server Alive" is running every 5 minutes
   ```

2. **Check UptimeRobot**:
   ```bash
   # Go to: https://uptimerobot.com/dashboard
   # Verify monitor is active and pinging every 5 minutes
   ```

3. **Check Render Logs**:
   ```bash
   # Render Dashboard → Logs
   # Look for: [PING] messages every 5 minutes
   ```

4. **Manual Test**:
   ```powershell
   # If server is sleeping, first request will wake it (30-60s)
   curl https://ratesangeet.onrender.com/ping
   
   # Wait 1 minute, test again (should be instant)
   curl https://ratesangeet.onrender.com/ping
   ```

### GitHub Actions Failing?

**Error**: "Process completed with exit code 1"

**Possible Causes**:
1. Server returned non-200 status
2. Response body wasn't "pong"
3. Network timeout

**Fix**:
1. Check workflow logs for exact error
2. Test endpoint manually: `curl https://ratesangeet.onrender.com/ping`
3. Verify server is running in Render dashboard
4. Check server logs for errors

## Status & Health Check

Current system status:

- ✅ GitHub Actions: Active (5-min interval)
- ✅ UptimeRobot Backend: Active (Monitor ID: `m801757949-28611e67f3ccec3b8579fcdb`)
- ✅ UptimeRobot Frontend: Active (Monitor ID: `m801757971-4ce2c38569b98bd14f832e86`)
- ✅ Render Server: `/ping` endpoint live
- ✅ Public Dashboard: https://stats.uptimerobot.com/OyUXm4nc9m

**Last Updated**: November 9, 2025
