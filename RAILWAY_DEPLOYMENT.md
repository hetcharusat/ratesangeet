# Railway Deployment Guide for Beta Testing

## Step 1: Create Railway Account
1. Go to https://railway.app/
2. Sign up with GitHub (use the same account where you pushed the repo)
3. Verify your email

## Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Authorize Railway to access your GitHub
4. Select your `spotiireate` repository

## Step 3: Add MongoDB Database
1. In your Railway project, click "New"
2. Select "Database" → "Add MongoDB"
3. Railway will automatically create a MongoDB instance
4. Copy the `MONGO_URL` connection string (you'll need this)

## Step 4: Configure Environment Variables
Click on your service → "Variables" tab → Add these:

```
NODE_ENV=production
PORT=3000
MONGODB_URI=${{MongoDB.MONGO_URL}}
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>
SPOTIFY_REDIRECT_URI=https://your-app.railway.app/auth/callback
SESSION_SECRET=<generate_random_32_char_string>
CLOUD_ENABLE_SCROBBLES=false
ARCHIVE_RETENTION_DAYS=90
ARCHIVE_KEEP_RECENT=200
```

**Important:** 
- Replace `<your_spotify_client_id>` and `<your_spotify_client_secret>` with your actual Spotify app credentials
- For `SESSION_SECRET`, use a random string (run in terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- The `MONGODB_URI` will auto-fill from your MongoDB service

## Step 5: Deploy
1. Railway will auto-deploy when you push to GitHub
2. Wait for build to complete (5-10 minutes first time)
3. Click "Settings" → "Generate Domain" to get your public URL
4. Copy your deployment URL (e.g., `https://spotiireate-production.up.railway.app`)

## Step 6: Update Spotify App Settings
1. Go to https://developer.spotify.com/dashboard
2. Edit your Spotify app
3. Add Redirect URI: `https://your-railway-url.railway.app/auth/callback`
4. Save changes

## Step 7: Update Mobile App Configuration
Update `mobile/src/config/index.ts` with your Railway URL:
```typescript
export const API_BASE_URL = 'https://your-railway-url.railway.app';
```

## Step 8: Test Your Deployment
1. Visit your Railway URL in browser
2. You should see your API responding
3. Test the `/health` endpoint: `https://your-railway-url.railway.app/health`

## Step 9: Build APK
After backend is live, build your APK:
```bash
cd mobile
eas build --platform android --profile preview
```

## Troubleshooting
- **Build fails**: Check logs in Railway dashboard
- **MongoDB connection error**: Verify `MONGODB_URI` is set correctly
- **Spotify auth fails**: Double-check redirect URI matches exactly
- **Port issues**: Railway auto-assigns PORT, make sure your server uses `process.env.PORT`

## Next Steps
1. ✅ Deploy backend to Railway
2. ✅ Get your public URL
3. ✅ Update mobile app config
4. ✅ Build APK with EAS
5. ✅ Share APK with beta testers

---

**Cost:** Railway offers 500 hours/month free ($5 credit), perfect for beta testing!
