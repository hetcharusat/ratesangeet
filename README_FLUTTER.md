# 🎵 RateSangeet - Spotify Music Tracker

**Flutter + Material Design 3 · Track, rate, and review your music on Spotify**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Flutter](https://img.shields.io/badge/Flutter-3.x-blue.svg?style=for-the-badge)](https://flutter.dev)
[![Material Design 3](https://img.shields.io/badge/Material%20Design-3-green.svg?style=for-the-badge)](https://m3.material.io)
[![Backend Status](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-yellow.svg?style=for-the-badge)](https://nodejs.org)

A mobile music tracking application like **Letterboxd for Spotify**. Track, rate, and review songs and albums you listen to.

## 🎯 Quick Overview

```
┌─────────────────────────────────────┐
│   Flutter App (iOS + Android)       │
│   Material Design 3 · Riverpod      │
│   SQLite Archive · Hive Storage     │
└──────────────┬──────────────────────┘
               │ REST API (JWT)
┌──────────────▼──────────────────────┐
│  Node.js Backend (Headless)         │
│  Express · MongoDB · Spotify OAuth  │
│  Cloud: 90-day retention            │
└─────────────────────────────────────┘
```

## ✨ Features

### 🎵 Spotify Integration
- Seamless OAuth 2.0 login
- Real-time now-playing tracking
- Auto-scrobble detection (40% threshold)
- Smart sync: batch upload with 90% fewer API calls

### 🎨 Material Design 3
- Native Flutter Material 3 components
- Custom wavy progress indicator
- Smooth animations (Emphasized Decelerate, Standard)
- Dark/light theme support

### 📊 Smart Stats
- Listening time, scrobble count, unique artists
- Top albums and tracks
- Monthly/yearly breakdowns
- Weekly activity heatmap

### 💾 Hybrid Storage
- **Cloud**: Recent 90 days (MongoDB)
- **Local**: Full archive (SQLite)
- **Preferences**: User settings (Hive)
- Auto-archive of old scrobbles

### ⭐ Rating & Reviews
- 1-5 star or 1-10 scale rating
- Write markdown reviews
- Threaded comments
- Share reviews with friends

## 🛠️ Technology Stack

| Layer | Technology | Why? |
|-------|-----------|------|
| **Frontend** | Flutter 3.x | Cross-platform (iOS/Android), fast development |
| **UI Design** | Material Design 3 | Google's latest design system, built into Flutter |
| **State Mgmt** | Riverpod | Reactive, testable, easy to use |
| **Backend** | Node.js + Express | Headless REST API, easy deployment |
| **Database** | MongoDB + SQLite | Scalable cloud + local archive |
| **Auth** | Spotify OAuth + JWT | Secure, standard approach |

## 📦 Project Structure

```
ratesangeet/
├── flutter_app/                    # Flutter Mobile App
│   ├── lib/
│   │   ├── main.dart              # Entry point
│   │   ├── config/                # API, theme configuration
│   │   ├── models/                # Data classes (Track, Album, User)
│   │   ├── providers/             # Riverpod state management
│   │   ├── screens/               # UI screens
│   │   ├── widgets/               # Reusable Material 3 components
│   │   └── services/              # API, auth, storage
│   ├── android/                   # Android-specific code
│   ├── ios/                       # iOS-specific code
│   ├── pubspec.yaml              # Dependencies
│   └── README.md
├── server/                        # Backend (Headless API)
│   ├── src/
│   │   ├── routes/v2/            # API endpoints (/scrobbles, /stats, etc)
│   │   ├── models/               # MongoDB schemas
│   │   ├── middleware/           # Auth, rate limiting
│   │   └── jobs/                 # Archive, cleanup
│   ├── package.json
│   └── README.md
├── docs/
│   ├── FLUTTER_MD3_GUIDE.md      # ← Start here!
│   ├── FLUTTER_ARCHITECTURE.md   # Deep dive
│   └── Backend docs/
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- **Flutter 3.x** ([Install](https://flutter.dev/docs/get-started/install))
- **Dart** (comes with Flutter)
- **Spotify Developer Account** ([Sign up](https://developer.spotify.com))
- Android Studio (for Android) OR Xcode (for iOS)

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/hetcharusat/ratesangeet.git
   cd ratesangeet
   ```

2. **Start Backend**
   ```bash
   cd server
   npm install
   npm run dev  # Runs on http://localhost:5000
   ```

3. **Setup Flutter**
   ```bash
   cd flutter_app
   flutter pub get
   ```

4. **Configure Spotify**
   - Go to [Spotify Dashboard](https://developer.spotify.com/dashboard)
   - Create app, note Client ID
   - Add redirect URI: `ratesangeet://callback`
   - Update `lib/config/api_config.dart`

5. **Run App**
   ```bash
   # Android
   flutter run -d android
   
   # iOS (requires Mac)
   flutter run -d ios
   ```

## 📱 App Screens

### Login Screen
- Spotify OAuth integration
- PKCE-based authorization flow
- Secure token storage

### Home Screen
- Now playing card (with wavy progress)
- Recent scrobbles
- Stats overview (minutes, count, artists)
- Quick access to search/profile

### Album Detail
- Track list
- Completion progress (70% = album complete)
- Rating/review
- Add to favorites

### Search Screen
- Find tracks, albums, artists
- Browse recommendations
- Add to watchlist

### Profile Screen
- User stats (lifetime, monthly, yearly)
- Top albums and tracks
- Listening history
- Account settings

### Add Review Screen
- Star rating (1-5 or 1-10)
- Markdown text editor
- Spoiler tags
- Share options

## 🎨 Material Design 3 Implementation

Flutter comes with Material 3 built-in. Enable it globally:

```dart
// lib/main.dart
MaterialApp(
  theme: ThemeData(
    useMaterial3: true,  // 🎨 Enable MD3
    colorScheme: ColorScheme.fromSeed(
      seedColor: Color(0xFF1DB954),  // Spotify Green
    ),
  ),
)
```

### Key Components
- **AppBar**: Material 3 elevation and styling
- **Cards**: Rounded corners (12dp), subtle shadows
- **Buttons**: ElevatedButton, OutlinedButton with MD3 shapes
- **Progress**: Custom WavyProgressIndicator widget
- **Navigation**: BottomNavigationBar with Material 3 labels

### Color System
```dart
// Automatic color generation from seed
primary: #1DB954 (Spotify Green)
secondary: Generated from seed
tertiary: Generated from seed
background: Light/dark based on brightness
surface: Card, dialog backgrounds
error: #B3261E
```

## 🔗 Backend API (Headless)

Your backend is completely independent. Flutter app uses REST endpoints only.

### Authentication
```http
POST /auth/callback
Content-Type: application/json
{
  "code": "spotify_auth_code",
  "codeVerifier": "pkce_verifier",
  "state": "random_state"
}
→ { "accessToken": "jwt_token", "refreshToken": "...", "expiresIn": 3600 }
```

### Scrobbles
```http
GET  /api/v2/scrobbles/recent?limit=20
POST /api/v2/scrobbles/batch-upsert
GET  /api/v2/scrobbles/archive-ready
POST /api/v2/scrobbles/ack-archive
```

### Stats
```http
GET /api/v2/stats/summary
GET /api/v2/stats/top-albums?limit=10
GET /api/v2/stats/top-tracks?limit=10
```

See [Backend Documentation](./server/README.md) for complete API spec.

## 💾 Data Storage

### Local Storage (Device)
- **Hive**: User preferences, auth tokens, cached data
- **SQLite**: Full scrobble history (all-time archive)

### Cloud Storage (Backend)
- **MongoDB**: Recent scrobbles (90-day TTL)
- Auto-archive: >83 days old → moved to local SQLite

## 🧠 Smart Scrobbling Algorithm

1. **User plays track**
   ```
   Progress >= 40% OR Time >= 30s → Queue scrobble locally
   ```

2. **Local Processing**
   ```
   Save to Hive queue
   Every 30s or on app background → Batch sync to backend
   ```

3. **Server Processing**
   ```
   Deduplicate by (userId, spotifyId, playedAtRounded10s)
   Update trackStats and albumStats
   Auto-complete album when 70% unique tracks played
   ```

4. **Archive**
   ```
   Device pulls scrobbles >83 days old
   Saves to local SQLite
   Acknowledges server to delete
   ```

## 📊 Performance Optimization

- **Smart Polling**: Strategic check points (5s/15s/50%/60%) = 90% fewer API calls
- **Image Caching**: 30-day TTL with `cached_network_image`
- **Pagination**: Default 20 items, max 100
- **Lazy Loading**: Load screens on-demand via Riverpod

## 🧪 Testing

```bash
# Unit tests
flutter test

# Widget tests
flutter test test/widgets/

# Integration tests
flutter drive --target=test_driver/app.dart

# Coverage report
flutter test --coverage
```

## 🚀 Deployment

### Android
```bash
# Create keystore
keytool -genkey -v -keystore release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias release

# Build release APK
flutter build apk --release

# Upload to Google Play
# Use Play Console: https://play.google.com/console
```

### iOS
```bash
# Build release IPA
flutter build ipa --release

# Upload to App Store
# Use Xcode or Fastlane
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| OAuth redirect fails | Verify `ratesangeet://callback` in Spotify Dashboard |
| Deep linking not working | Check `AndroidManifest.xml` and `Info.plist` |
| Backend connection error | Ensure backend running, check API URL in config |
| Database errors | Clear app data: Settings → Apps → RateSangeet → Storage |

## 📚 Documentation

- **[Flutter + Material Design 3 Guide](./docs/FLUTTER_MD3_GUIDE.md)** ← Start here!
- **[Flutter Architecture](./docs/FLUTTER_ARCHITECTURE.md)** - Complete project details
- **[Backend API](./server/README.md)** - REST endpoints and deployment

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/ratesangeet.git

# 2. Create feature branch
git checkout -b feature/amazing-feature

# 3. Commit changes
git commit -m "Add amazing feature"

# 4. Push and create PR
git push origin feature/amazing-feature
```

## 📝 License

MIT License - See [LICENSE](LICENSE) file

## 🔗 Resources

- [Flutter Docs](https://flutter.dev/docs)
- [Material Design 3](https://m3.material.io)
- [Riverpod](https://riverpod.dev)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)

## 💬 Questions?

- 📖 Check [docs](./docs/) folder
- 🐛 Create an [Issue](https://github.com/hetcharusat/ratesangeet/issues)
- 💬 Start a [Discussion](https://github.com/hetcharusat/ratesangeet/discussions)

---

**Made with ❤️ for music lovers**
