# Flutter + Material Design 3 Architecture

## Overview
RateSangeet is a **headless architecture** where:
- **Backend** = Stateless REST API (Node.js + Express)
- **Frontend** = Flutter with Material Design 3 (Google's design system built-in)
- **Storage** = MongoDB (cloud) + SQLite (device)

## Backend Contract (Headless API)

The backend is completely decoupled from the frontend. Flutter app talks to REST endpoints only.

### API Endpoints

#### Authentication
```
POST /auth/callback
Request: { code, state, codeVerifier }
Response: { accessToken, refreshToken, expiresIn }
```

#### Scrobbles
```
GET  /api/v2/scrobbles/recent?limit=20&before=iso
Response: [{ spotifyId, trackName, artistName, playedAt, isScrobbled }]

POST /api/v2/scrobbles/batch-upsert
Request: { scrobbles: [{ spotifyId, trackName, ..., isScrobbled }] }
Response: { inserted, updated, failed }

GET  /api/v2/scrobbles/archive-ready?before=iso
Response: [{ scrobbles }]  // >83 days old

POST /api/v2/scrobbles/ack-archive
Request: { scrobbleIds }
Response: { deleted }
```

#### Stats
```
GET  /api/v2/stats/summary
Response: { totalMinutes, totalScrobbles, uniqueArtistsCount }

GET  /api/v2/stats/top-albums?limit=10
Response: [{ albumId, name, artist, count, imageUrl }]

GET  /api/v2/stats/top-tracks?limit=10
Response: [{ spotifyId, name, artist, count }]
```

#### Tracks/Albums/Artists
```
GET  /api/v2/track/:id
Response: { id, name, albumId, artistId, durationMs }

GET  /api/v2/album/:id
Response: { id, name, artistName, totalTracks, imageSmall }

GET  /api/v2/artist/:id
Response: { id, name, imageSmall }
```

### Rate Limits
- Batch Upsert: 10/s burst, 100/min per user
- Now Playing: 30/min per user
- Others: Default 60/min per user

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept-Encoding: gzip
```

## Frontend: Flutter Project Structure

```
flutter_app/
├── lib/
│   ├── main.dart                          # App entry point
│   ├── config/
│   │   ├── api_config.dart               # Backend URL, Spotify client ID
│   │   └── theme_config.dart             # Material Design 3 theme
│   ├── models/
│   │   ├── track.dart
│   │   ├── album.dart
│   │   ├── artist.dart
│   │   ├── user.dart
│   │   └── stats.dart
│   ├── providers/                         # Riverpod (state management)
│   │   ├── auth_provider.dart            # Login, token, user
│   │   ├── scrobble_provider.dart        # Local queue, sync logic
│   │   ├── stats_provider.dart           # User stats, cache
│   │   ├── playlist_provider.dart        # Now playing, progress
│   │   └── local_storage_provider.dart   # Hive, SQLite access
│   ├── screens/
│   │   ├── splash_screen.dart
│   │   ├── login_screen.dart             # Spotify OAuth entry
│   │   ├── home_screen.dart              # Stats, now playing, recent
│   │   ├── album_detail_screen.dart      # Album progress, tracks
│   │   ├── search_screen.dart            # Find tracks/albums
│   │   ├── profile_screen.dart           # User profile, stats
│   │   ├── history_screen.dart           # All scrobbles, filtering
│   │   └── add_review_screen.dart        # Rate & review
│   ├── widgets/
│   │   ├── wavy_progress_indicator.dart  # Custom MD3 wavy progress
│   │   ├── now_playing_card.dart         # Currently playing widget
│   │   ├── stat_card.dart                # Stats display cards
│   │   ├── album_card.dart               # Album grid item
│   │   ├── track_tile.dart               # Track list item
│   │   └── custom_app_bar.dart           # Material 3 AppBar
│   ├── services/
│   │   ├── api_service.dart              # HTTP client (Dio)
│   │   ├── spotify_service.dart          # Spotify API calls
│   │   ├── auth_service.dart             # OAuth 2.0 flow
│   │   ├── local_storage_service.dart    # Hive + SQLite
│   │   ├── scrobble_service.dart         # Client-side detection
│   │   └── polling_service.dart          # Smart polling logic
│   └── utils/
│       ├── constants.dart                # App constants
│       ├── deep_link_handler.dart        # OAuth redirect handling
│       └── logger.dart                   # Logging
├── android/                               # Android native code
│   └── app/
│       └── src/
│           └── main/
│               ├── AndroidManifest.xml   # Deep linking config
│               └── kotlin/               # Android-specific code
├── ios/                                   # iOS native code
│   └── Runner/
│       ├── Info.plist                    # Deep linking config
│       └── RunnerTests/
├── web/                                   # Web support (optional)
├── test/
│   ├── unit/                             # Unit tests
│   ├── widget/                           # Widget tests
│   └── integration/                      # E2E tests
├── pubspec.yaml                          # Dependencies
├── pubspec.lock                          # Locked versions
├── analysis_options.yaml                 # Lint rules
├── README.md                             # Project README
└── ARCHITECTURE.md                       # This file
```

## State Management: Riverpod

Riverpod is modern, reactive, and works perfectly with Material Design 3 theming.

### Example: Auth Provider
```dart
// lib/providers/auth_provider.dart

final authTokenProvider = StateProvider<String?>((ref) => null);

final authProvider = FutureProvider<User?>((ref) async {
  final apiService = ref.watch(apiServiceProvider);
  final token = ref.watch(authTokenProvider);
  
  if (token == null) return null;
  
  final response = await apiService.get(
    '/api/v2/user/me',
    headers: {'Authorization': 'Bearer $token'},
  );
  
  return User.fromJson(response);
});
```

### Example: Scrobble Provider (Local Queue + Sync)
```dart
// lib/providers/scrobble_provider.dart

final scrobbleQueueProvider = StateProvider<List<Scrobble>>((ref) => []);

final syncScrobblesProvider = FutureProvider<void>((ref) async {
  final queue = ref.watch(scrobbleQueueProvider);
  final apiService = ref.watch(apiServiceProvider);
  
  if (queue.isEmpty) return;
  
  await apiService.post(
    '/api/v2/scrobbles/batch-upsert',
    data: { 'scrobbles': queue },
  );
  
  ref.read(scrobbleQueueProvider.notifier).state = [];
});
```

## Material Design 3 Theme

### Color System
```dart
// lib/config/theme_config.dart

final themeData = ThemeData(
  useMaterial3: true,  // Enable MD3
  colorScheme: ColorScheme(
    brightness: Brightness.light,
    primary: Color(0xFF6200EE),
    onPrimary: Color(0xFFFFFFFF),
    secondary: Color(0xFF03DAC6),
    onSecondary: Color(0xFF000000),
    tertiary: Color(0xFF018786),
    onTertiary: Color(0xFFFFFFFF),
    error: Color(0xFFB3261E),
    onError: Color(0xFFFFFFFF),
    background: Color(0xFFFFFBFE),
    onBackground: Color(0xFF1C1B1F),
    surface: Color(0xFFFFFBFE),
    onSurface: Color(0xFF1C1B1F),
  ),
  typography: Typography.material2021(),
  
  // Card styling
  cardTheme: CardTheme(
    elevation: 1,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  ),
  
  // AppBar styling
  appBarTheme: AppBarTheme(
    elevation: 0,
    backgroundColor: Colors.transparent,
    foregroundColor: Colors.black,
  ),
);
```

### Using Theme Colors
```dart
// In widgets
Container(
  color: Theme.of(context).colorScheme.primary,  // Spotify Green
  child: Text(
    'Now Playing',
    style: Theme.of(context).textTheme.headlineSmall,
  ),
)
```

## Client-Side Scrobble Detection

### Algorithm
```
1. User plays track (40% OR ≥30s)
2. Local queue: Add to Hive
3. Every 30s OR on background: Batch sync via API
4. Server: Upsert scrobbles, update stats
5. Device: Store in SQLite archive
```

### Implementation
```dart
// lib/services/scrobble_service.dart

class ScrobbleService {
  // Listen to Spotify playback updates
  void startListening() {
    spotifyPlaybackStream.listen((playback) {
      final progress = playback.progressMs / playback.durationMs;
      
      // Scrobble threshold
      if (progress >= 0.4 || playback.progressMs >= 30000) {
        queueScrobble(playback);
      }
    });
  }
  
  void queueScrobble(Playback playback) {
    final scrobble = Scrobble(
      spotifyId: playback.trackId,
      trackName: playback.trackName,
      // ... other fields
      playedAt: DateTime.now()
        .subtract(Duration(milliseconds: playback.progressMs)),
    );
    
    hiveBox.add(scrobble);  // Local queue
    scheduleSyncIfNeeded();
  }
}
```

## Smart Polling

### Strategy
```
Check Points:
- New track: 5s
- 5-15s window: 15s (catch early skips)
- Before 50%: at 50% mark
- After 50%: at 60% mark
- Near end: 1-3s before end

Safety: Min 5s, Max 30s
```

### Implementation
```dart
// lib/services/polling_service.dart

Duration calculateNextCheck(Duration progress, Duration duration) {
  final progressPercent = progress.inMilliseconds / duration.inMilliseconds;
  
  if (progressPercent < 0.05) {
    return Duration(seconds: 5);
  } else if (progressPercent < 0.25) {
    return Duration(seconds: 15);
  } else if (progressPercent < 0.5) {
    return Duration(milliseconds: (0.5 * duration.inMilliseconds - progress.inMilliseconds).toInt());
  } else {
    return Duration(seconds: 30);
  }
}
```

## Storage Architecture

### Local Storage: Hive (Key-Value)
```dart
// User preferences, auth tokens
await Hive.initFlutter();
final box = await Hive.openBox('user_prefs');
box.put('authToken', token);
box.put('userId', userId);
box.put('refreshToken', refreshToken);
```

### Local Storage: SQLite (Relational)
```dart
// Full scrobble archive (all-time history)
final db = await openDatabase('scrobbles.db');
await db.execute('''
  CREATE TABLE scrobbles (
    id INTEGER PRIMARY KEY,
    spotifyId TEXT,
    trackName TEXT,
    artistName TEXT,
    playedAt INTEGER,
    isScrobbled INTEGER
  )
''');
```

### Cloud Storage: MongoDB (via Backend API)
```dart
// Recent 90 days stored in cloud
// Device pulls and archives >83 days
GET  /api/v2/scrobbles/recent
POST /api/v2/scrobbles/batch-upsert
GET  /api/v2/scrobbles/archive-ready
```

## Deep Linking & OAuth Redirect

### Android Configuration
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.ratesangeet" android:host="callback" />
  </intent-filter>
</activity>
```

### iOS Configuration
```
<!-- ios/Runner/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ratesangeet</string>
    </array>
  </dict>
</array>
```

### Handling Redirect
```dart
// lib/utils/deep_link_handler.dart

void setupDeepLinkListener(BuildContext context) {
  uni_links.deepLinkStream.listen((String? link) {
    if (link != null) {
      final uri = Uri.parse(link);
      if (uri.scheme == 'ratesangeet' && uri.host == 'callback') {
        final code = uri.queryParameters['code'];
        final state = uri.queryParameters['state'];
        
        // Exchange code for token
        ref.read(authProvider.notifier).exchangeCode(code, state);
      }
    }
  });
}
```

## Performance Considerations

### Image Caching
```dart
CachedNetworkImage(
  imageUrl: albumArt,
  placeholder: (context, url) => Skeleton(),
  cacheManager: CacheManager(
    Config(
      'albumArt',
      stalePeriod: Duration(days: 30),
      maxNrOfCacheObjects: 100,
    ),
  ),
)
```

### Pagination
```dart
final recentScrobblesProvider = FutureProvider.autoDispose
    .family<List<Scrobble>, int>((ref, page) async {
  final limit = 20;
  final before = calculateCursor(page);
  
  final response = await apiService.get(
    '/api/v2/scrobbles/recent?limit=$limit&before=$before',
  );
  
  return (response as List).map((json) => Scrobble.fromJson(json)).toList();
});
```

### Lazy Loading
```dart
ListView.builder(
  itemCount: scrobbles.length + 1,
  itemBuilder: (context, index) {
    if (index == scrobbles.length) {
      return ElevatedButton(
        onPressed: () => ref.refresh(recentScrobblesProvider(page + 1)),
        child: Text('Load More'),
      );
    }
    return ScrobbleTile(scrobbles[index]);
  },
)
```

## Testing

### Unit Tests
```dart
// test/services/scrobble_service_test.dart
test('scrobble threshold at 40%', () {
  final result = calculateScrobbleThreshold(
    progressMs: 60000,
    durationMs: 150000,
  );
  expect(result, true);  // 60/150 = 40%
});
```

### Widget Tests
```dart
// test/widgets/wavy_progress_indicator_test.dart
testWidgets('WavyProgressIndicator renders correctly', (tester) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: WavyProgressIndicator(value: 0.65),
      ),
    ),
  );
  
  expect(find.byType(WavyProgressIndicator), findsOneWidget);
});
```

## Deployment Checklist

- [ ] Configure Spotify API credentials
- [ ] Set backend URL in `api_config.dart`
- [ ] Configure deep linking (Android + iOS)
- [ ] Add app icons and splash screens
- [ ] Review Material Design 3 theme colors
- [ ] Test on multiple devices (phones, tablets)
- [ ] Set up Firebase Analytics (optional)
- [ ] Build APK/IPA files
- [ ] Submit to Play Store / App Store

## References

- [Flutter Material Design 3](https://flutter.dev/docs/development/ui/material)
- [Riverpod Documentation](https://riverpod.dev)
- [Material Design 3 Guidelines](https://m3.material.io)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
