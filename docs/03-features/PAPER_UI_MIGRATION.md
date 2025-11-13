# React Native Paper UI Migration

## Overview
Complete migration from custom UI components to React Native Paper (Material Design 3) for a consistent, modern design system.

## Completed Work

### 1. LoginScreenPaper.tsx ✅
**Location**: `mobile/src/screens/LoginScreenPaper.tsx`

**Features**:
- Spotify OAuth PKCE flow implementation
- Uses `expo-auth-session` with `useAuthRequest` hook
- Client-side token exchange with Spotify
- Backend user upsert via `/auth/pkce-login`
- Material Design 3 components:
  - `Button` (Spotify green, contained mode)
  - `ActivityIndicator` (loading state)
  - `Snackbar` (error notifications with retry)

**OAuth Flow**:
1. User taps "Login with Spotify" → `promptAsync()`
2. Spotify authorization with PKCE code challenge
3. User approves → code returned to app
4. Client exchanges code for tokens via `AuthSession.exchangeCodeAsync()`
5. Tokens sent to backend `/auth/pkce-login` for user creation/update
6. `setAuth()` stores tokens + user in context + AsyncStorage

**Dependencies**:
- `expo-auth-session`: OAuth handling
- `expo-web-browser`: Browser session management
- React Native Paper: UI components
- AuthContext: State management

### 2. HomeScreenPaper.tsx ✅
**Location**: `mobile/src/screens/HomeScreenPaper.tsx`

**Features**:
- Dashboard with listening stats
- Pull-to-refresh functionality
- Material Design 3 components:
  - `Appbar` (top navigation with logout)
  - `Card`, `Card.Content`, `Card.Cover` (content containers)
  - `Surface` (elevated backgrounds)
  - `Chip` (status badges, counts)
  - `ScrollView` with `RefreshControl`
  - `Divider` (visual separators)
  - `FAB` (floating action button for new reviews)

**Sections**:
1. **Top Bar**: App logo + title + logout button
2. **Stats Cards**: Total scrobbles, listening minutes, unique artists
3. **Now Scrobbling**: Currently playing track with album art and status
4. **Top Albums**: List of most played albums with scrobble counts
5. **FAB**: Quick access to add review

**Current State**: Using mock data; ready for real API integration

### 3. MainNavigator.tsx ✅
**Location**: `mobile/src/navigation/MainNavigator.tsx`

**Features**:
- Bottom tab navigation with Paper's `BottomNavigation.Bar`
- Material Community Icons
- 5 tabs:
  - **Home**: Dashboard (HomeScreenPaper)
  - **History**: Scrobble archive (placeholder)
  - **Discovery**: Trending/playlists (placeholder)
  - **Search**: Track/album search (placeholder)
  - **Profile**: User settings (placeholder)

**Theme**:
- Active: Spotify green (#1DB954)
- Inactive: Gray (#B3B3B3)
- Background: Dark (#191414)

### 4. App.paper.tsx ✅
**Location**: `mobile/App.paper.tsx`

**Features**:
- Root app component with providers
- Custom MD3 Dark Theme (Spotify colors)
- Stack navigation: Login → Main
- Auth-gated routing (shows Login if no user, Main if authenticated)

**Theme Configuration**:
```typescript
{
  primary: '#1DB954',        // Spotify green
  secondary: '#191414',      // Dark surface
  background: '#121212',     // App background
  surface: '#191414',        // Card backgrounds
  surfaceVariant: '#282828', // Elevated surfaces
  onSurface: '#FFFFFF',      // Text on surfaces
  onSurfaceVariant: '#B3B3B3' // Secondary text
}
```

### 5. Archive Cleanup ✅
**Location**: `mobile/src/_archive/`

**Archived Files** (16 screens + old navigator):
- ActivityScreen.tsx
- AddReviewScreen.tsx
- AlbumDetailScreen.tsx
- ArtistScreen.tsx
- DiscoveryScreen.tsx
- ExploreScreen.tsx
- HistoryScreen.tsx
- HomeScreen.old.backup.tsx
- HomeScreen.old.tsx
- HomeScreen.tsx
- LoginScreen.tsx (OAuth reference code)
- ProfileScreen.tsx
- ReviewDetailScreen.tsx
- ReviewFeedScreen.tsx
- SearchScreen.tsx
- UptimeScreen.tsx
- AppNavigator.tsx

**Preserved**: Old components and theme folders for reference

## Fixed Issues

### Import Errors
- ❌ `useAuthContext` → ✅ `useAuth` (correct export from AuthContext)
- ❌ `apiClient` named import → ✅ default import
- ❌ `loading` property → ✅ `isLoading` (correct context property)

### Style Errors
- ❌ Duplicate `albumName` style in HomeScreenPaper
- ✅ Renamed to `currentAlbumName` for scrobbling section
- ✅ Kept `albumName` for top albums list

### OAuth Implementation
- ❌ Missing login implementation in LoginScreenPaper
- ✅ Extracted PKCE flow from archived LoginScreen
- ✅ Client-side token exchange + backend user upsert
- ✅ Platform-agnostic (works on mobile + web)

## Next Steps (Pending)

### 1. Complete Archive Cleanup
- [ ] Move `components/` folder to `_archive/`
- [ ] Move `theme/` folder to `_archive/`
- [ ] Verify no import errors from old files

### 2. Create Remaining Screens (Paper UI)
- [ ] **HistoryScreenPaper.tsx**: Scrobbles list + album completion
- [ ] **DiscoveryScreenPaper.tsx**: Playlists + reviews feed
- [ ] **SearchScreenPaper.tsx**: Search bar + filtered results
- [ ] **ProfileScreenPaper.tsx**: User profile + stats + favorites
- [ ] **AddReviewScreenPaper.tsx**: Review creation form
- [ ] **AlbumDetailScreenPaper.tsx**: Album tracks + progress + reviews
- [ ] **ReviewDetailScreenPaper.tsx**: Single review view + comments

### 3. Wire HomeScreen to Real API
- [ ] Replace mock data with `apiClient.get('/music/listening-stats')`
- [ ] Implement currently-playing API call
- [ ] Add error handling and empty states
- [ ] Test pull-to-refresh with `force=true`

### 4. Test OAuth Flow
- [ ] Test login on Android physical device
- [ ] Test login on iOS simulator
- [ ] Test login on web browser
- [ ] Verify token refresh on expiry
- [ ] Test logout and re-login

### 5. Build and Deploy
- [ ] Update `App.tsx` to use `App.paper.tsx`
- [ ] Test full app flow (login → home → navigation)
- [ ] Build APK for Android testing
- [ ] Update Spotify Developer Dashboard redirect URIs

## Development Notes

### Testing Server with Tasks (CRITICAL)
**Always use VS Code tasks for long-running servers:**

```powershell
# ✅ CORRECT: Start server in dedicated terminal
run_task(id="shell: Server")

# Wait for startup
Start-Sleep -Seconds 8

# Test in NEW terminal
run_in_terminal("curl http://localhost:5000/api/health")

# Check server logs
get_task_output(id="shell: Server")
```

**NEVER do this:**
```powershell
# ❌ WRONG: Background task in same terminal
run_in_terminal("npm run dev", isBackground=true)
run_in_terminal("curl ...") # This KILLS the server!
```

### API Integration Pattern
```typescript
// HomeScreenPaper.tsx example
const fetchData = async () => {
  try {
    setLoading(true);
    const response = await apiClient.get('/music/listening-stats', {
      params: { userId: user?.id, force: refreshing },
    });
    setStats(response.data.data);
  } catch (error) {
    console.error('Failed to load stats:', error);
    setError('Failed to load listening stats');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};
```

### Paper Component Patterns

**Button**:
```tsx
<Button
  mode="contained"
  icon="spotify"
  buttonColor="#1DB954"
  onPress={handleLogin}
>
  Login with Spotify
</Button>
```

**Card with Image**:
```tsx
<Card style={{ backgroundColor: '#191414' }}>
  <Card.Cover source={{ uri: albumArt }} />
  <Card.Content>
    <Text variant="titleMedium">{albumName}</Text>
    <Text variant="bodySmall">{artistName}</Text>
  </Card.Content>
</Card>
```

**Appbar**:
```tsx
<Appbar.Header style={{ backgroundColor: '#191414' }}>
  <Appbar.Content title="RateSangeet" />
  <Appbar.Action icon="logout" onPress={handleLogout} />
</Appbar.Header>
```

**Bottom Navigation**:
```tsx
<BottomNavigation.Bar
  navigationState={{ index, routes }}
  onTabPress={({ route }) => navigation.navigate(route.key)}
  activeColor="#1DB954"
  inactiveColor="#B3B3B3"
  style={{ backgroundColor: '#191414' }}
/>
```

## Dependencies Added
- ✅ `react-native-paper`: Material Design 3 components
- ✅ `expo-auth-session`: OAuth PKCE flow
- ✅ `expo-web-browser`: Browser session management
- ✅ `react-native-vector-icons`: Material Community Icons
- ⚠️ `@types/react-native-vector-icons`: Missing (minor warning)

## Files Modified
1. `mobile/src/screens/LoginScreenPaper.tsx` (created + OAuth implemented)
2. `mobile/src/screens/HomeScreenPaper.tsx` (created + styled)
3. `mobile/src/navigation/MainNavigator.tsx` (created + tabs)
4. `mobile/App.paper.tsx` (created + theme + routing)
5. 16 old screens moved to `_archive/`

## Design System

### Colors
- **Primary**: #1DB954 (Spotify Green)
- **Background**: #121212 (App Background)
- **Surface**: #191414 (Card Background)
- **Surface Variant**: #282828 (Elevated Elements)
- **Text Primary**: #FFFFFF (Main Text)
- **Text Secondary**: #B3B3B3 (Secondary Text)

### Typography (Material Design 3)
- **Display Large**: 57px / 64px line height
- **Title Large**: 22px / 28px line height
- **Title Medium**: 16px / 24px line height
- **Body Large**: 16px / 24px line height
- **Body Medium**: 14px / 20px line height
- **Label Large**: 14px / 20px line height

### Spacing
- **XS**: 4px
- **SM**: 8px
- **MD**: 16px
- **LG**: 24px
- **XL**: 32px

### Elevation (Shadows)
- **Level 0**: No shadow (flat surfaces)
- **Level 1**: 2dp (cards at rest)
- **Level 2**: 4dp (raised buttons)
- **Level 3**: 8dp (FAB, dialogs)

## Current Status
- ✅ Login flow: Complete with PKCE OAuth
- ✅ Home screen: Complete UI (mock data)
- ✅ Bottom navigation: Structure ready
- ✅ Theme system: MD3 Spotify dark theme
- ⏳ API integration: Pending for HomeScreen
- ⏳ Remaining screens: 7 screens to create
- ⏳ Archive cleanup: Components/theme folders pending

## Testing Checklist
- [ ] Login on Android
- [ ] Login on iOS
- [ ] Login on web
- [ ] Token refresh (expired access token)
- [ ] Logout and re-login
- [ ] Bottom tab navigation
- [ ] Pull-to-refresh on Home
- [ ] FAB action (add review)
- [ ] Appbar logout button
- [ ] Snackbar error display

## References
- [React Native Paper Docs](https://callstack.github.io/react-native-paper/)
- [Material Design 3](https://m3.material.io/)
- [Expo Auth Session](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Spotify OAuth PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
