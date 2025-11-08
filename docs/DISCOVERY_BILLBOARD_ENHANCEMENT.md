# Discovery Billboard Enhancement

## Overview
Transformed the Discovery tab from basic trending lists into a Billboard Hot 100-style experience with regional filtering, nested tabs, and Spotify integration.

## Features Implemented

### 1. **Billboard-Style Sections**
Replaced single trending lists with multiple categorized sections:

#### Global Sections
- **🌍 Global Top Albums**: Most played albums worldwide (last 7 days)
- **🎵 Global Top Tracks**: Hottest tracks on repeat (last 7 days)

#### Regional Sections (India)
- **🇮🇳 India Top Albums**: Trending albums in India
- **🎤 India Top Tracks**: Hottest Indian tracks

Filter heuristic: Pre-defined list of Indian artists (Arijit Singh, A.R. Rahman, Shreya Ghoshal, etc.)

#### Additional Sections
- **🆕 Recent Releases**: Albums from last 30 days (requires Spotify token)

### 2. **Spotify Integration**
Every album and track includes:
- `spotifyUri`: Deep link format (`spotify:album:ID`, `spotify:track:ID`)
- `spotifyUrl`: Web fallback (`https://open.spotify.com/album/ID`)
- **"▶ Spotify"** button on all cards
- Auto-fallback: Try native deep link first, use web URL if unavailable

### 3. **Nested Tab Navigator**
Refactored DiscoveryScreen with custom tab implementation (avoiding material-top-tabs web compatibility issues):

#### Tabs
1. **🔥 Trending**: Billboard-style trending content
2. **📝 Reviews**: Placeholder for community reviews (Coming Soon)

#### Tab UI
- Custom tab bar with React Native TouchableOpacity
- Primary color bottom border for active tab
- Emoji prefixes for visual interest
- State-based tab switching with `useState`
- Separate content refresh per tab
- **Web-compatible**: No external dependencies, pure React Native components

### 4. **Visual Enhancements**
- **Rank Badges**: Show position (#1, #2, #3) on trending items
- **Section Subtitles**: Contextual descriptions ("Most played albums worldwide this week")
- **Spotify Badge**: Green "#1DB954" badge on all cards with play icon
- **TouchableOpacity**: All cards are tappable to open Spotify

### 5. **Server-Side Improvements**

#### Regional Cache Keys
```typescript
const cacheKey = `discover_${region}_${limit}`;
discoverCacheMap.set(cacheKey, { data, timestamp, cacheKey });
```
- Cache per region (global, india) to prevent cross-contamination
- 30s TTL per cached entry
- X-Cache headers (HIT/MISS, age)

#### API Response Structure
```typescript
{
  globalTopAlbums: [...],
  globalTopTracks: [...],
  indiaTopAlbums: [...],
  indiaTopTracks: [...],
  trendingAlbums: [...],  // Legacy (region-aware)
  trendingTracks: [...],  // Legacy (region-aware)
  recentReleases: [...],
  publicReviews: [...],
  region: 'global' | 'india',
  generatedAt: ISO8601,
  cached?: boolean,
  cacheAge?: number
}
```

## Technical Implementation

### Server Route Changes
**File**: `server/src/routes/discover.ts`

#### 1. Regional Artist Filter
```typescript
const indianArtists = [
  'Arijit Singh', 'A.R. Rahman', 'Shreya Ghoshal',
  'Atif Aslam', 'Sonu Nigam', 'Badshah', 'Divine',
  'Armaan Malik', 'Neha Kakkar', 'Sunidhi Chauhan'
];
```

#### 2. Multiple Aggregations
- 4 separate aggregation pipelines (global albums, global tracks, India albums, India tracks)
- Each sorted by `userCount` (unique listeners) → `scrobbleCount` (total plays)
- Limited to top N results (default 10, max 50)

#### 3. Spotify URI Generation
```typescript
spotifyUri: `spotify:album:${albumId}`,
spotifyUrl: `https://open.spotify.com/album/${albumId}`
```

#### 4. Region-Specific Cache
```typescript
const cached = discoverCacheMap.get(cacheKey);
if (!wantForce && cached && (now - cached.timestamp) < DISCOVER_CACHE_TTL) {
  // Return cached data
}
```

### Mobile Screen Changes
**File**: `mobile/src/screens/DiscoveryScreen.tsx`

#### 1. Component Structure
```
DiscoveryScreen (SafeAreaView)
  ├── Header (title + subtitle)
  ├── Custom Tab Bar (TouchableOpacity buttons)
  └── Conditional Content
      ├── TrendingTab (if activeTab === 'trending')
      │   └── ScrollView with Billboard sections
      └── ReviewsTab (if activeTab === 'reviews')
          └── "Coming soon" message
```

#### 2. Custom Tab Bar
- Simple flexbox row with two TouchableOpacity buttons
- State management: `const [activeTab, setActiveTab] = useState<'trending' | 'reviews'>('trending')`
- Active state styling: Primary color bottom border (3px)
- No external dependencies (web-compatible, avoids React Navigation module resolution issues)
- Receives `data`, `loading`, `refreshing`, `onRefresh` as props
- Shows ActivityIndicator while loading
- Renders all Billboard sections with horizontal scroll
- `openSpotify()` function handles deep link + web fallback

#### 3. Spotify Link Handler
```typescript
const openSpotify = (uri: string, url: string) => {
  Linking.canOpenURL(uri).then(supported => {
    if (supported) {
      Linking.openURL(uri);  // Try native deep link
    } else {
      Linking.openURL(url);   // Fallback to web
    }
  }).catch(() => Linking.openURL(url));
};
```

#### 4. Card Design
- **Rank Badge**: Absolute positioned top-left with primary color background
- **Spotify Badge**: Green bottom badge with play icon
- **TouchableOpacity**: Entire card triggers `openSpotify()`
- **Multiple sections**: Global, India, Recent Releases with contextual icons

### Type Updates
**File**: `mobile/src/services/api.ts`

Extended `DiscoveryPayload` interface:
```typescript
export interface DiscoveryPayload {
  // Billboard-style sections
  globalTopAlbums?: Array<{...spotifyUri, spotifyUrl}>;
  globalTopTracks?: Array<{...spotifyUri, spotifyUrl}>;
  indiaTopAlbums?: Array<{...spotifyUri, spotifyUrl}>;
  indiaTopTracks?: Array<{...spotifyUri, spotifyUrl}>;
  
  // Legacy fields
  trendingAlbums?: Array<{...spotifyUri?, spotifyUrl?}>;
  trendingTracks?: Array<{...spotifyUri?, spotifyUrl?}>;
  
  recentReleases?: Array<{...spotifyUri?, spotifyUrl?}>;
  publicReviews?: Review[];
  region?: string;
  cached?: boolean;
  cacheAge?: number;
}
```

## API Contract

### Endpoint
```
GET /discover?region=global&limit=10&force=true
```

### Query Parameters
- `region`: `'global'` (default) or `'india'`
- `limit`: Number of results per section (1-50, default 10)
- `force`: `'1'` or `'true'` to bypass cache
- `accessToken`: Spotify token for recent releases (optional)

### Response Headers
- `X-Cache`: `'HIT'` or `'MISS'`
- `X-Cache-Age`: Milliseconds since cache creation

### Response Body
See "API Response Structure" above

## Performance Considerations

### Cache Strategy
- **TTL**: 30 seconds (balances freshness vs load)
- **Per-region**: Separate cache entries for global/india
- **Force bypass**: Client can request fresh data
- **In-memory**: Simple Map, no external cache needed (< 1MB per entry)

### Aggregation Optimization
- **Indexed fields**: `playedAt`, `albumId`, `artistName`, `spotifyId` (ensure indexes exist)
- **Time-bounded**: Last 7 days for trending (smaller dataset)
- **Parallel queries**: Could parallelize 4 aggregations (future optimization)

### Mobile Optimization
- **Horizontal scrollers**: Lazy rendering for 12+ items per section
- **Image caching**: React Native auto-caches Spotify album art
- **Tab state**: Each tab preserves scroll position

## Future Enhancements

### Server-Side
1. **Artist API Integration**: Use Spotify Artist API to fetch real artist genres/regions instead of hardcoded list
2. **Genre Filtering**: Add genre-based sections (Rock Top 10, Hip-Hop Top 10)
3. **Time Range Params**: Allow client to request different time windows (24h, 7d, 30d)
4. **Curated Playlists**: Add editorial picks ("Staff Picks", "Hidden Gems")
5. **Personalized**: Use user listening history for "Recommended For You" section

### Mobile
1. **Reviews Tab**: Implement full community reviews feed with filters
2. **Album Detail Navigation**: Tap album card → navigate to AlbumDetailScreen
3. **Track Preview**: 30s preview playback using Spotify Web Playback SDK
4. **Share Functionality**: Share album/track to social media
5. **Filter UI**: Dropdown to switch regions (Global, India, US, UK, etc.)
6. **Infinite Scroll**: Load more items on scroll end

### UX
1. **Animations**: Smooth transitions for rank badge appearance
2. **Skeleton Loaders**: Show placeholder cards while loading
3. **Empty States**: Better messaging when no data available
4. **Error Handling**: Retry button when aggregations fail
5. **Pull-to-Refresh**: Already implemented ✅

## Testing Checklist

### Server
- [ ] `/discover?region=global` returns global sections
- [ ] `/discover?region=india` returns India sections
- [ ] Cache HIT after 2nd call within 30s
- [ ] Cache MISS after 31s or with `force=1`
- [ ] `spotifyUri` and `spotifyUrl` present on all items
- [ ] Rank order matches `userCount` → `scrobbleCount` sort

### Mobile
- [ ] Trending tab shows all 4 sections (Global/India Albums/Tracks)
- [ ] Reviews tab shows "Coming soon" placeholder
- [ ] Rank badges display on cards (#1, #2, #3)
- [ ] Spotify badge visible on all cards
- [ ] Tap card → Spotify opens (deep link or web)
- [ ] Pull-to-refresh reloads data
- [ ] Tab switching preserves scroll position

## Related Files
- `server/src/routes/discover.ts` - Discovery endpoint
- `mobile/src/screens/DiscoveryScreen.tsx` - UI implementation
- `mobile/src/services/api.ts` - Type definitions
- `docs/CACHING_STRATEGY.md` - Overall caching approach

## Commit Message
```
feat(discovery): Add Billboard-style trending with regional filtering

- Add Global Top Albums/Tracks and India Top Albums/Tracks sections
- Implement nested tabs (Trending/Reviews) in DiscoveryScreen
- Add Spotify deep links (spotifyUri + spotifyUrl) to all items
- Show rank badges (#1, #2, #3) on trending cards
- Add "Open in Spotify" button with native deep link fallback
- Implement region-aware cache keys (30s TTL per region)
- Create placeholder Reviews tab for future community feed

Closes #discovery-enhancement
```

## Deployment Notes
- No environment variables needed
- Spotify links work on native mobile (iOS/Android) without Spotify app installed (web fallback)
- Indian artist list can be extended by updating `indianArtists` array in `discover.ts`
- Cache is in-memory; survives until server restart (acceptable for 30s TTL)
