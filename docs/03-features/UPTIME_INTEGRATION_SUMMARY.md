# UptimeRobot Integration Guide

## Overview

This integration adds a lightweight `/ping` endpoint to keep the Render free tier server alive by preventing the 15-minute idle timeout.

## How It Works

### The Problem
- Render free tier **spins down after 15 minutes** of inactivity
- Cold starts take **30-60 seconds** (bad user experience)
- Users experience delays when opening the app

### The Solution
- Add a simple `/ping` endpoint that returns `200 OK` with `"pong"`
- UptimeRobot pings this endpoint **every 5 minutes**
- Server stays awake 24/7 (or at least during active hours)

### Architecture
```
UptimeRobot (every 5 min) → GET https://ratesangeet.onrender.com/ping
                           ← 200 OK "pong"
                           
Server tracks:
- Total ping count (resets on restart)
- Uptime since last restart
- Logs every ping with timestamp
```

## Setup Instructions

### 1. Server Setup (Already Done ✅)

The `/ping` endpoint is already added to `server/src/index.ts`:

```typescript
app.get('/ping', (req, res) => {
  pingCount++;
  const now = new Date().toISOString();
  const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);
  
  console.log(`[PING] #${pingCount} at ${now} (uptime: ${uptimeMinutes}m)`);
  
  res.status(200).send('pong');
});
```

### 2. Local Testing

**Test locally before deploying:**

```powershell
# Start the server
cd server
npm run dev

# In another terminal, test the ping
node ping-server.js
# Should output: ✅ Ping successful!

# Or test with curl
curl http://localhost:5000/ping
# Should return: pong
```

### 3. Deploy to Render

**Push to GitHub:**
```bash
git add .
git commit -m "Add /ping endpoint for UptimeRobot monitoring"
git push origin dev
```

Render will auto-deploy. Wait for deployment to complete.

### 4. Verify Production Endpoint

```powershell
# Test the production URL
node ping-server.js https://ratesangeet.onrender.com

# Or use curl
curl https://ratesangeet.onrender.com/ping
```

### 5. Set Up UptimeRobot

#### Create Account
1. Go to https://uptimerobot.com
2. Sign up (free tier = 50 monitors, 5-min intervals)
3. Verify email

#### Add Monitor
1. Click **"Add New Monitor"**
2. Configure:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Ratesangeet API
   - **URL**: `https://ratesangeet.onrender.com/ping`
   - **Monitoring Interval**: 5 minutes (free tier)
   - **Monitor Timeout**: 30 seconds
   - **HTTP Method**: GET (default)

3. **Alert Contacts** (optional but recommended):
   - Add your email
   - Get notified if server goes down

4. Click **"Create Monitor"**

#### Verify It's Working
- Wait 5 minutes
- Check UptimeRobot dashboard
- Should show **"Up"** status with response time
- Check Render logs: should see `[PING]` entries every 5 minutes

## Endpoints Reference

### `GET /ping`
**Purpose**: Health check for uptime monitoring  
**Response**: `200 OK` with text `"pong"`  
**Use Case**: UptimeRobot monitoring  
**Logs**: Yes (every ping logged with timestamp and count)

**Example:**
```bash
curl https://ratesangeet.onrender.com/ping
# Response: pong
```

### `GET /`
**Purpose**: Human-readable server status page  
**Response**: `200 OK` with HTML dashboard  
**Shows**: Uptime, ping count, available endpoints  

**Example:**
```bash
curl https://ratesangeet.onrender.com/
# Returns HTML with server status
```

### `GET /api/health`
**Purpose**: API health check (JSON format)  
**Response**: `200 OK` with `{"status": "OK", "message": "Server is running"}`  
**Use Case**: Client app health checks  

**Example:**
```bash
curl https://ratesangeet.onrender.com/api/health
# Response: {"status":"OK","message":"Server is running"}
```

## Monitoring Best Practices

### Recommended Schedule
- **Production**: 5-minute intervals (prevents spin-down)
- **Development**: 10-minute intervals (reduce noise in logs)
- **Overnight**: Keep enabled (users in different timezones)

### Alert Setup
1. **Down Alerts**: Get notified within 5 minutes of downtime
2. **Response Time Alerts**: Alert if response > 5 seconds (indicates cold start)
3. **Uptime Reports**: Weekly summary emails

### Cost Analysis
- **UptimeRobot Free Tier**: 50 monitors, 5-min checks = FREE
- **Render Free Tier**: 750 hours/month (if you have ONE service) = FREE
- **Total Cost**: $0/month ✅

## Troubleshooting

### Ping Returns 404
```bash
# Check server logs
# Make sure /ping route is registered before /api/* routes
# Restart Render deployment
```

### Server Still Spins Down
```bash
# Check UptimeRobot is actually running (green status)
# Check interval is 5 minutes (not 10 or 15)
# Verify URL is correct: https://ratesangeet.onrender.com/ping (no /api prefix)
```

### High Response Times (>5s)
```bash
# This indicates cold starts are still happening
# Possible causes:
#   - UptimeRobot interval too long (should be 5 min)
#   - UptimeRobot monitor paused
#   - Render free tier limits hit (check dashboard)
```

### Render Logs Flooded with [PING]
```bash
# This is normal! Every 5 minutes = 288 pings/day
# Filter logs: only show non-ping requests
# In Render dashboard, search: -PING
```

## Server Logs Example

**Startup:**
```
🚀 Server running on http://0.0.0.0:5000
✅ MongoDB connected successfully
```

**UptimeRobot Pings (every 5 min):**
```
[REQ] GET /ping
[PING] #1 at 2025-11-09T10:00:00.000Z (uptime: 2m)
[REQ] GET /ping
[PING] #2 at 2025-11-09T10:05:00.000Z (uptime: 7m)
[REQ] GET /ping
[PING] #3 at 2025-11-09T10:10:00.000Z (uptime: 12m)
```

## Testing Utilities

### `ping-server.js`
Quick test script to verify /ping is working:

```powershell
# Test local server
node ping-server.js

# Test production
node ping-server.js https://ratesangeet.onrender.com
```

**Output:**
```
🏓 Pinging: https://ratesangeet.onrender.com/ping

Response:
  Status: 200 OK
  Time: 234ms
  Body: "pong"

✅ Ping successful! Server is responding correctly.
```

### `generate-uptime-key.js`
Generate a secure key for future authenticated endpoints:

```powershell
node generate-uptime-key.js
```

**Note**: Not needed for the simple `/ping` endpoint, but useful if you add webhook callbacks later.

## Alternative Monitoring Services

If you don't want to use UptimeRobot, these alternatives also work:

### 1. **Betterstack (formerly Better Uptime)**
- Free tier: 10 monitors, 3-min intervals
- URL: https://betterstack.com

### 2. **Cronitor**
- Free tier: 5 monitors, 60-second intervals
- URL: https://cronitor.io

### 3. **Pingdom** (Paid)
- 1-minute intervals
- More advanced monitoring
- URL: https://pingdom.com

### 4. **GitHub Actions** (DIY)
Create a scheduled workflow:

```yaml
# .github/workflows/keep-alive.yml
name: Keep Server Alive
on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://ratesangeet.onrender.com/ping
```

⚠️ **Warning**: GitHub Actions has usage limits. UptimeRobot is more reliable.

## Production Checklist

- [ ] `/ping` endpoint deployed to Render
- [ ] Test production URL returns "pong"
- [ ] UptimeRobot account created
- [ ] Monitor added with 5-minute interval
- [ ] Alert email configured
- [ ] Verify first ping in Render logs
- [ ] Wait 20 minutes, confirm no spin-down
- [ ] Check UptimeRobot dashboard shows "Up" status

## Future Enhancements (Optional)

### 1. Status Page
Add a `/status` endpoint that returns uptime stats:

```typescript
app.get('/status', (req, res) => {
  res.json({
    status: 'up',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    pingCount,
    lastPing: lastPingTime,
    version: process.env.npm_package_version,
  });
});
```

### 2. Webhook Alerts
Receive UptimeRobot alerts via webhook:

```typescript
app.post('/webhook/uptime', (req, res) => {
  const { monitorFriendlyName, alertType } = req.body;
  console.log(`⚠️  Alert: ${monitorFriendlyName} is ${alertType}`);
  // Send to Slack, Discord, etc.
  res.sendStatus(200);
});
```

### 3. Metrics Dashboard
Create a React Native screen to show uptime stats from UptimeRobot API.

## Security Notes

### Why No Authentication?
- `/ping` is **read-only** (no state changes)
- No sensitive data exposed
- Public endpoints are fine for health checks
- UptimeRobot IPs are publicly known anyway

### When to Add Auth?
Add authentication if you:
- Return sensitive server metrics
- Allow state changes via ping
- Add admin endpoints
- Process webhook callbacks with actions

### How to Add Auth?
```typescript
app.get('/ping', (req, res) => {
  const key = req.query.key || req.headers['x-uptime-key'];
  if (key !== process.env.UPTIME_SECRET_KEY) {
    return res.status(401).send('Unauthorized');
  }
  res.send('pong');
});
```

## Summary

✅ **Simple**: One endpoint, one response  
✅ **Lightweight**: No database queries, instant response  
✅ **Reliable**: UptimeRobot has 99.9% uptime  
✅ **Free**: Zero cost with free tiers  
✅ **Effective**: Prevents Render spin-down completely  

**Result**: Your app stays fast and responsive 24/7! 🚀
