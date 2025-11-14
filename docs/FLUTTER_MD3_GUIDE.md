# RateSangeet - Flutter + Material Design 3

## Project Vision
A mobile music tracking application (like Letterboxd for Spotify) where users track, rate, and review songs/albums using **Flutter** with **Material Design 3**.

## Tech Stack
- **Frontend**: Flutter 3.x + Dart + Material Design 3 (Google's latest design system)
- **Backend**: Node.js + Express.js + TypeScript (Headless API)
- **Database**: MongoDB Atlas (cloud) + local SQLite (device archive)
- **Auth**: Spotify OAuth 2.0 + JWT tokens
- **State Management**: Riverpod (modern, reactive state management)
- **Storage**: Hive (local key-value) + sqflite (local relational database)

## Architecture

### **Backend (Headless - No UI)**
```
https://ratesangeet.onrender.com/api/v2/
├── POST /auth/callback           (OAuth token exchange)
├── GET  /scrobbles/recent        (recent tracks)
├── POST /scrobbles/batch-upsert  (sync scrobbles)
├── GET  /stats/summary           (user stats)
├── GET  /stats/top-albums        (top albums)
└── GET  /stats/top-tracks        (top tracks)
```

### **Flutter Frontend**
```
flutter_app/
├── lib/
│   ├── main.dart
│   ├── config/
│   │   └── api_config.dart       (backend URL config)
│   ├── models/
│   │   ├── track.dart
│   │   ├── album.dart
│   │   └── user.dart
│   ├── providers/                (Riverpod state management)
│   │   ├── auth_provider.dart
│   │   ├── scrobble_provider.dart
│   │   └── stats_provider.dart
│   ├── screens/
│   │   ├── login_screen.dart
│   │   ├── home_screen.dart
│   │   ├── album_detail_screen.dart
│   │   ├── search_screen.dart
│   │   └── profile_screen.dart
│   ├── widgets/
│   │   ├── wavy_progress_indicator.dart
│   │   ├── now_playing_card.dart
│   │   └── custom_widgets.dart
│   └── services/
│       ├── spotify_service.dart
│       ├── api_service.dart
│       └── local_storage_service.dart
├── android/                      (Android platform)
├── ios/                          (iOS platform)
├── web/                          (Web support - optional)
├── pubspec.yaml                  (dependencies)
└── README.md
```

## Material Design 3 in Flutter

Material Design 3 is built-in to Flutter's Material package. Key components:
- **Buttons**: `ElevatedButton`, `OutlinedButton`, `TextButton`
- **Cards**: `Card` with Material 3 theming
- **AppBar**: Material 3 AppBar with surface-level styling
- **BottomNavigationBar**: Material 3 navigation bar
- **Progress Indicators**: `LinearProgressIndicator`, custom `WavyProgressIndicator`
- **Colors**: Use `ColorScheme` for Material 3 color system
- **Typography**: Use `TextTheme` for Material 3 typography

### Theme Configuration
```dart
ThemeData(
  useMaterial3: true,  // Enable Material Design 3
  colorScheme: ColorScheme(
    brightness: Brightness.light,
    primary: Color(0xFF6200EE),
    onPrimary: Color(0xFFFFFFFF),
    secondary: Color(0xFF03DAC6),
    onSecondary: Color(0xFF000000),
  ),
  typography: Typography.material2021(),
)
```

## Key Features

### 1. **Client-Side Scrobble Detection**
- Threshold: 40% of track OR ≥30s played
- Queue locally using Hive
- Batch sync every 30s or on app background

### 2. **Smart Polling**
- Strategic check points: 5s, 15s, 50%, 60%, track end
- Min 5s, max 30s intervals
- Reduces API calls by 90%

### 3. **Hybrid Storage**
- Cloud (MongoDB): Recent 90 days
- Local (SQLite): Full archive on device
- Auto-archive: Move old data to local storage

### 4. **Material Design 3 UI**
- Wavy progress indicator (custom widget)
- Rounded cards with shadows (8dp border radius)
- Material 3 color system (default static ColorScheme)
- Smooth animations (Emphasized Decelerate 400ms, Standard 300ms)

### 5. **Rating & Reviews**
- 1-5 star or 1-10 scale rating
- Write reviews with markdown support
- Threaded comments on reviews

## Flutter Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  # State Management
  riverpod: ^2.5.0
  flutter_riverpod: ^2.5.0
  # HTTP & API
  dio: ^5.3.0
  # Local Storage
  hive: ^2.2.0
  hive_flutter: ^1.1.0
  sqflite: ^2.3.0
  # Spotify Auth
  uni_links: ^0.0.2
  # UI
  flutter_svg: ^2.0.0
  cached_network_image: ^3.3.0
  # Others
  intl: ^0.18.0
  share_plus: ^7.2.0
```

## Getting Started

### Prerequisites
- Flutter 3.x SDK
- Android Studio + Android SDK (for Android)
- Xcode (for iOS)
- Spotify Developer Account
- Backend running: `https://ratesangeet.onrender.com`

### Setup

1. **Create Flutter Project**
```bash
flutter create ratesangeet
cd ratesangeet
```

2. **Install Dependencies**
```bash
flutter pub get
```

3. **Configure Spotify OAuth**
- Add redirect URIs in Spotify Dashboard:
  - `com.ratesangeet://callback` (Android)
  - `ratesangeet://callback` (iOS/Universal Links)

4. **Run App**
```bash
# Debug (Android)
flutter run -d android

# Release (Android)
flutter build apk --release

# iOS
flutter run -d ios
flutter build ipa --release
```

## API Integration

### Example: Fetch Recent Scrobbles
```dart
final recentScrobblesProvider = FutureProvider<List<Track>>((ref) async {
  final apiService = ref.watch(apiServiceProvider);
  final response = await apiService.get('/scrobbles/recent?limit=10');
  return (response as List).map((json) => Track.fromJson(json)).toList();
});
```

### Example: Batch Upsert Scrobbles
```dart
await apiService.post(
  '/scrobbles/batch-upsert',
  data: {
    'scrobbles': [
      {
        'spotifyId': 'track123',
        'trackName': 'Song Name',
        'artistName': 'Artist',
        'isScrobbled': true,
        'playedAt': DateTime.now().toIso8601String(),
      }
    ]
  },
);
```

## Material Design 3 Components

### Wavy Progress Indicator
```dart
WavyProgressIndicator(
  value: 0.65,
  color: Colors.green,
  backgroundColor: Colors.grey[200],
  height: 8,
)
```

### Now Playing Card
```dart
NowPlayingCard(
  track: track,
  progress: Duration(seconds: 45),
  duration: Duration(minutes: 3),
  onRate: () => navigateToReview(),
)
```

## Storage Strategy

### Local (Hive Key-Value)
```dart
final box = Hive.box('user_prefs');
box.put('authToken', token);
box.put('userId', userId);
```

### Local (SQLite Relational)
```dart
await db.insert(
  'scrobbles',
  {
    'spotifyId': 'track123',
    'trackName': 'Song',
    'playedAt': DateTime.now().millisecondsSinceEpoch,
  },
);
```

### Cloud (MongoDB via Backend API)
```dart
// All requests go through backend (headless)
GET  /api/v2/scrobbles/recent
POST /api/v2/scrobbles/batch-upsert
GET  /api/v2/stats/summary
```

## Authentication Flow

1. **User taps Login** → Opens Spotify OAuth in browser
2. **Redirect to `ratesangeet://callback?code=XXX&state=YYY`**
3. **Flutter app captures redirect** (universal links/deep linking)
4. **Client exchanges code for token**:
   ```
   POST /auth/callback
   Body: { code, state, codeVerifier }
   Response: { accessToken, refreshToken }
   ```
5. **Store JWT locally** (Hive)
6. **Use JWT for all API calls** (Authorization: Bearer token)

## Deployment

### Android
```bash
flutter build apk --release
# Upload to Google Play Console
```

### iOS
```bash
flutter build ipa --release
# Upload to App Store via Xcode or Fastlane
```

### Web (Optional)
```bash
flutter build web --release
# Deploy to Firebase Hosting or any web host
```

## Performance Optimization

- **Smart Polling**: 90% fewer API calls
- **Local Caching**: Hive for user prefs, SQLite for scrobbles
- **Image Caching**: `cached_network_image`
- **Lazy Loading**: Load screens on-demand
- **Pagination**: Default limit=20, max=100

## Testing

```bash
# Run tests
flutter test

# Integration tests (device required)
flutter drive --target=test_driver/app.dart
```

## Troubleshooting

### OAuth Redirect Not Working
- Ensure Spotify Dashboard has correct redirect URIs
- Check deep linking configuration in `AndroidManifest.xml` and `Info.plist`

### Database Errors
- Clear Hive box: `await Hive.box('prefs').clear()`
- Reset SQLite: Delete app data from device settings

### API Connection Issues
- Check backend is running: `curl http://localhost:5000/ping`
- Verify API URL in `api_config.dart`
- Check JWT token expiration

## Next Steps

1. ✅ Initialize Flutter project
2. ✅ Set up Riverpod state management
3. ✅ Implement Spotify OAuth flow
4. ✅ Create screens (Login, Home, Album Detail, Profile)
5. ✅ Implement Material Design 3 UI
6. ✅ Build custom WavyProgressIndicator
7. ✅ Add local storage (Hive + SQLite)
8. ✅ Implement smart polling
9. ✅ Deploy to Play Store / App Store
