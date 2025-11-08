# Vercel Web Deployment Guide

## Why Vercel?
- ✅ **Free tier**: Unlimited deployments
- ✅ **Auto-deploy** from GitHub
- ✅ **Global CDN** for fast loading
- ✅ **Free SSL** and custom domains
- ✅ **Perfect for Expo web** static exports

---

## Architecture
- **Backend (API)**: https://ratesangeet.onrender.com (Render.com)
- **Frontend (Web)**: https://ratesangeet.vercel.app (Vercel)
- **Mobile (APK)**: Native app with same backend

---

## Step 1: Install Vercel CLI (Optional)
```powershell
npm i -g vercel
```

Or use the web dashboard (recommended for first deploy).

---

## Step 2: Deploy via Vercel Dashboard

### 2.1 Create Vercel Account
1. Go to https://vercel.com/
2. Sign up with GitHub (same account as your repo)
3. Authorize Vercel to access repositories

### 2.2 Import Project
1. Click "Add New..." → "Project"
2. Import your GitHub repo: `hetcharusat/ratesangeet`
3. Vercel will auto-detect the `vercel.json` config

### 2.3 Configure Project
Vercel should auto-fill from `vercel.json`, but verify:

**Framework Preset**: Other (or leave as detected)

**Build Command**:
```
cd mobile && npm install && npx expo export -p web
```

**Output Directory**:
```
mobile/dist
```

**Install Command**:
```
cd mobile && npm install
```

**Root Directory**: Leave empty

### 2.4 Environment Variables
Click "Environment Variables" and add:

```
EXPO_PUBLIC_API_URL=https://ratesangeet.onrender.com/api
```

This tells the web app to connect to your Render backend.

### 2.5 Deploy
1. Click "Deploy"
2. Wait 2-3 minutes for build
3. Get your live URL: `https://ratesangeet.vercel.app`

---

## Step 3: Update Spotify Redirect (Web Only)

Since web uses the Render backend for OAuth, the redirect is already set:
- `https://ratesangeet.onrender.com/api/auth/callback`

No changes needed in Spotify dashboard!

---

## Step 4: Test Your Web App

Open your Vercel URL:
```
https://ratesangeet.vercel.app
```

Try logging in with Spotify. The flow:
1. Click "Login with Spotify" on web
2. Redirects to Spotify auth
3. After approval, redirects back to your app
4. App connects to `https://ratesangeet.onrender.com/api` for data

---

## Step 5: Auto-Deploy on Push

Vercel automatically redeploys when you push to `dev` branch:
```powershell
git add .
git commit -m "update web app"
git push origin dev
```

Vercel detects the push and rebuilds (~2 min).

---

## Local Development

Test web locally before deploying:
```powershell
cd mobile
npm run web
```

Access at `http://localhost:8081`

---

## Deploy from CLI (Alternative)

If you installed Vercel CLI:
```powershell
cd C:\Users\hetp2\OneDrive\Desktop\spotiireate
vercel
```

Follow prompts:
- Link to existing project (or create new)
- Confirm settings from `vercel.json`
- Deploy!

---

## Troubleshooting

### Build Fails
- Check logs in Vercel dashboard
- Verify `mobile/package.json` has all dependencies
- Ensure Expo SDK version is compatible

### White Screen / Blank Page
- Check browser console for errors
- Verify `EXPO_PUBLIC_API_URL` is set correctly
- Test backend: `curl https://ratesangeet.onrender.com/api/health`

### API Calls Fail
- Verify CORS is enabled on Render backend (already set in your code)
- Check Network tab in browser DevTools
- Ensure Render service is awake (free tier sleeps after 15 min)

### OAuth Redirect Issues
- Web OAuth uses Render backend redirect: `https://ratesangeet.onrender.com/api/auth/callback`
- Ensure this URI is in Spotify dashboard
- Check Render logs for auth errors

---

## Production Checklist

- ✅ Backend deployed: https://ratesangeet.onrender.com
- ✅ Frontend deployed: https://ratesangeet.vercel.app
- ✅ MongoDB Atlas connected
- ✅ Spotify redirect URIs added:
  - `ratesangeet://callback` (mobile)
  - `https://ratesangeet.onrender.com/api/auth/callback` (web/mobile)
- ✅ Environment variable set: `EXPO_PUBLIC_API_URL`

---

## Custom Domain (Optional)

Free on Vercel:
1. Dashboard → Project → Settings → Domains
2. Add your domain (e.g., `ratesangeet.com`)
3. Update DNS records as instructed
4. SSL auto-provisions

---

## Next Steps

1. ✅ Deploy web to Vercel
2. ✅ Test login and features
3. ✅ Build APK: `eas build --platform android --profile preview`
4. ✅ Share web URL and APK with testers

---

**Cost:** Completely free for personal projects!
