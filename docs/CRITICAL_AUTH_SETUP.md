# 🚀 CRITICAL: Spotify OAuth Setup Checklist

> **MUST DO BEFORE TESTING**

---

## ⚠️ SPOTIFY REDIRECT URI REQUIREMENTS (Official Docs)

**From Spotify Documentation:**
> **`localhost` is NOT allowed as redirect URI.**
> 
> For local development with loopback addresses, use **explicit IPv4 or IPv6**:
> - ✅ CORRECT: `http://127.0.0.1:PORT`
> - ✅ CORRECT: `http://[::1]:PORT` (IPv6)
> - ❌ WRONG: `http://localhost:PORT` (forbidden by Spotify)

**Source:** https://developer.spotify.com/documentation/web-api/concepts/redirect_uri

---

## Step 1: Add Redirect URIs to Spotify Dashboard

1. **Go to**: https://developer.spotify.com/dashboard
2. **Login** with your Spotify account
3. **Select your app**: "Ratesangeet" (Client ID: `30d78a30cd9f435eba6edbaa4a427041`)
4. **Click**: "Edit Settings"
5. **Scroll to**: "Redirect URIs"
6. **Add these EXACT URIs** (one per line):

### Development URIs (Required for testing):
```
http://127.0.0.1:8081
```

**⚠️ IMPORTANT FOR WEB**: 
- Spotify **REQUIRES** `127.0.0.1` (explicit IPv4), NOT `localhost`
- You MUST access the app via `http://127.0.0.1:8081`
- **DO NOT use `http://localhost:8081`** - Spotify will reject it!
- **DO NOT use `http://192.168.x.x:8081`** - WebCrypto API won't work + Spotify will reject

### Mobile Deep Link URI:
```
ratesangeet://callback
```

### Production URIs (Add these too):
```
https://ratesangeet.onrender.com/api/auth/callback
```

7. **Click**: "Save" (bottom of the modal)
8. **Verify**: All URIs appear in the list

---

## Step 2: Test Web Login

### Access via 127.0.0.1 (REQUIRED!)

1. **Start Expo**:
   ```powershell
   cd mobile
   npm run start
   ```

2. **Open in your browser** (on same computer):
   ```
   http://127.0.0.1:8081
   ```
   
   **⚠️ MUST use `127.0.0.1`** - Spotify requires explicit IPv4 loopback address!

3. **Click**: "Login with Spotify"

4. **You should see**: Spotify authorization page asking for permissions

5. **Click**: "Agree" on Spotify

6. **You should**: Be redirected back to `http://localhost:8081` and logged in

### Expected Console Logs:
```
🔗 Using redirect URI: http://localhost:8081
🔑 Redirecting to Spotify...
(after approval)
🔑 Exchanging code with server...
✅ Server auth successful
✅ Auth stored, user logged in
```

---

## Step 3: Test Mobile Login

1. **Start Expo**: Should already be running
   ```powershell
   cd mobile
   npx expo start --lan
   ```

2. **Scan QR code** with Expo Go app (Android) or Camera app (iOS)

3. **App loads** → Tap "Login with Spotify"

4. **System browser opens** with Spotify auth page

5. **Click "Agree"** on Spotify

6. **Should return** to app and complete login

### Expected Console Logs:
```
🔗 Using redirect URI: ratesangeet://callback
🔑 Opening Spotify auth...
✅ Got authorization code
✅ Server auth successful
✅ Auth stored, user logged in
```

---

## Troubleshooting

### ❌ "INVALID_CLIENT: Invalid redirect URI"
- **Cause**: Redirect URI not in Spotify Dashboard
- **Fix**: Add the exact URI (including port!) to Dashboard
- **Check**: Make sure you clicked "Save" in Spotify Dashboard

### ❌ "Code verifier missing from session"
- **Cause**: sessionStorage was cleared
- **Fix**: This shouldn't happen with the new code. If it does, clear browser cache and try again

### ❌ "Cannot connect to server"
- **Cause**: Server not running OR wrong API_URL
- **Fix**: 
  ```powershell
  cd server
  npm run dev
  ```
- **Verify**: Server logs show `🚀 Server running on http://192.168.42.205:5000`

### ❌ Web login opens `localhost:8081` instead of LAN IP
- **This is CORRECT!** Web MUST use localhost for WebCrypto API
- **LAN IP is ONLY for mobile devices** accessing the Metro bundler
- **Desktop browser testing**: Use `http://localhost:8081`
- **Phone browser testing**: Not supported (use mobile app via Expo Go)

### ❌ "Access to WebCrypto API is restricted to secure origins"
- **Cause**: Accessing via `http://192.168.x.x:8081` (non-secure origin)
- **Fix**: Use `http://localhost:8081` or `http://127.0.0.1:8081`
- **Why**: Browser security requires localhost or HTTPS for crypto operations

### ❌ Mobile deep link doesn't work
- **Cause**: Deep link not registered OR Expo Go cache
- **Fix**: 
  1. Kill Expo Go app completely
  2. Restart: `npx expo start --lan --clear`
  3. Scan QR code again

---

## What Changed?

### Before (Broken):
```typescript
// ❌ Used localhost on web (doesn't work from phone)
redirectUri: window.location.origin // "http://localhost:8081"

// ❌ No PKCE implementation (server did everything)
window.location.href = serverAuthUrl
```

### After (Fixed):
```typescript
// ✅ Uses localhost for web (WebCrypto requires secure origin)
const redirectUri = Platform.OS === 'web' 
  ? 'http://localhost:8081'  // Secure origin for crypto
  : 'ratesangeet://callback'; // Mobile custom scheme

// ✅ Client generates PKCE using native browser crypto API
const codeVerifier = await generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// ✅ Uses window.crypto.subtle (native API, no expo-crypto on web)
const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
```

---

## Security Improvements

- ✅ **PKCE prevents authorization code interception**
- ✅ **Code verifier never sent to Spotify auth endpoint**
- ✅ **State parameter prevents CSRF attacks**
- ✅ **sessionStorage auto-cleared after exchange**
- ✅ **Server validates all tokens before storing**
- ✅ **Native browser crypto API** (no third-party crypto libs on web)
- ✅ **Localhost-only for web dev** (browser security compliance)

---

## Files Changed

1. **mobile/src/screens/LoginScreen.tsx**
   - Added PKCE helper functions
   - **Platform-aware crypto**: Native browser API on web, expo-crypto on mobile
   - Platform-aware redirect URI generation (localhost for web, custom scheme for mobile)
   - expo-auth-session integration for mobile
   - Snackbar error handling
   - sessionStorage management for web

2. **docs/05-authentication/PKCE_AUTH_IMPLEMENTATION.md**
   - Complete PKCE documentation
   - Flow diagrams
   - Troubleshooting guide
   - Security notes

---

## Next Steps After Testing

Once login works:

1. ✅ Test token refresh (`/auth/pkce-refresh`)
2. ✅ Test logout flow
3. ✅ Test with expired tokens
4. ✅ Deploy to production (Render auto-deploys from `dev` branch)
5. ✅ Update production redirect URIs if domain changes

---

## Quick Reference

| Environment | Server | Web | Mobile |
|-------------|--------|-----|--------|
| **Dev** | `http://192.168.42.205:5000` | **`http://localhost:8081`** | `ratesangeet://callback` |
| **Prod** | `https://ratesangeet.onrender.com` | `https://ratesangeet.onrender.com` | `https://.../callback/mobile` |

| Spotify Scope | Why Needed |
|---------------|------------|
| `user-read-private` | Get user profile (display name, etc.) |
| `user-read-email` | Get user email for account |
| `user-read-recently-played` | Track listening history |
| `user-top-read` | Get top tracks/artists |
| `user-read-currently-playing` | Show what's playing now |
| `user-read-playback-state` | Get playback position |

---

**Done! 🎉 Now add the URIs to Spotify Dashboard and test the login flow.**
