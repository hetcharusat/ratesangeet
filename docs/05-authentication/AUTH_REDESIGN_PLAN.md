# Authentication Flow Redesign Plan

> **✅ IMPLEMENTATION COMPLETE** (2025-01)
> 
> This document was the original design plan. For current implementation details, see:
> - `AUTH_SIMPLIFICATION_COMPLETE.md` - Complete implementation guide
> - `AUTH_CLEAN_IMPLEMENTATION.md` - Architecture overview
> - `server/openapi.yaml` - API documentation
> - `docs/API_REFERENCE.md` - Quick reference
>
> **Status**: Server-side OAuth flow successfully implemented. Double-login issue resolved.

---

## Original Problems (Now Resolved)

### 1. **Double Login Issue**
- Web: Full-page redirect → sessionStorage → code verifier retrieval → exchange
- Mobile: promptAsync → response handling → code verifier from request
- Race conditions and missing code verifiers cause first login to fail

### 2. **Too Many Moving Parts**
```
Client (LoginScreen)
  ↓ useAuthRequest (generates PKCE)
  ↓ Store code verifier in sessionStorage (web) or memory (mobile)
  ↓ Redirect to Spotify
  ↓ Spotify redirects back
  ↓ Retrieve code verifier
  ↓ exchangeCodeAsync (client exchanges with Spotify)
  ↓ Call backend /auth/pkce-login
  ↓ Backend validates + creates user
  ↓ setAuth in context
```

**Problems:**
- 7+ steps with state management across page reloads
- sessionStorage can fail (private browsing, quota)
- Code verifier retrieval timing issues
- Client does token exchange (exposes client logic)

### 3. **Backend Has Two Different Auth Endpoints**
- `/auth/callback` - Server-side exchange (not used by mobile)
- `/auth/pkce-login` - Client already exchanged, just creates user
- Confusing which one to use

### 4. **Token Refresh Issues**
- Invalid refresh tokens cause infinite retry loops (now fixed with logout)
- But still need better validation

---

## Proposed Solution: Server-Handled OAuth

### New Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (ONE ENDPOINT)                     │
└─────────────────────────────────────────────────────────────┘
         │
         │ POST /auth/spotify
         │ { code, redirectUri, codeVerifier?, platform }
         ↓
┌─────────────────────────────────────────────────────────────┐
│                      SERVER (ONE ROUTE)                      │
│  1. Receive code from client                                 │
│  2. Exchange code with Spotify (PKCE or secret)              │
│  3. Get user profile from Spotify                            │
│  4. Create/update user in MongoDB                            │
│  5. Return { accessToken, refreshToken, user }               │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│               CLIENT (setAuth + AsyncStorage)                │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Client only handles: Get code → Send to server → Store response
- ✅ Server handles all Spotify API calls (token exchange, profile fetch)
- ✅ No client-side token exchange (simpler, more secure)
- ✅ No sessionStorage race conditions
- ✅ One auth endpoint to rule them all

---

## Implementation Plan

### Phase 1: Create Unified Server Endpoint ✅ (Already Exists!)

**Good News**: Your current `/auth/callback` endpoint already does this!

**File**: `server/src/routes/auth.ts`

```typescript
POST /auth/callback
Body: {
  code: string,
  redirectUri: string,
  codeVerifier?: string,  // PKCE (mobile/web)
  target?: 'web' | 'mobile'
}

Returns: {
  accessToken: string,
  refreshToken: string,
  user: {
    id, spotifyId, displayName, email, profileImage, username
  }
}
```

**What it does:**
1. ✅ Accepts authorization code
2. ✅ Exchanges with Spotify (handles PKCE or client secret)
3. ✅ Fetches user profile
4. ✅ Creates/updates user in DB
5. ✅ Returns tokens + user data

**Status**: This endpoint is already perfect! We just need to use it consistently.

---

### Phase 2: Simplify Client (Mobile/Web)

#### Current Issues in LoginScreenPaper.tsx:

1. **Client does token exchange** (lines 119-128):
```typescript
// ❌ CLIENT SHOULD NOT DO THIS
const tokenResponse = await AuthSession.exchangeCodeAsync(
  { clientId, code, redirectUri, extraParams: { code_verifier } },
  discovery
);

// Then sends tokens to backend
await apiClient.post('/auth/pkce-login', {
  accessToken: tokenResponse.accessToken,
  refreshToken: tokenResponse.refreshToken,
});
```

2. **Should be simplified to**:
```typescript
// ✅ SEND CODE DIRECTLY TO SERVER
const result = await apiClient.post('/auth/callback', {
  code,
  redirectUri,
  codeVerifier,
  target: Platform.OS === 'web' ? 'web' : 'mobile',
});

await setAuth({
  accessToken: result.data.data.accessToken,
  refreshToken: result.data.data.refreshToken,
  user: result.data.data.user,
});
```

**Benefits:**
- No client-side token exchange
- Server handles all Spotify communication
- Simpler error handling
- Works identically on web and mobile

---

### Phase 3: Fix Web Full-Page Redirect

#### Current Problem:
Web flow stores code verifier in sessionStorage, then retrieves it after redirect. This causes:
- Race conditions (verifier not yet stored)
- Private browsing issues (sessionStorage disabled)
- Need to clean up URL manually

#### Solution: Use State Parameter

**Standard OAuth pattern**:
1. Client generates random `state` value
2. Stores `codeVerifier` mapped to `state` in sessionStorage
3. Spotify redirects back with same `state`
4. Client retrieves `codeVerifier` using `state`

**Better approach for us**: Don't store anything client-side!

**Option A: Server-Side State Storage** (Recommended)
```typescript
// Step 1: Client initiates auth
GET /auth/init?platform=web
→ Server generates codeVerifier, stores in Redis/memory with sessionId
→ Returns { authUrl, sessionId }

// Step 2: Spotify redirects back
→ Client sends code + sessionId to server
→ Server retrieves codeVerifier from sessionId
→ Server exchanges code
```

**Option B: Encoded State Parameter** (Simpler, no Redis)
```typescript
// Step 1: Client generates codeVerifier
const codeVerifier = generateCodeVerifier();
const state = base64url(JSON.stringify({ 
  codeVerifier, 
  timestamp: Date.now() 
}));

// Step 2: Include in auth URL
const authUrl = `${SPOTIFY_AUTH}?...&state=${state}`;

// Step 3: Spotify returns state in redirect
→ Client decodes state to get codeVerifier
→ Send to server immediately
```

---

## Migration Steps

### Step 1: Update Server (Minimal Changes Needed)

**File**: `server/src/routes/auth.ts`

Current `/auth/callback` is already good! Just add better error messages:

```typescript
router.post('/callback', async (req: Request, res: Response) => {
  const { code, redirectUri, codeVerifier, target } = req.body;

  if (!code) {
    return respondError(res, 'Authorization code is required', 400);
  }

  if (!redirectUri) {
    return respondError(res, 'Redirect URI is required', 400);
  }

  // Rest of the logic stays the same...
  // Already handles PKCE exchange + user creation
});
```

### Step 2: Simplify Client - Remove Token Exchange

**File**: `mobile/src/screens/LoginScreenPaper.tsx`

**Before** (90 lines of complexity):
```typescript
const exchangeCodeAndLogin = async (code: string) => {
  // Get code verifier from sessionStorage/request
  // Exchange code with Spotify client-side
  // Then send tokens to backend
  // Handle errors, cleanup
};
```

**After** (20 lines):
```typescript
const exchangeCodeAndLogin = async (code: string) => {
  setLoading(true);
  
  try {
    const result = await apiClient.post('/auth/callback', {
      code,
      redirectUri,
      codeVerifier: request?.codeVerifier,
      target: Platform.OS === 'web' ? 'web' : 'mobile',
    });

    if (result.data.success) {
      await setAuth({
        accessToken: result.data.data.accessToken,
        refreshToken: result.data.data.refreshToken,
        user: result.data.data.user,
      });
    }
  } catch (err: any) {
    setError(err.response?.data?.message || 'Login failed');
    setSnackbarVisible(true);
  } finally {
    setLoading(false);
  }
};
```

### Step 3: Fix Web sessionStorage Issue

**Option 1: Use State Parameter (Recommended)**

```typescript
const handleLogin = async () => {
  if (Platform.OS === 'web') {
    if (request?.url) {
      // Generate state with embedded code verifier
      const state = {
        codeVerifier: request.codeVerifier,
        timestamp: Date.now(),
      };
      const encodedState = btoa(JSON.stringify(state));
      
      // Add state to auth URL
      const authUrlWithState = `${request.url}&state=${encodedState}`;
      window.location.href = authUrlWithState;
    }
  } else {
    await promptAsync();
  }
};

// In callback handler:
const state = qs.get('state');
if (state) {
  const decoded = JSON.parse(atob(state));
  const codeVerifier = decoded.codeVerifier;
  // Send to server immediately
}
```

**Option 2: Skip Code Verifier on Web** (Simpler)

For web development at `127.0.0.1`, we can use client secret instead of PKCE:

```typescript
// Client sends code without verifier
await apiClient.post('/auth/callback', {
  code,
  redirectUri: 'http://127.0.0.1:8081',
  target: 'web',
  // No codeVerifier - server uses client secret
});
```

Server already handles this (lines 131-140 in auth.ts).

---

## Recommended Approach: Hybrid Strategy

### For Development (127.0.0.1)
- **Web**: Use client secret (no PKCE needed)
- **Mobile**: Use PKCE

### For Production
- **Web**: PKCE with state parameter
- **Mobile**: PKCE

**Why?**
- Simpler development (no sessionStorage issues)
- Secure production (PKCE for public clients)
- Server already supports both flows

---

## Implementation Checklist

### Immediate Fixes (Solve Double Login)

- [ ] **Remove client-side token exchange** from LoginScreenPaper
  - Delete `AuthSession.exchangeCodeAsync` call
  - Send code directly to `/auth/callback`

- [ ] **Fix web code verifier retrieval**
  - Option A: Use state parameter
  - Option B: Use client secret for dev (recommended)

- [ ] **Add better error messages**
  - "Code verifier missing" → Show helpful message
  - "Invalid redirect URI" → Show which URI was used
  - Network errors → "Check internet connection"

- [ ] **Add loading states**
  - Show spinner during redirect
  - "Completing login..." after redirect back

### Testing

- [ ] Web login at 127.0.0.1:8081 (2 attempts)
- [ ] Mobile login on Android
- [ ] Mobile login on iOS
- [ ] Token refresh after 1 hour
- [ ] Invalid refresh token → force logout
- [ ] Network failure → retry prompt

---

## Code Changes Required

### 1. LoginScreenPaper.tsx (Main Changes)

```typescript
// REMOVE these lines:
const tokenResponse = await AuthSession.exchangeCodeAsync(...);

// REPLACE WITH:
const result = await apiClient.post('/auth/callback', {
  code,
  redirectUri,
  codeVerifier: request?.codeVerifier,
  target: Platform.OS,
});
```

### 2. For Web - Remove sessionStorage Complexity

```typescript
// REMOVE:
sessionStorage.setItem('spotify_pkce_verifier', ...);
const codeVerifier = sessionStorage.getItem(...);

// KEEP IT SIMPLE:
// Just send code to server, let server handle everything
```

### 3. Server - Already Good!

No changes needed to `/auth/callback`. It already:
- ✅ Handles PKCE (if codeVerifier provided)
- ✅ Handles client secret (if no codeVerifier)
- ✅ Creates/updates user
- ✅ Returns tokens + user data

---

## Expected Results

### Before (Current Issues)
- ❌ Need to login twice on web sometimes
- ❌ sessionStorage errors in private browsing
- ❌ Complex code with race conditions
- ❌ 90+ lines of auth logic in client

### After (Simplified)
- ✅ Login works first time, every time
- ✅ No sessionStorage dependencies
- ✅ Simple, predictable flow
- ✅ 20 lines of auth logic in client
- ✅ Server handles all complexity

---

## Timeline

- **Phase 1**: Simplify client (remove token exchange) - **30 minutes**
- **Phase 2**: Fix web sessionStorage - **20 minutes**
- **Phase 3**: Testing and refinement - **30 minutes**

**Total**: ~1.5 hours to stable, production-ready auth

---

## Alternative: Use Existing Backend Endpoint

**Even Simpler Option**: Your `/auth/callback` is already perfect!

Just update the client to use it consistently:

```typescript
// ONE function for all platforms:
const login = async (code: string) => {
  const result = await apiClient.post('/auth/callback', {
    code,
    redirectUri,
    codeVerifier: Platform.OS === 'web' ? undefined : request?.codeVerifier,
    target: Platform.OS,
  });
  
  await setAuth(result.data.data);
};
```

That's it! 🎉

---

## Next Steps

Would you like me to:

1. **Implement the simplified flow now** (recommended)
   - Remove client token exchange
   - Use server `/auth/callback` directly
   - Fix sessionStorage issues

2. **Add state parameter approach** (more robust for production)
   - Encode code verifier in state
   - No sessionStorage needed

3. **Use hybrid approach** (fastest to implement)
   - Client secret for web dev
   - PKCE for mobile
   - Already supported by server!

**Recommendation**: Option 3 (hybrid) - Works immediately, no sessionStorage issues, server already supports it.

Let me know which approach you prefer and I'll implement it right away! 🚀
