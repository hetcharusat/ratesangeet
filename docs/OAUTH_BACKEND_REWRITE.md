# OAuth Backend Rewrite Summary

**Date:** 2025-01-XX  
**Status:** ✅ COMPLETE - Ready for Testing  
**Related Docs:** `AUTH_REWRITE_ANALYSIS.md`

## Overview
Complete backend OAuth rewrite to match the clean PKCE-only architecture implemented on the frontend. Removed all insecure deep link token passing, eliminated mixing of confidential/public flows, and unified token exchange under a single secure endpoint.

## Changes Made

### 1. Unified PKCE Token Exchange (POST /auth/callback)
**Replaced:** Mixed flow that sometimes used client_secret (confidential), sometimes PKCE (public)  
**With:** Clean PKCE-only flow for all platforms (web + mobile)

#### New Behavior:
```typescript
// Required parameters:
{
  code: string,              // Authorization code from Spotify
  redirectUri: string,       // EXACT URI used in auth request
  codeVerifier: string       // PKCE proof (RFC 7636)
}

// Exchange using PKCE (NO client secret):
POST https://accounts.spotify.com/api/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code={code}
redirect_uri={redirectUri}    // MUST match auth request
client_id={SPOTIFY_CLIENT_ID}
code_verifier={codeVerifier}  // PKCE proof

// Returns secure JSON (NOT redirect):
{
  success: true,
  data: {
    accessToken: "...",
    refreshToken: "...",
    user: { id, spotifyId, displayName, email, profileImage, username }
  }
}
```

#### Security Improvements:
- ✅ **PKCE-only flow** (RFC 7636): No client secret, safe for public clients
- ✅ **Validates all required parameters**: Code, redirectUri, codeVerifier
- ✅ **Uses exact redirectUri from request**: No environment variable assumptions
- ✅ **Returns tokens via secure JSON**: Never in URL/redirect
- ✅ **Comprehensive error mapping**: Maps Spotify errors to actionable messages
- ✅ **Proper logging**: Logs status without exposing tokens

### 2. Removed Insecure Mobile Callback (GET /auth/callback/mobile)
**Deleted:** 120 lines of insecure deep link token passing

#### What Was Removed:
```typescript
// ❌ REMOVED: Insecure flow that passed tokens in URL
router.get('/callback/mobile', async (req, res) => {
  // ... exchange code for tokens ...
  
  // 🚨 INSECURE: Tokens in URL parameters
  const appRedirect = `ratesangeet://callback?` + new URLSearchParams({
    accessToken: access_token,        // ❌ Logged in browser history
    refreshToken: refresh_token,      // ❌ Logged in system logs
    userId: String(user._id),
    displayName: user.displayName,
    // ... more params
  }).toString();
  
  return res.redirect(appRedirect);   // ❌ Tokens visible everywhere
});
```

#### Why This Was Critical:
- **Browser History:** Tokens saved in URL history (recoverable)
- **System Logs:** Analytics services log full URLs with tokens
- **Deep Link Hijacking:** Other apps could intercept the callback
- **Network Logs:** Proxies/firewalls log full redirect URLs
- **No Expiration:** Tokens in logs persist forever

#### New Flow (Secure):
```typescript
// ✅ Mobile now uses POST /auth/callback (same as web)
// 1. Mobile: expo-auth-session handles OAuth redirect
// 2. Mobile: Extract code from result.params
// 3. Mobile: POST code + codeVerifier to /auth/callback
// 4. Server: Returns tokens in JSON body (encrypted in transit)
// 5. Mobile: Saves tokens securely (expo-secure-store)
```

### 3. Web Callback Still Exists (GET /auth/callback)
**Status:** Kept as-is for HTML-based web flow  
**Use Case:** Traditional web browsers that follow redirects

#### Current Behavior:
- Spotify redirects to `https://domain.com/auth/callback?code=...`
- Server exchanges code for tokens using **client_secret** (confidential flow)
- Returns HTML that stores tokens in localStorage and redirects
- **NOTE:** This is acceptable for web because:
  - Runs in secure browser context
  - Uses confidential client flow (server has client secret)
  - HTML response is served over HTTPS
  - localStorage is origin-bound

#### Future Consideration:
Could be replaced with client-side PKCE flow (like LoginScreen.new.tsx web flow), but current implementation is secure enough for web.

## Architecture Comparison

### Before (Mixed Flows):
```
Mobile Flow:
Spotify → GET /auth/callback/mobile?code=...
         → Server exchanges with client_secret
         → res.redirect(ratesangeet://callback?accessToken=...&refreshToken=...)
         → Mobile extracts tokens from URL ❌ INSECURE

Web Flow (POST):
Web → POST /auth/callback { code, redirectUri?, codeVerifier? }
     → Server: If codeVerifier → PKCE, else → client_secret
     → Mixed approach ❌ CONFUSING

Web Flow (GET):
Spotify → GET /auth/callback?code=...
         → Server exchanges with client_secret
         → Returns HTML with tokens in script
```

### After (Clean PKCE):
```
Mobile Flow:
Mobile → expo-auth-session (PKCE) → Extracts code
       → POST /auth/callback { code, redirectUri, codeVerifier }
       → Server: PKCE-only exchange (NO client_secret)
       → Returns { accessToken, refreshToken, user } in JSON ✅ SECURE

Web Flow (SPA):
Web → Manual PKCE → Spotify redirect → Extract code
    → POST /auth/callback { code, redirectUri, codeVerifier }
    → Server: PKCE-only exchange (NO client_secret)
    → Returns { accessToken, refreshToken, user } in JSON ✅ SECURE

Web Flow (Traditional):
Spotify → GET /auth/callback?code=...
         → Server exchanges with client_secret (confidential)
         → Returns HTML with tokens ✅ SECURE (HTTPS + server-side)
```

## Testing Checklist

### Prerequisites:
- [ ] Update Spotify Dashboard with ALL redirect URIs:
  - `http://localhost:8081`
  - `http://127.0.0.1:8081`
  - `ratesangeet://callback`
  - `https://ratesangeet.onrender.com`
  - Click "Save" button

### Test Cases:

#### 1. Web (localhost) - PKCE Flow
- [ ] Access `http://localhost:8081`
- [ ] Click "Login with Spotify"
- [ ] Verify redirects to Spotify with `code_challenge` in URL
- [ ] Approve permissions
- [ ] Verify redirects back to `http://localhost:8081`
- [ ] Check browser console for "✅ Login successful"
- [ ] Verify NO tokens logged in console
- [ ] Check Network tab: POST to `/auth/callback` with `{ code, redirectUri, codeVerifier }`
- [ ] Verify response contains tokens in JSON body
- [ ] Verify home screen loads with user data

#### 2. Web (127.0.0.1) - PKCE Flow
- [ ] Access `http://127.0.0.1:8081`
- [ ] Click "Login with Spotify"
- [ ] Verify redirects to Spotify with `redirect_uri=http://127.0.0.1:8081`
- [ ] Approve permissions
- [ ] Verify redirects back to `http://127.0.0.1:8081`
- [ ] Verify login works (same checks as localhost)

#### 3. Mobile (Expo Dev Build) - PKCE Flow
- [ ] Build: `cd mobile; eas build --profile development --platform android`
- [ ] Install on device
- [ ] Open app
- [ ] Click "Login with Spotify"
- [ ] Verify opens Spotify auth in browser
- [ ] Approve permissions
- [ ] Verify redirects back to app (deep link)
- [ ] Check logs: Should see POST to `/auth/callback`
- [ ] Verify NO tokens in logs
- [ ] Verify home screen loads

#### 4. Mobile (Production Build) - PKCE Flow
- [ ] Build: `cd mobile; eas build --profile production --platform android`
- [ ] Install on device
- [ ] Test same flow as dev build

#### 5. Error Handling
- [ ] Cancel auth flow → Verify proper error message
- [ ] Wrong client ID → Verify "INVALID_CLIENT" mapped correctly
- [ ] Wrong redirect URI → Verify "Invalid redirect URI" message
- [ ] Network error → Verify retry option
- [ ] Invalid state → Verify CSRF protection works

#### 6. Security Validation
- [ ] Check browser history → Should NOT contain tokens
- [ ] Check network logs → Tokens only in encrypted response body
- [ ] Check system logs → No tokens visible
- [ ] Replay old auth code → Should fail (codes are one-time use)
- [ ] Replay old state → Should fail (state validation)

## Backend Code Quality

### Validation:
```typescript
// ✅ Validates ALL required parameters
if (!code) return res.status(400).json({ error: 'Authorization code required' });
if (!codeVerifier) return res.status(400).json({ error: 'Code verifier required (PKCE flow)' });
if (!redirectUri) return res.status(400).json({ error: 'Redirect URI required' });
```

### PKCE Token Exchange:
```typescript
// ✅ PKCE parameters (NO client secret in Authorization header)
const tokenParams = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: redirectUri,        // From request (exact match)
  client_id: process.env.SPOTIFY_CLIENT_ID,
  code_verifier: codeVerifier,      // PKCE proof
});

// ✅ NO Authorization header (public client)
await axios.post(SPOTIFY_TOKEN_URL, tokenParams, {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
```

### Secure Response:
```typescript
// ✅ Returns tokens via JSON helper (not raw object)
return transitionalSuccess(res, {
  accessToken: access_token,
  refreshToken: refresh_token,
  user: { /* minimal user data */ }
});
```

### Error Handling:
```typescript
// ✅ Maps Spotify errors to actionable messages
catch (error: any) {
  const mapped = mapSpotifyAuthError(error, redirectUri);
  console.error('❌ PKCE token exchange failed:', {
    status: mapped.status,
    errorCode: mapped.errorCode,
    message: mapped.message,
    details: mapped.details,
  });
  return respondError(res, mapped.message, mapped.status, { /* details */ });
}
```

## Files Modified

### Backend:
- ✅ `server/src/routes/auth.ts`:
  - Rewrote POST /callback (150 lines) → PKCE-only, secure JSON response
  - Removed GET /callback/mobile (120 lines) → Eliminated insecure deep link tokens
  - Kept GET /callback (web HTML flow) → Still secure for traditional web

### Frontend:
- ✅ `mobile/src/screens/LoginScreen.tsx` → Replaced with production-ready version
- ✅ `mobile/src/screens/LoginScreen.old.tsx` → Backup of original (for reference)

### New Utilities:
- ✅ `mobile/src/utils/pkce.ts` → RFC 7636 compliant PKCE implementation
- ✅ `mobile/src/utils/redirectUri.ts` → Platform-aware redirect URI generation
- ✅ `mobile/src/utils/spotifyConfig.ts` → Centralized Spotify configuration

### Documentation:
- ✅ `docs/AUTH_REWRITE_ANALYSIS.md` → Frontend analysis (10 critical flaws)
- ✅ `docs/OAUTH_BACKEND_REWRITE.md` → This document

## Migration Notes

### Environment Variables (No Changes Needed):
```bash
# .env (server)
SPOTIFY_CLIENT_ID=30d78a30cd9f435eba6edbaa4a427041   # Same as before
SPOTIFY_CLIENT_SECRET=<keep as-is>                    # Still used for GET /callback (web)
SPOTIFY_REDIRECT_URI=<not used by POST /callback>    # Request body has redirectUri now
SPOTIFY_REDIRECT_URI_MOBILE=<not used anymore>       # Removed GET /callback/mobile
SPOTIFY_REDIRECT_URI_WEB=<not used by POST /callback># Request body has redirectUri now
```

### What Frontend Must Do:
1. Generate PKCE parameters: `codeVerifier`, `codeChallenge` (using `pkce.ts`)
2. Get exact redirect URI: `getRedirectUri()` from `redirectUri.ts`
3. Store `codeVerifier` and exact `redirectUri` before OAuth redirect
4. After OAuth: Extract `code` from callback
5. POST to `/auth/callback` with `{ code, redirectUri, codeVerifier }`
6. Save tokens from JSON response
7. **NEVER extract tokens from URL parameters** (that flow is deleted)

### Breaking Changes:
- ❌ **GET /auth/callback/mobile is REMOVED**
  - Any code that redirects to this endpoint will fail
  - Replace with POST /auth/callback
- ❌ **Deep link token passing is REMOVED**
  - Any code that extracts tokens from `ratesangeet://callback?accessToken=...` will fail
  - Replace with secure JSON response handling
- ✅ **POST /auth/callback now requires all 3 parameters**
  - `code` (was already required)
  - `codeVerifier` (NEW - required for PKCE)
  - `redirectUri` (NEW - must match auth request exactly)

## Security Improvements Summary

| Issue | Before | After |
|-------|--------|-------|
| **Token Exposure** | Tokens in URL params (logs, history, analytics) | Tokens only in JSON body (encrypted) |
| **Deep Link Hijacking** | Any app could register `ratesangeet://` callback | No tokens in deep links (just OAuth code) |
| **Flow Mixing** | Sometimes PKCE, sometimes client_secret | Always PKCE for mobile/web, client_secret only for server-rendered web |
| **Redirect URI Mismatch** | Server assumed env var | Server uses exact URI from request |
| **Parameter Validation** | Partial (only `code`) | Complete (`code`, `codeVerifier`, `redirectUri`) |
| **Error Messages** | Generic Spotify errors | Mapped to actionable messages |
| **Logging** | Tokens visible in logs | Only status/error codes logged |

## Next Steps

### Immediate:
1. ✅ **DONE:** Backend rewrite complete
2. ✅ **DONE:** Frontend LoginScreen replaced
3. ⏳ **TODO:** Update Spotify Dashboard with all redirect URIs
4. ⏳ **TODO:** Test web flow (localhost + 127.0.0.1)
5. ⏳ **TODO:** Test mobile flow (dev build + production build)

### Future Enhancements:
- Consider removing GET /auth/callback (web HTML flow) and using only PKCE
- Add rate limiting to POST /auth/callback (prevent brute force)
- Add PKCE code_challenge caching to prevent replay attacks
- Add refresh token rotation for enhanced security
- Add device tracking (know which devices have tokens)

## Deployment Checklist

### Before Deploy:
- [ ] Test all flows locally (web localhost, web 127.0.0.1, mobile dev)
- [ ] Verify no tokens in logs/console
- [ ] Update Spotify Dashboard redirect URIs
- [ ] Commit all changes to git
- [ ] Update `CHANGELOG.md` with breaking changes

### Deploy:
- [ ] Push to GitHub
- [ ] Trigger Render deployment (auto-deploys from main)
- [ ] Verify server starts without errors
- [ ] Test production web flow: `https://ratesangeet.onrender.com`
- [ ] Build and test production mobile app

### After Deploy:
- [ ] Monitor server logs for auth errors
- [ ] Check error rates in Render dashboard
- [ ] Test mobile production build
- [ ] Update `docs/05-authentication/` with new flow diagrams

## References

- **RFC 7636:** PKCE extension for OAuth 2.0 (https://tools.ietf.org/html/rfc7636)
- **Spotify Auth Guide:** https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- **Expo AuthSession:** https://docs.expo.dev/versions/latest/sdk/auth-session/
- **Frontend Analysis:** `docs/AUTH_REWRITE_ANALYSIS.md`
