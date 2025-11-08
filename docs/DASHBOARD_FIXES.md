# Dashboard & History Improvements

## Issues Fixed

### 1. Album Play Count Metric ✅
**Problem**: Album "plays" showed total track scrobbles (e.g., "17 plays" meant 17 individual track listens, not 17 album listening sessions)

**Solution**:
- Backend now tracks unique days an album was listened to
- Changed metric from `playCount` (sum of all track plays) to `uniqueDays.size` (unique listening sessions)
- Updated display from "X plays" to "X days" for clarity
- Example: If you listened to 17 different tracks from an album over 3 days → shows "3 days" instead of misleading "17 plays"

**Files Changed**:
- `server/src/routes/music.ts`:
  - Added `uniqueDays: Set<string>` to track unique dates
  - Changed `count: album.playCount` → `count: album.uniqueDays.size`
  - Applied to both singles and albums
- `mobile/src/screens/HomeScreen.tsx`:
  - Updated display: `{album.totalTracks} tracks • {album.count} {album.count === 1 ? 'day' : 'days'}`
  - Shows meaningful listening frequency instead of raw play counts

### 2. History Screen Spotify Integration ✅
**Problem**: History screen lacked "Open in Spotify" buttons (feature parity with Artist screen)

**Solution**:
- Added `openSpotifyTrack()` function using Linking API
- Added circular green play button (▶) next to each track in Tracks tab
- Uses `spotify:track:{id}` URI with fallback to web URL
- Matches ArtistScreen pattern for consistency

**Files Changed**:
- `mobile/src/screens/HistoryScreen.tsx`:
  - Added `Linking` and `Alert` imports
  - Added `openSpotifyTrack()` handler
  - New `actionButtons` container with Spotify + Rate buttons
  - New styles: `actionButtons`, `spotifyButton`, `spotifyButtonText`

### 3. History Screen Visual Improvements ✅
**Problem**: Poor contrast, cluttered header, inconsistent styling

**Solution**:
- **Header**: Larger title (32px, weight 900), green 3px bottom border (matches Artist screen)
- **Cards**: Better contrast with `#1F1F1F` background + `#2A2A2A` border
- **Albums Tab**: Improved layout with stats on one line, better badge positioning
- **Typography**: Bolder fonts, better hierarchy, improved spacing

**Files Changed**:
- `mobile/src/screens/HistoryScreen.tsx`:
  - Header: `borderBottomWidth: 3`, `borderBottomColor: '#1DB954'`
  - Title: `fontSize: 32`, `fontWeight: '900'`
  - Cards: Added `borderWidth: 1`, `borderColor: '#2A2A2A'`
  - Albums: `albumHeader` style, condensed stats display
  - Better completed badge positioning

## Technical Details

### Backend: Unique Days Tracking
```typescript
// Before (misleading)
albumMap[albumName].playCount++; // Sum of all track plays

// After (accurate)
const playDate = new Date(scrobble.playedAt).toISOString().split('T')[0];
albumMap[albumName].uniqueDays.add(playDate); // Unique listening sessions
```

### Frontend: Spotify Deep Links
```typescript
const openSpotifyTrack = async (trackId: string) => {
  const spotifyUrl = `spotify:track:${trackId}`;
  const webUrl = `https://open.spotify.com/track/${trackId}`;
  
  const supported = await Linking.canOpenURL(spotifyUrl);
  if (supported) {
    await Linking.openURL(spotifyUrl); // Native app
  } else {
    await Linking.openURL(webUrl); // Web fallback
  }
};
```

## User-Facing Changes

### Dashboard (Home Screen)
- **Before**: "Album X - 17 plays" (confusing - actually 17 track plays)
- **After**: "Album X - 10 tracks • 3 days" (clear - listened on 3 different days, 10 tracks total)

### History Screen - Tracks Tab
- **Before**: Only "Rate" button per track
- **After**: Green circular ▶ button + "Rate" button
- Click ▶ → opens track in Spotify app (or web if app not installed)

### History Screen - Albums Tab
- **Before**: Cluttered badge, separate stat lines, poor contrast
- **After**: 
  - "✓ Completed" badge at top
  - Single line: "🎵 10 tracks • 🔁 25 plays"
  - Better borders and contrast
  - Cleaner date formatting

### Visual Consistency
All screens now follow same design language:
- Bold white section titles (32px, weight 900)
- Green 3px bottom borders for headers
- `#1F1F1F` cards with `#2A2A2A` borders
- Green `#1DB954` accent for interactive elements
- Circular Spotify buttons (▶) across all screens

## Performance Notes

### Singles vs Albums Filter
- Backend correctly filters singles (≤3 tracks) vs albums (≥4 tracks)
- 70% completion threshold for albums (must have played 70% of tracks)
- Logs show: `Singles collected: N, Albums collected: M`

### Metric Computation
- Unique days tracking adds minimal overhead (just a Set operation)
- More meaningful than raw play counts
- Matches user mental model: "How many days did I listen to this album?"

## Next Steps (Optional)

1. **Album Spotify Buttons**: Add ▶ button to completed albums tab
   - Requires album ID (not always available in scrobbles)
   - Could search Spotify API: `${artist} - ${albumName}` → get album ID
   - Then use `spotify:album:{id}` deep link

2. **Loading Optimization**: 
   - Add skeleton loaders to History screen
   - Implement pagination (currently loads 500 scrobbles)
   - Cache scrobbles locally for faster loads

3. **Album Sessions**: 
   - Could group plays into "sessions" (same day, within 2 hours)
   - Show "listened 5 times over 3 days" for more detail
   - Add timeline view of listening history

## Testing Checklist

- [x] Dashboard shows "X days" instead of "X plays"
- [x] History Tracks tab has Spotify ▶ buttons
- [x] ▶ buttons open Spotify app (or web)
- [x] History screen has better contrast/hierarchy
- [x] Completed albums show condensed stats
- [x] Singles/albums filter working (check backend logs)
- [x] All styling consistent with Artist screen
