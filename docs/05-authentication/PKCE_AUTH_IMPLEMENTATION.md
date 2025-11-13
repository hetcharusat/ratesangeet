# PKCE OAuth Implementation - Complete Guide

> **Status**: ✅ IMPLEMENTED (Nov 2025)
> **Critical**: This is the authoritative authentication implementation for Ratesangeet V2

---

## Overview

Complete client-side PKCE OAuth 2.0 flow with server-side token exchange for both web and mobile platforms.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Platform-Aware)                   │
│  1. Generate PKCE parameters (code_verifier + challenge)     │
│  2. Redirect to Spotify with code_challenge                  │
│  3. Receive authorization code from Spotify                  │
│  4. Send code + code_verifier to server                      │
└─────────────────────────────────────────────────────────────┘
         │
         │ POST /auth/callback
         │ { code, redirectUri, codeVerifier, target }
         ↓
┌─────────────────────────────────────────────────────────────┐
│                      SERVER (Unified)                        │
│  1. Exchange code + code_verifier with Spotify (PKCE)        │
│  2. Get user profile from Spotify                            │
│  3. Create/update user in MongoDB                            │
│  4. Return { accessToken, refreshToken, user }               │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

- ✅ **Full PKCE support** (client-side code challenge, server-side verification)
- ✅ **Platform-aware redirect URIs** (auto-detects web/mobile)
- ✅ **Single server endpoint** (`POST /auth/callback`)
- ✅ **No sessionStorage race conditions** (stored, retrieved reliably)
- ✅ **Proper error handling** (Snackbar notifications with retry)
- ✅ **LAN IP support** (works with `http://192.168.x.x:8081`)

## Web Flow

### 1. User Clicks Login
```typescript
const redirectUri = window.location.origin; // e.g., http://192.168.42.205:8081
const codeVerifier = await generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);
const state = randomString();

// Store in sessionStorage
sessionStorage.setItem('spotify_code_verifier', codeVerifier);
sessionStorage.setItem('spotify_redirect_uri', redirectUri);
sessionStorage.setItem('spotify_state', state);

// Redirect to Spotify
window.location.href = `https://accounts.spotify.com/authorize?${params}`;
```

### 2. Spotify Redirects Back
```
http://192.168.42.205:8081/?code=AQBx...&state=abc123
```

### 3. Exchange Code
```typescript
const codeVerifier = sessionStorage.getItem('spotify_code_verifier');

const response = await fetch(`${API_URL}/auth/callback`, {
  method: 'POST',
  body: JSON.stringify({
    code,
    redirectUri,
    codeVerifier,
    target: 'web',
  }),
});

const { accessToken, refreshToken, user } = response.data;
```

## Mobile Flow

### 1. User Taps Login
```typescript
const redirectUri = 'ratesangeet://callback';
const codeVerifier = await generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

const authRequest = new AuthSession.AuthRequest({
  clientId: SPOTIFY_CLIENT_ID,
  redirectUri,
  scopes: [...],
  usePKCE: true,
  codeChallenge,
  codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
});

const result = await authRequest.promptAsync(discovery);
```

### 2. Get Authorization Code
```typescript
if (result.type === 'success' && result.params.code) {
  // Exchange with server
  const response = await fetch(`${API_URL}/auth/callback`, {
    method: 'POST',
    body: JSON.stringify({
      code: result.params.code,
      redirectUri,
      codeVerifier,
      target: 'mobile',
    }),
  });
}
```

## PKCE Helper Functions

```typescript
// Generate random code verifier (43-128 characters, URL-safe)
const generateCodeVerifier = async (): Promise<string> => {
  const randomBytes = Crypto.getRandomBytes(32);
  return base64URLEncode(randomBytes);
};

// Generate SHA256 hash of code verifier
const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier
  );
  return base64URLEncode(hashed);
};

// Base64-URL encoding (RFC 4648 § 5)
const base64URLEncode = (str: string | ArrayBuffer): string => {
  const base64 = typeof str === 'string' 
    ? btoa(str) 
    : btoa(String.fromCharCode(...new Uint8Array(str as ArrayBuffer)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};
```

## Redirect URI Configuration

### Development (Local Network)

**Web**: `http://192.168.42.205:8081`
- Auto-detected from `window.location.origin`
- Must match your LAN IP (check `ipconfig` or `ifconfig`)
- **DO NOT use `localhost`** (doesn't work from phone browsers)

**Mobile**: `ratesangeet://callback`
- Custom scheme defined in `app.json`
- Works with deep linking on Android/iOS

### Production

**Web**: `https://ratesangeet.onrender.com`
- Or your production domain
- **HTTPS required** (except for loopback addresses)

**Mobile**: `https://ratesangeet.onrender.com/api/auth/callback/mobile`
- Server-side mobile callback (exchanges tokens, then redirects to `ratesangeet://callback`)

## Spotify Developer Dashboard Setup

1. Go to https://developer.spotify.com/dashboard
2. Select your app (Client ID: `30d78a30cd9f435eba6edbaa4a427041`)
3. Click "Edit Settings"
4. Under "Redirect URIs", add:

### Required URIs:

#### Development:
```
http://192.168.42.205:8081
http://localhost:8081
http://127.0.0.1:8081
```

#### Production:
```
https://ratesangeet.onrender.com
https://ratesangeet.onrender.com/api/auth/callback
https://ratesangeet.onrender.com/api/auth/callback/mobile
```

5. Click "Save"

**⚠️ IMPORTANT**: 
- Trailing slashes matter (`/callback` ≠ `/callback/`)
- Port numbers matter (`:8081` ≠ `:3000`)
- Protocol matters (`http://` ≠ `https://`)
- Exact match required (no wildcards)

## Server Implementation

The server endpoint already handles PKCE correctly:

```typescript
// POST /auth/callback
router.post('/callback', async (req, res) => {
  const { code, redirectUri, codeVerifier, target } = req.body;
  
  // Build token exchange parameters
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  
  if (codeVerifier) {
    // PKCE flow (mobile)
    tokenParams.set('client_id', process.env.SPOTIFY_CLIENT_ID);
    tokenParams.set('code_verifier', codeVerifier);
  } else {
    // Client secret flow (server-side web)
    // Include Authorization: Basic header
  }
  
  // Exchange with Spotify
  const tokenResponse = await axios.post(SPOTIFY_TOKEN_URL, tokenParams, {...});
  
  // Get user profile
  const userResponse = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  
  // Create/update user in DB
  const user = await User.findOneAndUpdate(...);
  
  return res.json({
    success: true,
    data: {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: { id, spotifyId, displayName, email, ... },
    },
  });
});
```

## Error Handling

### Web
```typescript
try {
  // Auth flow
} catch (err) {
  setError(err.message || 'Authentication failed');
  setSnackbarVisible(true);
}
```

### Mobile
```typescript
if (result.type === 'error') {
  setError(result.error?.message || 'Authentication failed');
  setSnackbarVisible(true);
} else if (result.type === 'cancel') {
  console.log('User cancelled');
}
```

## Testing

### Web (Development)
1. Start server: `cd server && npm run dev`
2. Start Expo: `cd mobile && npx expo start --lan`
3. Open browser: `http://192.168.42.205:8081`
4. Click "Login with Spotify"
5. Approve on Spotify
6. Should redirect back and complete login

### Mobile (Android/iOS)
1. Start server: `cd server && npm run dev`
2. Start Expo: `cd mobile && npx expo start --lan`
3. Scan QR code with Expo Go
4. Tap "Login with Spotify"
5. Approve on Spotify
6. Should return to app and complete login

## Troubleshooting

### "Invalid redirect URI"
- **Cause**: Redirect URI not registered in Spotify Dashboard
- **Fix**: Add exact URI (including protocol, domain, port, path) to Dashboard

### "Code verifier missing from session"
- **Cause**: sessionStorage cleared or not set before redirect
- **Fix**: Check `sessionStorage.setItem()` is called before `window.location.href`

### "localhost doesn't work on mobile"
- **Cause**: `localhost` on mobile refers to the mobile device, not your computer
- **Fix**: Use LAN IP (`192.168.x.x`) instead

### "Redirect URI mismatch"
- **Cause**: `window.location.origin` includes port that doesn't match Dashboard
- **Fix**: Add URI with correct port to Dashboard (e.g., `:8081`)

## Dependencies

```json
{
  "expo-auth-session": "^7.0.8",
  "expo-crypto": "^15.0.7",
  "expo-web-browser": "^15.0.8",
  "react-native-paper": "^5.x"
}
```

## Security Notes

- ✅ Code verifier never sent to Spotify authorization endpoint (only code challenge)
- ✅ Code verifier stored in sessionStorage (cleared after exchange)
- ✅ State parameter prevents CSRF attacks
- ✅ Server validates tokens before creating/updating user
- ✅ Refresh tokens stored securely (AsyncStorage on mobile, httpOnly cookies optional)

## References

- [Spotify OAuth PKCE Guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [RFC 7636 - PKCE for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc7636)
- [Expo AuthSession Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
