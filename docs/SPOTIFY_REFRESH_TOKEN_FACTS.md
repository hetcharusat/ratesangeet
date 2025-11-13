# Spotify Refresh Token Behavior - Official Documentation Summary

## 🔑 Key Findings from Spotify Docs

### Refresh Token Behavior

**From Official Docs:**
> "The refresh token contained in the response, can be used to request new tokens. Depending on the grant used to get the initial refresh token, **a refresh token might not be included in each response**. When a refresh token is not returned, continue using the existing token."

### Critical Insights:

1. **Refresh Token Rotation** 
   - Spotify MAY return a new refresh token when you refresh
   - If no new refresh token in response → **keep using the old one**
   - This is normal behavior, NOT an error

2. **Access Token Lifespan**
   - Access tokens expire after **1 hour**
   - This is intentional security design
   - Must use refresh token to get new access token

3. **Refresh Token Lifespan**
   - Not explicitly documented (intentional)
   - Can last months/years if used regularly
   - Can be revoked by:
     - User removing app permissions in Spotify dashboard
     - User changing Spotify password
     - Spotify security policies
     - Long periods of inactivity

### When Refresh Tokens Fail

**Error Response: `invalid_grant`**

Reasons:
1. ✅ **User Revoked Access** - Most common (your 4 users)
   - User went to Spotify Account Settings → Apps → Removed your app
   - This is **permanent** - user must re-authenticate
   
2. ✅ **Authorization Code Issues** (during initial auth, not refresh)
   - Code expired (10 minutes)
   - Code already used
   - Redirect URI mismatch
   
3. ✅ **Token Already Used** (if rotation happened)
   - Old refresh token used after new one issued
   - Some implementations do this, Spotify docs don't explicitly mention
   
4. ✅ **Long Inactivity** (undocumented threshold)
   - Token not used for extended period
   - Spotify may invalidate for security

---

## 🎯 What This Means for Your App

### Your 4 Users with "Refresh token revoked"

**Status**: These are **legitimate failures** - NOT a bug in your code

**Why it happened:**
- Users likely removed your app from their Spotify account
- Or changed their Spotify password
- Or inactive for very long time

**What to do:**
- ✅ **Keep them** - They might come back and re-authenticate
- ❌ **Don't delete yet** - They have data (scrobbles, reviews)
- ⚠️ **Mark inactive** - Stop trying to refresh their tokens
- 📧 **Optional**: Email them that they need to re-login

### The 1 User (Percy) with Valid Refresh Token

**Status**: This is the **ideal state**

**What happens:**
- Access token expired (normal after 1 hour)
- Refresh token is valid
- Your auto-refresh will work perfectly
- User won't notice anything

---

## ✅ What Your Implementation Should Do

### 1. Handle Refresh Responses Correctly

```typescript
async function refreshUserToken(refreshToken: string) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${base64(clientId + ':' + clientSecret)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  });

  const data = await response.json();
  
  // IMPORTANT: Check if new refresh token returned
  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token || refreshToken; // ← Keep old if not returned
  
  return { newAccessToken, newRefreshToken };
}
```

### 2. Handle Errors Gracefully

```typescript
if (error.response?.status === 400 || error.response?.status === 401) {
  const errorType = error.response?.data?.error;
  
  if (errorType === 'invalid_grant') {
    // Permanent failure - user must re-authenticate
    // DON'T delete user, mark as inactive
    await User.updateOne(
      { _id: userId },
      { 
        $set: { 
          tokenStatus: 'revoked',
          lastTokenError: new Date()
        } 
      }
    );
    
    return { 
      success: false, 
      error: 'refresh_token_revoked',
      message: 'Please log in again to continue using the app'
    };
  }
}
```

### 3. Stop Polling for Revoked Users

```typescript
// In background scrobbler
const activeUsers = await User.find({
  tokenStatus: { $ne: 'revoked' } // ← Skip users with revoked tokens
});

for (const user of activeUsers) {
  try {
    // Try to scrobble
  } catch (error) {
    if (error.code === 'TOKEN_REVOKED') {
      // Mark user as revoked, stop trying
      user.tokenStatus = 'revoked';
      await user.save();
      console.log(`🚫 User ${user.displayName} revoked access, skipping`);
      continue;
    }
  }
}
```

---

## 📊 Recommended User States

Add a `tokenStatus` field to User model:

| Status | Meaning | Action |
|--------|---------|--------|
| `active` | Both tokens working | Normal operation |
| `access_expired` | Access expired, refresh valid | Auto-refresh on next API call |
| `revoked` | Refresh token invalid | Skip in background jobs, prompt re-login on use |
| `inactive` | User hasn't used app in 30+ days | Optional: Don't poll Spotify |

---

## 🔧 Updated Recommendations

### 1. DON'T Delete Users (You're Right!)

**Reasons:**
- They have data (scrobbles, reviews, social connections)
- They might come back
- You can't tell if they manually revoked or Spotify did it
- Their data is valuable for stats/history

### 2. DO Mark Them as Inactive

```bash
# Instead of cleanup script, run this:
npm run mark-revoked-users
```

```typescript
// New script: mark-revoked-users.ts
for (const user of usersWithExpiredRefresh) {
  await User.updateOne(
    { _id: user._id },
    { 
      $set: { 
        tokenStatus: 'revoked',
        lastTokenCheck: new Date()
      } 
    }
  );
}
```

### 3. DO Update User Model

```typescript
// server/src/models/User.ts
export interface IUser extends Document {
  // ... existing fields
  tokenStatus?: 'active' | 'access_expired' | 'revoked' | 'inactive';
  lastTokenCheck?: Date;
  lastTokenError?: Date;
}

const userSchema = new Schema<IUser>({
  // ... existing fields
  tokenStatus: { 
    type: String, 
    enum: ['active', 'access_expired', 'revoked', 'inactive'],
    default: 'active'
  },
  lastTokenCheck: { type: Date },
  lastTokenError: { type: Date },
});
```

### 4. DO Show Re-Login Prompt

When a user with `tokenStatus: 'revoked'` tries to use the app:

```typescript
if (user.tokenStatus === 'revoked') {
  return res.status(401).json({
    error: 'session_expired',
    message: 'Your Spotify connection has expired. Please reconnect.',
    action: 'reauthorize',
    reauthorizeUrl: '/api/auth/login?target=mobile'
  });
}
```

---

## 🎯 Revised Action Plan

### Phase 1: Update User Model (Now)
```bash
# Add tokenStatus field to User schema
# Default existing users to 'active'
```

### Phase 2: Mark Revoked Users (Now)
```bash
# Run token check
npm run check-tokens

# Mark revoked users (don't delete)
npm run mark-revoked-users  # New script
```

### Phase 3: Update Background Scrobbler (Now)
```typescript
// Skip users with tokenStatus: 'revoked'
// Don't waste API calls on them
```

### Phase 4: Update Auto-Refresh (Now)
```typescript
// When refresh fails with invalid_grant:
// → Set tokenStatus to 'revoked'
// → Return reauthorize action to client
// → Client shows "Reconnect Spotify" button
```

### Phase 5: Client Updates (Next)
```typescript
// Handle 'session_expired' error
// Show "Reconnect to Spotify" screen
// After re-auth, set tokenStatus back to 'active'
```

---

## 📚 Sources

1. **Spotify Authorization Docs**
   - https://developer.spotify.com/documentation/web-api/concepts/authorization
   
2. **Refresh Token Guide**
   - https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
   - Key quote: "a refresh token might not be included in each response. When a refresh token is not returned, continue using the existing token."

3. **Security Requirements (2025)**
   - https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify
   - Implicit grant deprecated, PKCE required for public clients

---

## ⚠️ Common Mistakes to Avoid

1. ❌ **Deleting users when refresh fails**
   - They might come back
   - You lose their data

2. ❌ **Overwriting refresh token with null**
   - Spotify doesn't always return new one
   - Keep existing if not in response

3. ❌ **Not handling rotation**
   - Some implementations rotate tokens
   - Always update if new one returned

4. ❌ **Polling revoked users forever**
   - Wastes API calls
   - Mark them and skip

5. ❌ **Not giving users a way back**
   - Show "Reconnect Spotify" button
   - After re-auth, they get all their data back

---

## ✅ Your Intuition Was Correct!

You were **100% right** to be cautious about deleting users. The "revoked" status doesn't mean bad data or bugs - it means users either:
1. Manually removed your app (their choice)
2. Changed password (security)
3. Inactive too long (Spotify policy)

**Better approach**: Mark as inactive, keep their data, let them reconnect when they're ready! 🎉
