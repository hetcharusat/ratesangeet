# Spotify OAuth Redirect URI Fix

## Problem
Getting `INVALID_CLIENT: Invalid redirect URI` error because:
1. Using `localhost` instead of `127.0.0.1` (Spotify requires explicit IPv4 loopback)
2. `AuthSession.makeRedirectUri()` was generating URLs not in Spotify Dashboard
3. Using popup window on web instead of same-window redirect

## Solution Applied

### 1. Fixed Redirect URI
**File**: `mobile/src/screens/LoginScreenPaper.tsx`

Changed from:
```typescript
const redirectUri = AuthSession.makeRedirectUri({
  native: 'ratesangeet://callback',
});
```

To:
```typescript
// Use explicit redirect URIs that match Spotify Dashboard
// Spotify requires 127.0.0.1 (explicit IPv4 loopback), NOT localhost
const redirectUri = Platform.OS === 'web' 
  ? 'http://127.0.0.1:8081'
  : 'ratesangeet://callback';

console.log('🔗 Using Redirect URI:', redirectUri);
```

### 2. Fixed Web Login (No Popup)
Changed `handleLogin` to use full-page redirect on web:

```typescript
const handleLogin = async () => {
  try {
    setLoading(true);
    setError('');
    
    if (Platform.OS === 'web') {
      // On web, use full-page redirect instead of popup
      // This avoids popup blockers and provides better UX
      if (request?.url) {
        // Persist PKCE code verifier for after redirect
        if (request.codeVerifier) {
          sessionStorage.setItem('spotify_pkce_verifier', request.codeVerifier);
        }
        sessionStorage.setItem('spotify_redirect_uri', redirectUri);
        // Redirect to Spotify in same window
        window.location.href = request.url;
      }
    } else {
      // On mobile, use standard prompt
      await promptAsync();
    }
  } catch (err: any) {
    const message = err.message || 'Login failed. Please try again.';
    setError(message);
    setSnackbarVisible(true);
    setLoading(false);
  }
};
```

### 3. Added Web Redirect Handler
Added `useEffect` to handle OAuth callback after full-page redirect:

```typescript
// Handle web OAuth redirect (full-page redirect, not popup)
useEffect(() => {
  if (Platform.OS !== 'web') return;
  
  try {
    const qs = new URLSearchParams(window.location.search || '');
    const code = qs.get('code');
    const error = qs.get('error');

    if (error) {
      console.error('Auth returned error:', error);
      setError(`Authentication error: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code) {
      // Get stored code verifier from sessionStorage
      let codeVerifier = sessionStorage.getItem('spotify_pkce_verifier') || undefined;

      if (codeVerifier) {
        exchangeCodeAndLogin(code);
        // Clean up URL and sessionStorage
        window.history.replaceState({}, document.title, window.location.pathname);
        sessionStorage.removeItem('spotify_pkce_verifier');
        sessionStorage.removeItem('spotify_redirect_uri');
      }
    }
  } catch (e) {
    console.error('Error processing OAuth redirect:', e);
  }
}, []);
```

### 4. Updated Code Exchange Function
Updated `exchangeCodeAndLogin` to retrieve code verifier from sessionStorage on web:

```typescript
const exchangeCodeAndLogin = async (code: string) => {
  try {
    setLoading(true);
    
    // Get code verifier (from request on mobile, from sessionStorage on web)
    let codeVerifier = request?.codeVerifier;
    if (Platform.OS === 'web' && !codeVerifier) {
      codeVerifier = sessionStorage.getItem('spotify_pkce_verifier') || undefined;
    }

    if (!codeVerifier) {
      throw new Error('Code verifier missing');
    }
    
    // Exchange code for tokens...
  }
};
```

## Spotify Dashboard Configuration

Make sure these **exact** redirect URIs are in your Spotify Dashboard:

```
http://127.0.0.1:8081
ratesangeet://callback
```

⚠️ **Critical**: Use `127.0.0.1` NOT `localhost` - Spotify requires explicit IPv4 loopback address

## How to Test

### Web (Development)
1. Start Expo: `npm run start` in mobile folder
2. Press `w` to open in web browser
3. **IMPORTANT**: Expo will open `http://localhost:8081`
4. **Change URL to**: `http://127.0.0.1:8081` (replace `localhost` with `127.0.0.1`)
5. Click "Login with Spotify"
6. You'll be redirected to Spotify (same window, no popup)
7. After approving, you'll be redirected back to `http://127.0.0.1:8081`

### Mobile
1. Start Expo: `npm run start`
2. Press `a` for Android or `i` for iOS
3. Click "Login with Spotify"
4. Uses deep link: `ratesangeet://callback`

## Next Steps

1. **Install react-native-paper** (currently missing):
   ```bash
   cd mobile
   npm install react-native-paper react-native-safe-area-context
   ```

2. **Test the OAuth flow**:
   - Open `http://127.0.0.1:8081` in browser
   - Click login button
   - Should redirect to Spotify in same window
   - After approval, should redirect back and complete login

3. **Verify in console**:
   - Look for: `🔗 Using Redirect URI: http://127.0.0.1:8081`
   - Should NOT see any "Invalid redirect URI" errors

## Key Changes Summary

| Issue | Before | After |
|-------|--------|-------|
| **Redirect URI** | `AuthSession.makeRedirectUri()` (dynamic) | `http://127.0.0.1:8081` (explicit, matches Dashboard) |
| **Web Login** | Popup window (`promptAsync`) | Full-page redirect (`window.location.href`) |
| **Code Verifier** | Only from `request` object | From `sessionStorage` on web, `request` on mobile |
| **URL Format** | `localhost` | `127.0.0.1` (Spotify requirement) |

## Files Modified
- `mobile/src/screens/LoginScreenPaper.tsx` - Complete OAuth flow rewrite for web/mobile

## References
- `docs/05-authentication/SPOTIFY_SETUP.md` - Spotify Dashboard setup guide
- Spotify OAuth Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
