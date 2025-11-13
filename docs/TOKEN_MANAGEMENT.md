# Token Management & Cleanup Guide

## Overview
This document describes the token expiration issue, automated refresh system, and cleanup procedures for users with permanently expired refresh tokens.

---

## 🔍 Current Status (2025-11-10)

### Token Health Summary
- **Total Users**: 8
- **✅ Valid Tokens**: 3 users (37.5%)
- **⚠️ Expired Access (Can Auto-Refresh)**: 1 user (12.5%)
- **❌ Expired Refresh (Need Re-Auth)**: 4 users (50%)

### Users Needing Re-Authentication (Expired Refresh Tokens)
These users have **permanently expired** refresh tokens and cannot be auto-refreshed. They need to be cleaned up.

1. **Merja Manav** (@merjamanav)
   - Spotify ID: `31avdt2qtmnemk5hpdhcqahlr5ky`
   - Email: `manavmerja@gmail.com`
   - Created: 2025-11-08
   - Error: `Refresh token revoked`

2. **PRINCE PATEL** (@princepatel)
   - Spotify ID: `31v6x47t54capyuaa2tot3h6fmiu`
   - Email: `princepatel15306@gmail.com`
   - Created: 2025-11-08
   - Error: `Refresh token revoked`

3. **User** (@user_5f62416d)
   - Spotify ID: `temp_68f76ebaaeea6e3e5f62416d`
   - Email: `temp@example.com`
   - Created: 2025-11-08
   - Error: `Invalid refresh token`

4. **pinak.** (@pinak)
   - Spotify ID: `kqeoi0pilm5rhe32aprfyjzys`
   - Email: `upadhyaypinak9@gmail.com`
   - Created: 2025-11-08
   - Error: `Refresh token revoked`

### Users That Will Auto-Refresh
These users have expired access tokens but valid refresh tokens. They will automatically refresh on next API call.

1. **Percy** (@percy)
   - Spotify ID: `31hgmnxc7sma3x2alcvljvspvsqm`
   - Status: ✅ Will auto-refresh

---

## 🛠️ Token Management System

### 1. Automatic Token Refresh Middleware

**Location**: `server/src/middleware/autoRefreshToken.ts`

**How It Works**:
- Intercepts requests with userId parameter
- Tests if access token is valid (calls Spotify `/me` endpoint)
- If 401 error, automatically refreshes using refresh token
- Updates user in database with new tokens
- Proceeds with request using fresh token

**Usage**:
```typescript
import { autoRefreshToken } from '../middleware/autoRefreshToken.js';

// Apply to routes that make Spotify API calls
router.get('/listening-stats', autoRefreshToken, async (req, res) => {
  // If we reach here, token is guaranteed fresh
  const accessToken = user.accessToken;
  // Make Spotify API calls safely
});
```

**Error Handling**:
- Returns 401 with `errorCode: 'refresh_token_expired'` if refresh token also invalid
- Client should redirect to login when receiving this error

### 2. Manual Token Refresh Utility

**Function**: `refreshUserToken(userId)`

**Usage**:
```typescript
import { refreshUserToken } from '../middleware/autoRefreshToken.js';

const result = await refreshUserToken('31hgmnxc7sma3x2alcvljvspvsqm');
if (result.success) {
  console.log('New access token:', result.newAccessToken);
} else {
  console.log('Error:', result.error);
}
```

---

## 🔍 Diagnostic Tools

### 1. Check Token Status

```bash
# Check first 50 users
npm run check-tokens

# Check ALL users
npm run check-tokens:all

# Check specific number
npm run check-tokens -- --limit=100
```

**Output**:
- Lists each user with token validity status
- Identifies users needing re-auth vs auto-refresh
- Exports detailed JSON report

**Generated File**: `expired-tokens-{timestamp}.json`

### 2. Preview Cleanup (Dry Run)

```bash
# Preview what would be deleted (safe, no changes)
npm run cleanup-expired-users
```

**Output**:
- Lists users with expired refresh tokens
- Shows associated data counts (reviews, scrobbles, stats)
- Calculates total data to be deleted
- Exports cleanup plan to JSON

**Generated File**: `cleanup-report-{timestamp}.json`

---

## 🗑️ Cleanup Procedures

### Step 1: Preview Cleanup (SAFE)
```bash
cd server
npm run cleanup-expired-users
```

This will:
- ✅ Check all users' refresh tokens
- ✅ List users with permanently expired tokens
- ✅ Count associated data for each user
- ✅ Generate cleanup report
- ❌ **NOT delete anything**

### Step 2: Review Cleanup Report
Check the generated `cleanup-report-{timestamp}.json` file to review:
- Which users will be deleted
- How much data will be removed
- Email addresses (for notification if needed)

### Step 3: Execute Cleanup (DESTRUCTIVE)
```bash
# ⚠️ WARNING: This permanently deletes users and data
npm run cleanup-expired-users:execute
```

This will:
- Delete users with expired refresh tokens
- Delete all associated data:
  - Reviews
  - Scrobbles
  - Album stats
  - Track stats
  - User stats summaries
- Remove from followers/following lists
- Generate completion report

### Step 4: Verify Cleanup
```bash
npm run check-tokens
```

Should show 0 users with expired refresh tokens.

---

## 📊 What Gets Deleted

When cleaning up a user with expired refresh token:

| Data Type | Collection | Field |
|-----------|------------|-------|
| User Profile | `users` | `_id` match |
| Reviews | `reviews` | `userId` match (MongoDB _id) |
| Scrobbles | `scrobbles` | `userId` match (Spotify ID) |
| Album Stats | `albumstats` | `userId` match (Spotify ID) |
| Track Stats | `trackstats` | `userId` match (Spotify ID) |
| User Stats Summary | `userstatssummaries` | `userId` match (Spotify ID) |
| Followers | `users` | Remove from `followers` arrays |
| Following | `users` | Remove from `following` arrays |

---

## 🔄 Token Refresh Flow

### Spotify OAuth Token Lifecycle

```
1. Initial Login
   ├─> Client gets authorization code
   ├─> Server exchanges for tokens
   ├─> accessToken (expires 1 hour)
   └─> refreshToken (expires ~1 year or until revoked)

2. API Call with Expired Access Token
   ├─> Spotify returns 401 Unauthorized
   ├─> autoRefreshToken middleware catches 401
   ├─> Attempts refresh using refreshToken
   │   ├─> SUCCESS: New accessToken (+ maybe new refreshToken)
   │   │   ├─> Update user in DB
   │   │   └─> Proceed with request
   │   └─> FAILURE: Refresh token also expired/revoked
   │       ├─> Return 401 with errorCode: 'refresh_token_expired'
   │       └─> Client redirects to login

3. Refresh Token Expiration Reasons
   ├─> User revoked app permissions in Spotify dashboard
   ├─> Token not used for extended period (~1 year)
   ├─> Spotify security policy change
   └─> App credentials changed (client secret rotation)
```

---

## 🚨 Why Refresh Tokens Expire

### Common Causes:

1. **User Revoked Access**
   - User went to Spotify dashboard and removed app permissions
   - Most common cause in your data (4/4 users show "Refresh token revoked")

2. **Inactivity**
   - Refresh token not used for extended period (typically 1 year)
   - Spotify's security policy

3. **App Credentials Changed**
   - Client secret was rotated in Spotify Dashboard
   - All existing refresh tokens become invalid

4. **Spotify Policy Update**
   - Rare, but Spotify can invalidate tokens for security reasons

### Prevention:

- **Regular Token Refresh**: Use tokens at least every few months
- **Prompt Re-Authentication**: When users return after long absence
- **Background Jobs**: Periodically refresh active users' tokens
- **User Communication**: Notify users when re-auth needed

---

## 🔧 Applying Auto-Refresh to Existing Routes

### Routes That Need Auto-Refresh Middleware:

1. **Music/Spotify Routes** (`routes/music.ts`)
   - `/currently-playing` - Fetches current playback
   - `/recently-played` - Fetches history
   - `/sync-recent` - Backfills scrobbles
   - `/search` - Spotify search
   - `/artist/:id` - Artist data
   - `/album/:id` - Album data

2. **Stats Routes** (`routes/stats.ts`)
   - `/listening-stats` - May call Spotify for genres

3. **Background Scrobbler** (`jobs/backgroundScrobbler.ts`)
   - Polling `/currently-playing` every 10s

### Example Migration:

**Before**:
```typescript
router.get('/currently-playing', async (req, res) => {
  const { accessToken } = req.query;
  const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  res.json(response.data);
});
```

**After**:
```typescript
import { autoRefreshToken } from '../middleware/autoRefreshToken.js';

router.get('/currently-playing', autoRefreshToken, async (req, res) => {
  // Fetch user from DB (token is now guaranteed fresh)
  const userId = req.query.userId;
  const user = await User.findOne({ spotifyId: userId });
  
  const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${user.accessToken}` }
  });
  res.json(response.data);
});
```

---

## 📱 Client-Side Integration

### Handling Token Refresh Errors

```typescript
// mobile/src/services/api.ts

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    const data = await response.json();
    
    if (data.errorCode === 'refresh_token_expired') {
      // Both access and refresh tokens expired
      // Clear local auth and redirect to login
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      
      // Show message to user
      Alert.alert(
        'Session Expired',
        'Your Spotify session has expired. Please log in again.',
        [{ text: 'Log In', onPress: () => navigation.navigate('Login') }]
      );
      
      return null;
    }
  }
  
  return response;
}
```

---

## 📋 Next Steps

### Immediate Actions:

1. ✅ **Run Token Check** (DONE)
   - Identified 4 users with expired refresh tokens
   - Identified 1 user with expired access token (can auto-refresh)

2. ⏳ **Apply Auto-Refresh Middleware**
   - Add to music routes
   - Add to stats routes  
   - Add to background scrobbler

3. ⏳ **Clean Up Expired Users**
   - Preview cleanup (dry run)
   - Review generated report
   - Execute cleanup

4. ⏳ **Monitor & Prevent**
   - Schedule monthly token health checks
   - Add logging for token refresh events
   - Consider proactive background token refresh job

### Future Enhancements:

- [ ] Add automated cleanup cron job (weekly)
- [ ] Email users before cleanup (grace period)
- [ ] Dashboard showing token health metrics
- [ ] Background job to preemptively refresh tokens before expiry
- [ ] User notification system for expired sessions

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `server/list-expired-tokens.ts` | Diagnostic tool to check token validity |
| `server/cleanup-expired-users.ts` | Cleanup tool for users with expired refresh tokens |
| `server/src/middleware/autoRefreshToken.ts` | Middleware to auto-refresh expired access tokens |
| `server/src/routes/auth.ts` | Auth routes (login, callback, refresh) |
| `server/src/models/User.ts` | User model with token fields |

---

## 🎯 Commands Reference

```bash
# Token health check
npm run check-tokens              # Check first 50 users
npm run check-tokens:all          # Check all users
npm run check-tokens -- --limit=100  # Check specific number

# Cleanup preview (safe)
npm run cleanup-expired-users     # Dry run, no deletion

# Cleanup execution (destructive)
npm run cleanup-expired-users:execute  # Actually delete users

# Manual token refresh test
cd server
tsx -e "import('./src/middleware/autoRefreshToken.js').then(m => m.refreshUserToken('SPOTIFY_ID'))"
```

---

**Generated**: 2025-11-10  
**Current Status**: 4 users need cleanup, 1 user will auto-refresh  
**Action Required**: Apply auto-refresh middleware and execute cleanup
