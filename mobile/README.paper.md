# React Native Paper Implementation

This directory contains alternative UI implementations using React Native Paper.

## Files Created

### Screens
- `src/screens/LoginScreenPaper.tsx` - Login screen with Spotify OAuth
- `src/screens/HomeScreenPaper.tsx` - Home dashboard with stats and now playing

### Navigation
- `src/navigation/MainNavigator.tsx` - Bottom tab navigation with Paper's BottomNavigation.Bar

### App Entry
- `App.paper.tsx` - Main app file with Paper Provider and custom dark theme

## Features

### Login Screen
- Spotify green button with icon
- Loading state with ActivityIndicator
- Error handling with Snackbar
- Clean, centered design matching Spotify aesthetic

### Home Screen
- **Top AppBar**: Shows greeting and user actions (profile, logout)
- **Stats Cards**: Total scrobbles, hours listened, artists count
- **Now Scrobbling Card**: Currently playing track info with status chip
- **Top Albums Card**: List of most played albums with play counts
- **Recent Reviews Card**: Placeholder for user reviews
- **FAB**: Floating Action Button for adding reviews
- **Pull-to-Refresh**: Reload data with Spotify green indicator

### Bottom Navigation
- 5 tabs: Home 🏠, History 📜, Discovery ✨, Search 🔍, Profile 👤
- Spotify green active color (#1DB954)
- Dark background (#191414)
- Material Community Icons

## Theme

Custom MD3DarkTheme with Spotify colors:
```typescript
{
  primary: '#1DB954',      // Spotify Green
  background: '#121212',   // Dark Black
  surface: '#191414',      // Slightly Lighter
  surfaceVariant: '#282828', // Borders/Dividers
  onSurface: '#FFFFFF',    // Primary Text
  onSurfaceVariant: '#B3B3B3', // Secondary Text
}
```

## Usage

### Run with Paper UI
Replace the content of `App.tsx` with `App.paper.tsx`:

```bash
# Backup current App.tsx
mv App.tsx App.original.tsx

# Use Paper version
cp App.paper.tsx App.tsx

# Run
npm start
```

### Or Import Directly
```typescript
import App from './App.paper';
export default App;
```

## Components Used

### React Native Paper
- `Appbar` - Top app bar with title and actions
- `Button` - Primary/secondary buttons with icons
- `Card` - Content containers with elevation
- `Surface` - Elevated containers for stats
- `Chip` - Status badges and count indicators
- `Avatar.Icon` - Icon avatars for cards
- `ActivityIndicator` - Loading spinners
- `Snackbar` - Toast notifications
- `Divider` - Separators
- `BottomNavigation.Bar` - Tab bar navigation

### Navigation
- `@react-navigation/bottom-tabs` - Tab navigation structure
- `@react-navigation/stack` - Stack navigation for auth flow

## Design Decisions

1. **Dark Theme First**: Matches Spotify's visual identity
2. **Material Design 3**: Modern, accessible components
3. **Consistent Spacing**: 16px base unit for margins/padding
4. **Green Accents**: #1DB954 for CTAs and active states
5. **Card-Based Layout**: Each section in a distinct card
6. **Pull-to-Refresh**: Natural mobile interaction pattern
7. **FAB for Primary Action**: Quick access to add reviews

## Next Steps

To complete the implementation:

1. **Create remaining screens**:
   - `HistoryScreenPaper.tsx`
   - `DiscoveryScreenPaper.tsx`
   - `SearchScreenPaper.tsx`
   - `ProfileScreenPaper.tsx`
   - `AddReviewScreenPaper.tsx`
   - `AlbumDetailScreenPaper.tsx`

2. **Connect real data**:
   - Currently using mock data from context
   - Wire up API calls for stats, current track, reviews

3. **Add interactions**:
   - Navigate to album details
   - Open Spotify links
   - Like/comment on reviews

4. **Polish animations**:
   - Card enter/exit
   - Pull-to-refresh feedback
   - Tab transitions

## Dependencies

All required dependencies are already in `package.json`:
- `react-native-paper` ✅ (just installed)
- `react-native-vector-icons` ✅ (just installed)
- `@react-navigation/native` ✅
- `@react-navigation/bottom-tabs` ✅
- `@react-navigation/stack` ✅
- `react-native-safe-area-context` ✅

No additional setup needed!
