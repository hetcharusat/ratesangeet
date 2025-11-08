# Spotify OAuth Setup Guide

## 🎯 Quick Setup

### 1. Add Redirect URIs to Spotify Dashboard

Go to: [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

1. Select your app
2. Click **Edit Settings**
3. Scroll to **Redirect URIs**
4. Add these **exact** URIs:

```
http://127.0.0.1:8081
ratesangeet://callback
```

⚠️ **Important**: Spotify requires `127.0.0.1` (explicit IPv4 loopback), NOT `localhost`

5. Click **Add** after each one
6. Click **Save** at the bottom

### 2. Test the Login

**For Web Development:**
- Visit `http://127.0.0.1:8081` in your browser (**must use 127.0.0.1, not localhost**)
- Click "Continue with Spotify"
- You'll be redirected to Spotify for authorization
- After approval, you'll be redirected back to the app

**For Mobile:**
- Run the app on your device or emulator
- Click "Continue with Spotify"
- Uses the `ratesangeet://callback` deep link

## 📋 Current Configuration

- **Client ID**: Set in `mobile/src/config/index.ts`
- **Web Redirect**: `http://127.0.0.1:8081` (explicit IPv4 loopback - Spotify requirement)
- **Native Redirect**: `ratesangeet://callback`
- **Auth Flow**: Authorization Code with PKCE (no client secret needed on client)

## ⚠️ Important Notes

1. **Spotify requires `127.0.0.1`** - NOT `localhost` (explicit IPv4/IPv6 loopback only)
2. **No HTTPS required** for loopback addresses during development
3. **Expo auth.expo.io proxy is deprecated** - we're using direct redirects
4. For **production web**, you'll need to:
   - Deploy to a domain with HTTPS
   - Add that HTTPS URL to Spotify Dashboard
   - Update the redirect URI logic in LoginScreen.tsx

## 🔧 Troubleshooting

**"INVALID_CLIENT" error:**
- Make sure redirect URIs in Spotify Dashboard match exactly
- No trailing slashes
- Check capitalization

**"Redirect URI mismatch" error:**
- The URI shown in console must match what's in Spotify Dashboard
- Check the console log: `🔗 Redirect URI: ...`

**Web login not working:**
- Access app at `http://127.0.0.1:8081` (**must use 127.0.0.1, NOT localhost**)
- Make sure `http://127.0.0.1:8081` is in Spotify Dashboard

**Mobile deep link not working:**
- Make sure `ratesangeet://callback` is in Spotify Dashboard
- Check that app.json has the correct scheme configured
- Rebuild the app after changing app.json

## 🚀 Production Deployment

When deploying to production:

1. **Web**: Deploy to Vercel/Netlify with HTTPS
2. Add production URL to Spotify Dashboard (e.g., `https://yourapp.com`)
3. Update LoginScreen.tsx to use production URL when not in dev mode
4. **Mobile**: Build native apps with EAS Build (already configured)
