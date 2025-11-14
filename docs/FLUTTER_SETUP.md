# Flutter Project Setup Guide

## Step-by-Step Flutter Project Creation

### 1. Install Flutter

```bash
# Download Flutter SDK (if not already installed)
# Visit https://flutter.dev/docs/get-started/install

# Verify installation
flutter --version
flutter doctor  # Check for any issues
```

### 2. Create Flutter Project

```bash
# Create new Flutter project
flutter create ratesangeet

cd ratesangeet
```

### 3. Update `pubspec.yaml`

Replace dependencies with:

```yaml
name: ratesangeet
description: Spotify Music Tracker - Track, rate, and review your music
publish_to: 'none'

version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter

  # State Management
  riverpod: ^2.5.0
  flutter_riverpod: ^2.5.0

  # HTTP & API
  dio: ^5.3.0
  retrofit: ^4.0.0

  # Local Storage
  hive: ^2.2.0
  hive_flutter: ^1.1.0
  sqflite: ^2.3.0
  path: ^1.8.0

  # Spotify Auth
  uni_links: ^0.0.2
  url_launcher: ^6.2.0

  # UI & Components
  flutter_svg: ^2.0.0
  cached_network_image: ^3.3.0
  intl: ^0.18.0
  
  # Logging
  logger: ^2.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter

  flutter_lints: ^3.0.0
  riverpod_generator: ^2.3.0
  build_runner: ^2.4.0

flutter:
  uses-material-design: true
```

### 4. Create Project Structure

```bash
# Create directories
mkdir -p lib/{config,models,providers,screens,widgets,services,utils}
mkdir -p test/{unit,widget}
```

### 5. Create Core Files

#### `lib/main.dart` - Entry Point
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/theme_config.dart';

void main() {
  runApp(
    ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RateSangeet',
      theme: buildMaterial3Theme(),
      home: SplashScreen(),
    );
  }
}

class SplashScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FlutterLogo(size: 100),
            SizedBox(height: 16),
            Text(
              'RateSangeet',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            Text('Track, Rate, Review Music'),
          ],
        ),
      ),
    );
  }
}
```

#### `lib/config/theme_config.dart` - Material Design 3 Theme
```dart
import 'package:flutter/material.dart';

ThemeData buildMaterial3Theme() {
  return ThemeData(
    useMaterial3: true,
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
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
    
    // AppBar styling
    appBarTheme: AppBarTheme(
      elevation: 0,
      backgroundColor: Colors.transparent,
      foregroundColor: Colors.black,
      centerTitle: false,
    ),
    
    // Button styling
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ),
  );
}
```

#### `lib/config/api_config.dart` - Backend Configuration
```dart
class ApiConfig {
  // Backend URL (change for production)
  static const String baseUrl = 'http://localhost:5000/api/v2';
  
  // Spotify OAuth
  static const String spotifyClientId = 'YOUR_SPOTIFY_CLIENT_ID';
  static const String redirectUri = 'ratesangeet://callback';
  
  // API timeouts
  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
```

#### `lib/models/track.dart` - Data Model
```dart
import 'package:json_annotation/json_annotation.dart';

part 'track.g.dart';

@JsonSerializable()
class Track {
  final String spotifyId;
  final String trackName;
  final String artistName;
  final String albumName;
  final String? albumArt;
  final int durationMs;
  final DateTime playedAt;
  final bool isScrobbled;

  Track({
    required this.spotifyId,
    required this.trackName,
    required this.artistName,
    required this.albumName,
    this.albumArt,
    required this.durationMs,
    required this.playedAt,
    required this.isScrobbled,
  });

  factory Track.fromJson(Map<String, dynamic> json) => _$TrackFromJson(json);
  Map<String, dynamic> toJson() => _$TrackToJson(this);
}
```

### 6. Install Dependencies

```bash
flutter pub get
flutter pub run build_runner build  # Generate JSON serialization
```

### 7. Configure Android Deep Linking

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<activity android:name=".MainActivity"
  android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>
  
  <!-- Deep linking for OAuth callback -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.ratesangeet" android:host="callback" />
  </intent-filter>
</activity>
```

### 8. Configure iOS Deep Linking

Edit `ios/Runner/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.ratesangeet</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ratesangeet</string>
    </array>
  </dict>
</array>
```

### 9. Run App

```bash
# Android
flutter run -d android

# iOS (requires Mac)
flutter run -d ios

# Web (optional)
flutter run -d chrome
```

## Next Steps

1. ✅ Implement Riverpod providers
2. ✅ Create screens (Login, Home, etc.)
3. ✅ Integrate Spotify OAuth flow
4. ✅ Build Material 3 UI components
5. ✅ Add local storage (Hive + SQLite)
6. ✅ Implement smart scrobbling
7. ✅ Deploy to Play Store / App Store

## Useful Commands

```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter run

# Generate build runner (JSON serialization, Riverpod)
flutter pub run build_runner build --delete-conflicting-outputs

# Format code
dart format .

# Analyze code
flutter analyze

# Run tests
flutter test

# Build release APK
flutter build apk --release

# Build release IPA
flutter build ipa --release
```

## Common Issues

### Flutter SDK not found
```bash
# Add Flutter to PATH (replace with your path)
export PATH="$PATH:/path/to/flutter/bin"
```

### Gradle build fails
```bash
# Upgrade gradle
cd android
./gradlew --version
# Update android/build.gradle gradle version
```

### Deep linking not working
- Double-check `AndroidManifest.xml` for scheme
- Double-check `Info.plist` for URL schemes
- Ensure Spotify has correct redirect URI

---

**Questions?** Check [docs/FLUTTER_MD3_GUIDE.md](../FLUTTER_MD3_GUIDE.md)
