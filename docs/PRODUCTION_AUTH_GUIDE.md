# 🚀 Production-Ready OAuth Authentication Guide

## ✅ System Status: PRODUCTION READY

This guide documents the **complete, production-ready OAuth 2.0 PKCE authentication system** for Ratesangeet, built per **Spotify Official Documentation**.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Redirect URI Requirements](#redirect-uri-requirements)
3. [PKCE Flow Implementation](#pkce-flow-implementation)
4. [Platform-Specific Setup](#platform-specific-setup)
5. [Spotify Dashboard Configuration](#spotify-dashboard-configuration)
6. [Testing Checklist](#testing-checklist)
7. [Troubleshooting](#troubleshooting)
8. [Production Deployment](#production-deployment)

---

## 🏗️ System Architecture

### Authentication Flow (PKCE - Authorization Code + Proof Key for Code Exchange)

```
┌─────────┐                                    ┌──────────┐
│  Client │                                    │  Spotify │
│ (Web/   │                                    │  OAuth   │
│ Mobile) │                                    │  Server  │
└────┬────┘                                    └─────┬────┘
     │                                                │
     │ 1. Generate code_verifier (32 bytes random)   │
     │    & code_challenge (SHA256 hash)             │
     │                                                │
     │ 2. Redirect to Spotify with challenge         │
     ├───────────────────────────────────────────────>│
     │    /authorize?code_challenge=...               │
     │                                                │
     │ 3. User approves app                           │
     │                                                │
     │ 4. Redirect back with authorization code       │
     │<───────────────────────────────────────────────┤
     │    ?code=ABC123...                             │
     │                                                │
     │ 5. POST /api/auth/callback                     │
     │    { code, codeVerifier, redirectUri }         │
     ├──────────────────────────┐                     │
     │                          │                     │
     │                    ┌─────▼─────┐               │
     │                    │   Ratesangeet│            │
     │                    │   Server    │             │
     │                    └─────┬─────┘               │
     │                          │                     │
     │                          │ 6. Exchange code    │
     │                          │    with Spotify     │
     │                          │    (send verifier)  │
     │                          ├────────────────────>│
     │                          │                     │
     │                          │ 7. Return tokens    │
     │                          │<────────────────────┤
     │                          │                     │
     │ 8. Return tokens + user  │                     │
     │<─────────────────────────┤                     │
     │                                                │
     └────────────────────────────────────────────────┘
```

### Key Components

- **Client (Web)**: React Native + Expo Web → Runs in browser
- **Client (Mobile)**: React Native + Expo (iOS/Android native)
- **Server**: Node.js + Express → Token exchange proxy
- **Spotify OAuth**: Authorization server

---

## 🔐 Redirect URI Requirements

### ⚠️ CRITICAL: Spotify's Official Rules

Per [Spotify Official Docs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri):

> **"`localhost` is NOT allowed as redirect URI."**
>
> If you are using a loopback address, use the **explicit IPv4 or IPv6**, like:
> - ✅ `http://127.0.0.1:PORT`
> - ✅ `http://[::1]:PORT` (IPv6)
> - ❌ `http://localhost:PORT` (FORBIDDEN)

### Why This Matters

1. **Browser Security**: `127.0.0.1` is still a "secure origin" for WebCrypto API
2. **Spotify Validation**: Spotify rejects `localhost` but accepts `127.0.0.1`
3. **Exact Match**: Redirect URI must match EXACTLY (protocol, host, port, path)

---

## 🔑 PKCE Flow Implementation

### Client-Side (Web)

**Location**: `mobile/src/screens/LoginScreen.tsx`

#### 1. Generate Code Verifier (32 bytes)

```typescript
const generateCodeVerifier = async (): Promise<string> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto) {
    // Native browser crypto API
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return base64URLEncode(array.buffer);
  } else {
    // expo-crypto for mobile
    const randomBytes = Crypto.getRandomBytes(32);
    return base64URLEncode(randomBytes);
  }
};
```

#### 2. Generate Code Challenge (SHA256 hash)

```typescript
const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto?.subtle) {
    // Native SubtleCrypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(hashBuffer);
  } else {
    // expo-crypto for mobile
    const hashed = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier
    );
    return base64URLEncode(hashed);
  }
};
```

#### 3. Base64URL Encoding (No padding, URL-safe)

```typescript
const base64URLEncode = (input: string | ArrayBuffer): string => {
  let base64: string;
  
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
};
```

#### 4. Store Verifier (localStorage per Spotify docs)

```typescript
// BEFORE redirecting to Spotify
localStorage.setItem('spotify_code_verifier', codeVerifier);
localStorage.setItem('spotify_redirect_uri', redirectUri);
localStorage.setItem('spotify_state', state);
```

#### 5. Redirect to Spotify

```typescript
const params = new URLSearchParams({
  client_id: config.SPOTIFY_CLIENT_ID,
  response_type: 'code',
  redirect_uri: 'http://127.0.0.1:8081', // ✅ Explicit IPv4
  code_challenge_method: 'S256',
  code_challenge: codeChallenge,
  state,
  scope: 'user-read-private user-read-email...',
});

window.location.href = `https://accounts.spotify.com/authorize?${params}`;
```

#### 6. Handle Callback & Exchange Code

```typescript
// AFTER Spotify redirects back to http://127.0.0.1:8081?code=...
const code = urlParams.get('code');
const codeVerifier = localStorage.getItem('spotify_code_verifier');

const response = await fetch(`${config.API_URL}/auth/callback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code,
    redirectUri: 'http://127.0.0.1:8081', // MUST match original
    codeVerifier,
    target: 'web',
  }),
});

const { accessToken, refreshToken, user } = await response.json();

// Clean up
localStorage.removeItem('spotify_code_verifier');
localStorage.removeItem('spotify_redirect_uri');
localStorage.removeItem('spotify_state');
```

### Server-Side (Token Exchange)

**Location**: `server/src/routes/auth.ts`

```typescript
router.post('/callback', async (req, res) => {
  const { code, redirectUri, codeVerifier, target } = req.body;

  // Exchange code + verifier for tokens
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri, // MUST match original
    client_id: process.env.SPOTIFY_CLIENT_ID,
    code_verifier: codeVerifier, // PKCE proof
  });

  const tokenResponse = await axios.post(
    'https://accounts.spotify.com/api/token',
    tokenParams,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const { access_token, refresh_token } = tokenResponse.data;

  // Get user profile & save to DB
  // ... (user creation/update logic)

  return res.json({
    success: true,
    data: { accessToken: access_token, refreshToken: refresh_token, user },
  });
});
```

---

## 📱 Platform-Specific Setup

### Web (Expo Dev Server)

**Access via**: `http://127.0.0.1:8081` ✅

**Why NOT `localhost`?**
- Spotify forbids `localhost` in redirect URIs
- `127.0.0.1` is equivalent for browser security (WebCrypto API works)

**Start Command**:
```powershell
cd mobile
npm run start
# Open: http://127.0.0.1:8081
```

**Config**: `mobile/src/config/index.ts`
```typescript
if (Platform.OS === 'web') {
  return 'http://127.0.0.1:5000/api'; // Local server
}
```

### Mobile (iOS/Android)

**Redirect URI**: `ratesangeet://callback` (custom scheme)

**Flow**: Same PKCE, but uses `expo-auth-session` for native OAuth

**Deep Link Setup**:
- `app.json`: `"scheme": "ratesangeet"`
- `android/app/src/main/AndroidManifest.xml`: Intent filters
- iOS: Universal Links (future)

---

## 🎛️ Spotify Dashboard Configuration

### Required Redirect URIs (Add ALL of these)

Go to: https://developer.spotify.com/dashboard
- Select "Ratesangeet" app (Client ID: `30d78a30cd9f435eba6edbaa4a427041`)
- Click "Edit Settings"
- Add these **EXACT** URIs:

#### Development (Local)

```
http://127.0.0.1:8081
```
✅ For local web development (Expo dev server)

```
http://127.0.0.1:5000/api/auth/callback
```
✅ For local server testing (optional)

#### Mobile

```
ratesangeet://callback
```
✅ For mobile deep linking (iOS + Android)

#### Production (Render)

```
https://ratesangeet.onrender.com/api/auth/callback
```
✅ For production web + mobile server exchange

### Screenshot Guide

1. **Dashboard Home**:
   - Find "Ratesangeet" app
   - Note Client ID: `30d78a30cd9f435eba6edbaa4a427041`

2. **Edit Settings**:
   - Click "Edit Settings" button (top right)

3. **Redirect URIs Section**:
   - Scroll to "Redirect URIs"
   - Click "+ Add" for each URI
   - Paste exact URI (case-sensitive, no trailing slash)
   - Click "Add"

4. **Save**:
   - Scroll to bottom
   - Click "Save" button
   - Verify all URIs appear in list

---

## ✅ Testing Checklist

### Pre-Flight Checks

- [ ] All redirect URIs added to Spotify Dashboard
- [ ] Server running (`npm run dev` in `server/`)
- [ ] Expo running (`npm run start` in `mobile/`)
- [ ] Accessed via `http://127.0.0.1:8081` (NOT localhost)

### Web Login Flow

- [ ] Click "Login with Spotify" button
- [ ] Browser redirects to `accounts.spotify.com`
- [ ] Spotify shows app name: "Ratesangeet"
- [ ] Spotify shows requested scopes (private, email, playback, etc.)
- [ ] Click "Agree" / "Accept"
- [ ] Browser redirects back to `http://127.0.0.1:8081?code=...`
- [ ] Console shows: `🔑 Exchanging code with server...`
- [ ] Console shows: `✅ Server auth successful`
- [ ] Console shows: `✅ Auth stored, user logged in`
- [ ] Home screen loads with user profile

### Mobile Login Flow

- [ ] Click "Login with Spotify" button
- [ ] Native browser opens with Spotify login
- [ ] User approves app
- [ ] App receives deep link: `ratesangeet://callback?accessToken=...`
- [ ] Console shows: `🔗 Deep link received`
- [ ] Console shows: `✅ Auth stored, user logged in`
- [ ] Home screen loads with user profile

### Error Handling

- [ ] Invalid code → Shows error message
- [ ] Expired code → Shows error message
- [ ] Redirect URI mismatch → Shows error message
- [ ] Network error → Shows error message
- [ ] User cancels → No error, stays on login screen

---

## 🐛 Troubleshooting

### Error: "INVALID_CLIENT: Invalid redirect URI"

**Cause**: Redirect URI mismatch

**Fix**:
1. Check Spotify Dashboard has **exact** URI: `http://127.0.0.1:8081`
2. Check you're accessing via `http://127.0.0.1:8081` (NOT `localhost`)
3. Verify `getRedirectUri()` returns `http://127.0.0.1:8081`
4. Check server logs for `usedRedirectUri` value

**Debug**:
```typescript
// LoginScreen.tsx
const redirectUri = getRedirectUri();
console.log('🔗 Using redirect URI:', redirectUri);
// MUST output: http://127.0.0.1:8081
```

### Error: "WebCrypto API not available"

**Cause**: Accessing via non-secure origin

**Fix**:
- Use `http://127.0.0.1:8081` (secure loopback)
- Do NOT use `http://192.168.x.x:8081` (LAN IP is insecure)

**Verify**:
```javascript
// Browser console
console.log(window.crypto); // Should be defined
console.log(window.crypto.subtle); // Should be defined
```

### Error: "Authorization code expired"

**Cause**: Code expires after 10 minutes

**Fix**:
- Exchange code immediately after receiving it
- Don't manually copy/paste codes (use automated flow)

### Error: "Failed to exchange authorization code"

**Cause**: Server error or invalid credentials

**Fix**:
1. Check server logs for detailed error
2. Verify `SPOTIFY_CLIENT_ID` in server `.env`
3. Verify `SPOTIFY_CLIENT_SECRET` in server `.env`
4. Ensure both belong to SAME Spotify app

---

## 🚀 Production Deployment

### Environment Variables (Render Dashboard)

```env
# Spotify OAuth
SPOTIFY_CLIENT_ID=30d78a30cd9f435eba6edbaa4a427041
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Production redirect URIs
SPOTIFY_REDIRECT_URI=https://ratesangeet.onrender.com/api/auth/callback
SPOTIFY_REDIRECT_URI_WEB=https://ratesangeet.onrender.com/api/auth/callback
SPOTIFY_REDIRECT_URI_MOBILE=https://ratesangeet.onrender.com/api/auth/callback

# MongoDB
MONGODB_URI=mongodb+srv://...

# Security
SESSION_SECRET=your_random_secret_here
NODE_ENV=production
```

### Mobile App Config

**Production API**: `mobile/src/config/index.ts`
```typescript
if (process.env.NODE_ENV === 'production') {
  return 'https://ratesangeet.onrender.com/api';
}
```

**Build APK/IPA**:
```powershell
# Android
cd mobile
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

### Spotify Dashboard (Production)

Add production redirect URI:
```
https://ratesangeet.onrender.com/api/auth/callback
```

### Testing Production

1. Deploy server to Render
2. Build mobile app with production API URL
3. Install APK/IPA on device
4. Test login flow end-to-end
5. Verify token refresh works
6. Verify scrobbling works

---

## 📚 Reference Documentation

- [Spotify PKCE Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [Spotify Redirect URI Requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- [OAuth 2.0 RFC 7636 (PKCE)](https://tools.ietf.org/html/rfc7636)
- [WebCrypto API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

## 🎉 Summary

### What We Built

✅ **PKCE OAuth 2.0** - Secure public client authentication  
✅ **Platform-Aware** - Web (browser crypto) + Mobile (expo-crypto)  
✅ **Spotify-Compliant** - Uses `127.0.0.1` instead of `localhost`  
✅ **Production-Ready** - Error handling, token refresh, deep linking  
✅ **Well-Documented** - OpenAPI spec + this guide + inline comments

### Key Takeaways

1. **ALWAYS use `127.0.0.1`**, never `localhost` (Spotify requirement)
2. **Store verifier in localStorage** (per Spotify docs, not sessionStorage)
3. **Native crypto APIs** (window.crypto.subtle on web, expo-crypto on mobile)
4. **Base64URL encoding** (no padding, URL-safe characters)
5. **Exact redirect URI match** (protocol, host, port, path)
6. **Exchange code immediately** (10-minute expiration)
7. **Clean up after success** (remove verifier/state from localStorage)

---

**Last Updated**: November 13, 2025  
**Status**: ✅ Production Ready  
**Version**: 1.0.0
