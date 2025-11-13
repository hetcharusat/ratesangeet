# Token Auto-Refresh Implementation Summary

## ✅ What We Fixed

### 1. Server-Side Auto-Refresh (COMPLETED)

#### Music Routes (`server/src/routes/music.ts`)
- ✅ Added `spotifyApiCall()` helper function
- ✅ Automatically catches 401 errors
- ✅ Refreshes token using `refreshUserToken()`
- ✅ Retries failed request with new token
- ✅ Returns `refreshedToken` in response for client to update

**Updated Endpoints:**
- ✅ `GET /api/music/currently-playing` - Critical for scrobbling
- ✅ `GET /api/music/search` - User search
- ✅ `GET /api/music/recently-played` - Backfill scrobbles

**How It Works:**
```typescript
// Client calls endpoint
GET /api/music/currently-playing?accessToken=EXPIRED_TOKEN&userId=SPOTIFY_ID

// Server detects 401 from Spotify
// → Automatically refreshes token
// → Retries request with new token
// → Returns data + refreshedToken

Response: {
  isPlaying: true,
  track: {...},
  refreshedToken: "NEW_ACCESS_TOKEN" // ← Client updates local storage
}
```

#### Background Scrobbler (`server/src/jobs/backgroundScrobbler.ts`)
- ✅ Already has token refresh built-in
- ✅ Handles `TOKEN_REVOKED` error gracefully
- ✅ Updates user in database after refresh

### 2. Middleware Created

**File**: `server/src/middleware/autoRefreshToken.ts`

**Exports:**
- `autoRefreshToken` - Express middleware (for routes that use userId from request)
- `refreshUserToken(userId)` - Utility function (used by music routes)

**Features:**
- ✅ Automatic token refresh on 401 errors
- ✅ Updates user in MongoDB with new tokens
- ✅ Returns proper error codes for client handling
- ✅ Handles both MongoDB ObjectId and Spotify ID lookups

### 3. Diagnostic & Cleanup Tools

**Token Health Checker** (`server/list-expired-tokens.ts`)
```bash
npm run check-tokens          # Check first 50 users
npm run check-tokens:all      # Check all users
npm run check-tokens -- --limit=100
```

**Cleanup Tool** (`server/cleanup-expired-users.ts`)
```bash
npm run cleanup-expired-users          # Preview (dry run)
npm run cleanup-expired-users:execute  # Actually delete
```

**Generated Reports:**
- `expired-tokens-{timestamp}.json` - Token health report
- `cleanup-report-{timestamp}.json` - Cleanup plan/results

---

## 📱 Client-Side Changes Needed

### Step 1: Update API Calls to Include `userId`

**Before:**
```typescript
const response = await fetch(
  `${API_URL}/music/currently-playing?accessToken=${accessToken}`
);
```

**After:**
```typescript
const response = await fetch(
  `${API_URL}/music/currently-playing?accessToken=${accessToken}&userId=${spotifyId}`
);
```

**Required for:**
- `/music/currently-playing` ← **CRITICAL** (used every 10s for scrobbling)
- `/music/search`
- `/music/recently-played`
- `/music/artist`
- `/music/album`

### Step 2: Handle Refreshed Tokens

```typescript
async function fetchCurrentlyPlaying(accessToken: string, userId: string) {
  const response = await fetch(
    `${API_URL}/music/currently-playing?accessToken=${accessToken}&userId=${userId}`
  );
  
  const data = await response.json();
  
  // Check if token was refreshed
  if (data.refreshedToken) {
    console.log('🔄 Token was auto-refreshed by server');
    
    // Update stored token
    await AsyncStorage.setItem('accessToken', data.refreshedToken);
    
    // Update context/state
    setAccessToken(data.refreshedToken);
    
    // Optional: Also update in User model if you store it there
    const user = await User.findOne({ spotifyId: userId });
    if (user) {
      user.accessToken = data.refreshedToken;
      await user.save();
    }
  }
  
  return data;
}
```

### Step 3: Handle Expired Refresh Tokens

```typescript
async function fetchWithAuth(url: string) {
  const response = await fetch(url);
  
  if (response.status === 401) {
    const data = await response.json();
    
    if (data.error === 'refresh_token_expired') {
      // Both tokens expired - redirect to login
      console.log('❌ Refresh token expired, need re-authentication');
      
      // Clear stored tokens
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
      
      // Show alert and redirect
      Alert.alert(
        'Session Expired',
        'Your Spotify session has expired. Please log in again.',
        [
          {
            text: 'Log In',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
      
      return null;
    }
  }
  
  return response;
}
```

### Step 4: Update ScrobbleContext

**File**: `mobile/src/context/ScrobbleContext.tsx`

**Current Issue**: Background poller uses `accessToken` from context, which may be expired.

**Fix Required**:
```typescript
// In startScrobbling() function
const pollCurrentlyPlaying = async () => {
  try {
    const response = await fetch(
      `${API_URL}/music/currently-playing?accessToken=${accessToken}&userId=${user.spotifyId}` // ← Add userId
    );
    
    const data = await response.json();
    
    // Update token if refreshed
    if (data.refreshedToken) {
      console.log('🔄 Token auto-refreshed during scrobbling');
      setAccessToken(data.refreshedToken); // Update context
      await AsyncStorage.setItem('accessToken', data.refreshedToken);
    }
    
    // Handle expired refresh token
    if (response.status === 401 && data.error === 'refresh_token_expired') {
      console.log('❌ Refresh token expired, stopping scrobbler');
      stopScrobbling();
      // Show re-login alert
      return;
    }
    
    // Rest of scrobbling logic...
  } catch (error) {
    console.error('Scrobbling error:', error);
  }
};
```

---

## 🎯 Priority Action Items

### Immediate (Critical for Scrobbling)
1. ✅ **Server auto-refresh implemented** ← DONE
2. ⏳ **Update ScrobbleContext** to include `userId` in API calls
3. ⏳ **Handle `refreshedToken`** in response and update storage

### High Priority (User Experience)
4. ⏳ **Update search screens** to include `userId`
5. ⏳ **Handle expired refresh tokens** with re-login flow
6. ⏳ **Test with expired token** to verify auto-refresh works

### Medium Priority (Cleanup)
7. ⏳ **Run cleanup script** to remove 4 users with revoked tokens
8. ⏳ **Add logging** for token refresh events
9. ⏳ **Update error handling** across all Spotify API calls

### Low Priority (Future)
10. ⏳ **Proactive token refresh** (refresh before expiry)
11. ⏳ **Token expiry tracking** (store expiry time, refresh 5 min before)
12. ⏳ **Monitoring dashboard** for token health

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] Force token expiration (change accessToken to invalid value)
- [ ] Call `/currently-playing` with expired token and valid userId
- [ ] Verify token auto-refreshes and returns `refreshedToken`
- [ ] Verify scrobbling continues working after refresh
- [ ] Test with revoked refresh token (should return 401 with error code)
- [ ] Verify client redirects to login on refresh token expiry

### Automated Testing (Future)
- [ ] Unit test for `spotifyApiCall()` helper
- [ ] Unit test for `refreshUserToken()` function
- [ ] Integration test for token refresh flow
- [ ] E2E test for scrobbling with expired token

---

## 📊 Current Token Status

**Last Check**: 2025-11-10 17:49 UTC

| Status | Count | Action |
|--------|-------|--------|
| ✅ Valid tokens | 3 | No action needed |
| ⚠️ Expired access (can refresh) | 1 | Will auto-refresh |
| ❌ Expired refresh (revoked) | 4 | Need cleanup |

**Users Needing Cleanup:**
1. Merja Manav (@merjamanav) - 18 scrobbles, 1 review
2. PRINCE PATEL (@princepatel) - 74 scrobbles, 0 reviews  
3. User (@user_5f62416d) - 174 scrobbles, 0 reviews
4. pinak. (@pinak) - 134 scrobbles, 2 reviews

**Total to delete**: 380 scrobbles, 3 reviews

---

## 🚀 Deployment Steps

### 1. Deploy Server Changes
```bash
# Server already updated with auto-refresh
git add server/src/routes/music.ts
git add server/src/middleware/autoRefreshToken.ts
git commit -m "feat: Add automatic token refresh to music routes"
git push
```

### 2. Update Mobile App
```typescript
// mobile/src/context/ScrobbleContext.tsx
// Add userId to all /currently-playing calls
// Handle refreshedToken in responses
// Handle refresh_token_expired errors
```

### 3. Test in Development
```bash
# Start server
npm --prefix server run dev

# Start mobile app  
npm --prefix mobile run start

# Test scrobbling with various token states
```

### 4. Clean Up Expired Users
```bash
# Preview cleanup
npm --prefix server run cleanup-expired-users

# Review report, then execute
npm --prefix server run cleanup-expired-users:execute
```

### 5. Monitor Production
- Watch server logs for token refresh events
- Monitor error rates for 401 responses
- Track re-authentication flow usage

---

## 📖 Related Documentation

- [TOKEN_MANAGEMENT.md](./TOKEN_MANAGEMENT.md) - Complete token lifecycle guide
- [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) - Server architecture overview
- [Spotify OAuth Flows](https://developer.spotify.com/documentation/web-api/concepts/authorization) - Official docs

---

## ❓ FAQ

**Q: Why are refresh tokens getting revoked?**  
A: Users are revoking app permissions from their Spotify dashboard. This is normal user behavior.

**Q: How often do access tokens expire?**  
A: Spotify access tokens expire after 1 hour.

**Q: How often do refresh tokens expire?**  
A: Typically 1 year, but can be revoked anytime by user or Spotify.

**Q: What happens if auto-refresh fails?**  
A: Server returns 401 with `error: 'refresh_token_expired'`. Client should redirect to login.

**Q: Do I need to update all API calls?**  
A: Only calls that use Spotify API (music routes). Auth, reviews, stats routes don't need changes.

**Q: Will this break existing mobile app?**  
A: No. `userId` is optional. If not provided, auto-refresh won't happen, but app still works (until token expires).

---

**Implementation Status**: ✅ Server Complete | ⏳ Client Pending  
**Next Step**: Update ScrobbleContext to pass `userId` and handle `refreshedToken`
