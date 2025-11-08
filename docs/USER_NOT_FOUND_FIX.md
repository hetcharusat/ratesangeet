# User Not Found Error - ROOT FIX

## Problem
- **Symptom**: 404 "User not found" error in both local and production when accessing Profile tab
- **Error**: `GET /users/undefined 404 (Not Found)`
- **User Impact**: Users couldn't view their own profile after logging in

## Root Cause Analysis

### Data Flow Trace
```
User opens app → ProfileScreen renders → resolvedUserId = undefined
  ↓
useEffect fires immediately (before auth completes)
  ↓
loadProfile() calls getUserProfile(undefined)
  ↓
API request: GET /users/undefined
  ↓
Server: findById(undefined) → 404 User not found
```

### Root Problem
**ProfileScreen attempted to load user data BEFORE AuthContext completed authentication.**

- `resolvedUserId` = `route.params.userId || user?.id`
- When navigating to Profile tab (no userId param), depends on `user?.id`
- But `user` is `null` during initial auth load → `resolvedUserId = undefined`
- `useEffect(() => { loadProfile() }, [resolvedUserId])` fires with `undefined`

## ❌ PATCH Approaches (What We Avoided)
1. **Server-side workaround**: Check for `undefined` and return 401 "Please log in"
   - Problem: Symptom fix; doesn't prevent invalid API calls
2. **Client retry logic**: If 404, retry after 2 seconds
   - Problem: Wastes bandwidth; masks timing issue
3. **Hardcode default user ID**: Use environment variable for "self"
   - Problem: Couples UI to specific user; breaks multi-user

## ✅ ROOT FIX (What We Applied)

### Fix 1: Client-Side Guard (ProfileScreen)
**Prevent load when no user ID available**

```typescript
// BEFORE (causes 404):
useEffect(() => {
  loadProfile();
}, [resolvedUserId]);

// AFTER (guards against undefined):
useEffect(() => {
  if (!resolvedUserId) {
    console.log('[ProfileScreen] Skipping load: no user ID available');
    setLoading(false); // Stop spinner
    return; // Don't attempt API call
  }
  loadProfile();
}, [resolvedUserId]);
```

**Result**: No API call if `resolvedUserId` is undefined; waits for auth to complete.

### Fix 2: Server-Side Validation (users.ts)
**Validate user ID format before querying database**

```typescript
// BEFORE (allows invalid IDs):
const user = await User.findById(id);
if (!user) return res.status(404).json({ error: 'User not found' });

// AFTER (validates ID format):
if (!id || id === 'undefined' || id === 'null') {
  return res.status(400).json({ error: 'Invalid user ID' });
}
if (!mongoose.Types.ObjectId.isValid(id)) {
  return res.status(400).json({ error: 'Invalid user ID format' });
}
const user = await User.findById(id);
if (!user) return res.status(404).json({ error: 'User not found' });
```

**Result**: Returns 400 (client error) for invalid IDs instead of 404 (not found).

### Fix 3: Better UX (Not Logged In State)
**Show helpful message when user needs to log in**

```typescript
if (!profile) {
  const isNotLoggedIn = !resolvedUserId && !route.params.userId;
  return (
    <View style={[styles.container, styles.centered]}>
      <Text style={styles.emptyText}>
        {isNotLoggedIn ? 'Please log in to view your profile' : 'Profile not found'}
      </Text>
      {isNotLoggedIn && (
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

**Result**: Users see actionable message instead of generic "not found".

## Why This is a Root Fix

| Criterion | Status |
|-----------|--------|
| **Fixes data generation** | ✅ Prevents invalid API call at source (useEffect guard) |
| **Works with existing constraints** | ✅ No changes to auth flow or user model |
| **Self-healing** | ✅ System automatically prevents 404s going forward |
| **No cleanup/workarounds** | ✅ No retry logic or fallback hacks |
| **Trace to source** | ✅ Fixed where problem originates (loading before auth) |

## Files Modified
1. **mobile/src/screens/ProfileScreen.tsx**:
   - Added `if (!resolvedUserId) return` guard in useEffect
   - Added `setLoading(false)` when skipping load
   - Added "Please log in" vs "Profile not found" UX
   - Added login button for not-logged-in state
   - Added styles: `loginButton`, `loginButtonText`

2. **server/src/routes/users.ts**:
   - Added validation for `undefined`/`null` string IDs
   - Added MongoDB ObjectId format validation
   - Returns 400 instead of 404 for invalid IDs
   - Added console logs for debugging

## Testing Checklist

## Prevention

## Additional Fix: Backfill Missing User Documents

**Problem**: Some users logged in before the User model was properly implemented, so they have scrobbles but no User document.

**Symptom**: Valid user ID, scrobbles exist, but `GET /users/:id` returns 404.

**Solution**: Created `server/backfill-users.ts` script:
```bash
cd server
npx tsx backfill-users.ts
```

**What it does**:
- Finds all userIds from scrobbles
- Checks if User document exists
- Creates placeholder User document if missing (with temp data)
- User data will be properly updated on next login

**Result**: Users can access their profile immediately; data updates on next login.

## Root Fix Strategy
- ✅ Guard all route handlers that expect user ID
- ✅ Validate MongoDB ObjectId format before `.findById()`
- ✅ Show loading state until auth completes
- ✅ Clear error messages (400 vs 404)
- ✅ Graceful UX when data not available
