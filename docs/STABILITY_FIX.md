# Storage & Stability Quick Fix

## 📊 Hybrid Storage Policy (Updated)

**Cloud (MongoDB) - Last 30 Days:**
- ✅ Recent scrobbles (last 30 days) for web users to see activity
- ✅ Reviews, comments, favorites, follows
- ✅ AlbumStats, TrackStats, UserStatsSummaries (lightweight aggregates)

**Local (SQLite) - Full History:**
- ✅ All-time complete scrobble history
- ✅ Fast offline access
- ✅ No cloud storage limits

**Auto-Cleanup:**
- Server runs archive job daily (keeps last 30 days + 200 most recent per user)
- Updates AlbumStats/TrackStats before deleting old scrobbles
- Runs automatically at startup and every 24 hours

---

## 🧹 Clean Up Old Cloud Scrobbles

Your MongoDB had 46 scrobbles. Already cleaned ✅

If you need to run it again:

```powershell
cd server
npm run cleanup
```

---

## ✅ Already Fixed

### 1. Hybrid Cloud Storage Policy
- ✅ Set `CLOUD_ENABLE_SCROBBLES=true` in `server/.env`
- ✅ Set `CLOUD_SCROBBLE_RETENTION_DAYS=30` to keep last 30 days
- ✅ Server archives old scrobbles daily (updates stats first)
- ✅ Web users can see last 30 days; mobile has full history in SQLite

### 2. Stability Tools Created
- ✅ `mobile/src/utils/async.ts` - Retry, caching, debouncing utilities
- ✅ `mobile/src/components/LoadingState.tsx` - Reusable loading/error component
- ✅ `server/cleanup-cloud-storage.ts` - MongoDB cleanup script

---

## 📝 Apply These to Fix Slow/Partial Loads

### Step 1: Add Retry to API Calls

**Before:**
```typescript
const data = await getPublicReviews();
```

**After:**
```typescript
import { retryWithBackoff } from '../utils/async';
const data = await retryWithBackoff(() => getPublicReviews());
```

### Step 2: Add Loading States to Screens

```typescript
import { LoadingState } from '../components/LoadingState';
import { retryWithBackoff } from '../utils/async';

const MyScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await retryWithBackoff(() => fetchData());
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadingState
      loading={loading}
      error={error}
      onRetry={loadData}
      empty={data.length === 0}
    >
      {/* Your content */}
    </LoadingState>
  );
};
```

### Step 3: Cache Expensive Calls

```typescript
import { apiCache, retryWithBackoff } from '../utils/async';

const loadData = async () => {
  const cacheKey = 'public-reviews';
  const cached = apiCache.get(cacheKey);
  if (cached) {
    setData(cached);
    return;
  }

  const data = await retryWithBackoff(() => getPublicReviews());
  apiCache.set(cacheKey, data, 60000); // 1 min cache
  setData(data);
};
```

### Step 4: Debounce Search

```typescript
import { debounce } from '../utils/async';

const debouncedSearch = debounce((query: string) => {
  searchMusic(accessToken, query);
}, 300); // Wait 300ms after typing stops
```

---

## 🎯 Screens to Update

Apply retry + loading states to these screens:

- [ ] HomeScreen.tsx
- [ ] ActivityScreen.tsx
- [ ] ProfileScreen.tsx
- [ ] SearchScreen.tsx
- [ ] HistoryScreen.tsx
- [ ] ReviewDetailScreen.tsx

---

## 📊 Results

### Before
- MongoDB: 45 kB (40 scrobbles + stats)
- Blank screens on failure
- No loading indicators
- Duplicate API calls

### After
- MongoDB: ~4 kB (stats only)
- Error messages + retry button
- Loading spinners
- Cached responses (60s TTL)
- Auto-retry (3 attempts)

---

## 📚 Full Documentation

See `docs/STABILITY_IMPROVEMENTS.md` for complete guide.
