# Spotify decided to fuck devs , changed the policy for API (making only premium user can use API ) , and this project goes to unfinished list. 

## i treid my best , even i made the most of the app but in react, i wanted it in jetpack compose .. but couldnt , hence ... bye bye 

# 🎵 RateSangeet - Spotify Music Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/Code%20of-Conduct-blue.svg?style=for-the-badge)](CODE_OF_CONDUCT.md)

> 🎯 **FLUTTER + MATERIAL DESIGN 3** - Track, rate, and review every song you listen to on Spotify. Built with **Flutter**, **Material Design 3**, and **Riverpod** state management.

A mobile music tracking application like Letterboxd but for Spotify. Track, rate, and review songs, albums, and singles. Built with **Flutter** + **Material Design 3** and powered by a headless **Node.js/Express** backend.

> **🌟 This is an open-source project!** We welcome contributions from the community. Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

> **📚 Hybrid Storage**: Cloud (MongoDB, 90-day retention) + Local (SQLite device archive). See [docs/02-architecture/HYBRID_STORAGE.md](docs/02-architecture/HYBRID_STORAGE.md)

## ✨ Features

- 🔐 **Spotify OAuth Authentication** - Secure login with your Spotify account (RFC 7636 PKCE)
- 🎧 **Smart Scrobble Detection** - Client-side detection (40% played or ≥30s) with batch sync
- ⭐ **Rate & Review** - Rate songs/albums on 1-5 or 1-10 scale with Material Design 3 UI
- 📝 **Write Reviews** - Add personal notes and thoughts about tracks
- 📊 **Smart Statistics** - View listening stats with incremental loading
- 🔍 **Search** - Find and add any song or album from Spotify's catalog
- 💾 **Hybrid Storage** - Cloud (90-day) + Device Archive (SQLite local storage)
- 📱 **Native Mobile App** - Android (APK) & iOS (via Xcode build)
- 🎨 **Material Design 3** - Google's latest design system with default static theme
- ⚡ **Smart Polling** - 90% reduction in API calls (dynamic intervals based on playback state)
- 🔄 **Album Completion** - Track album progress (4+ tracks, 70% unique = completion)

## 📚 Documentation

**[→ Complete Flutter Documentation](docs/README_FLUTTER.md)** | [Architecture](docs/FLUTTER_ARCHITECTURE.md) | [Setup Guide](docs/FLUTTER_SETUP.md)

**Documentation Index:**

1. **[Flutter Guide](docs/README_FLUTTER.md)** - Features, tech stack, screens overview, Material Design 3
2. **[Flutter Architecture](docs/FLUTTER_ARCHITECTURE.md)** - Project structure, Riverpod patterns, storage, auth flow
3. **[Flutter Setup](docs/FLUTTER_SETUP.md)** - Step-by-step project creation and configuration
4. **[Design System](docs/04-design/)** - Material Design 3 with default static theme
5. **[Hybrid Storage](docs/02-architecture/HYBRID_STORAGE.md)** - Cloud + Local archive strategy
6. **[Smart Scrobbling](docs/02-architecture/SMART_SCROBBLE_ALGORITHM.md)** - Client-side detection logic
7. **[Backend API](docs/02-architecture/PROJECT_SUMMARY.md)** - REST endpoints documentation

## 🏗️ Project Structure

```
ratesangeet/
├── flutter_app/         # Flutter mobile app (MAIN - to be created)
│   ├── lib/
│   │   ├── config/          # API & theme configuration
│   │   ├── models/          # Data classes (Track, Album, Review)
│   │   ├── providers/       # Riverpod state management
│   │   ├── screens/         # UI screens (Login, Home, Album, Profile)
│   │   ├── widgets/         # Reusable components (WavyProgressIndicator, Card)
│   │   ├── services/        # API client, auth service, storage
│   │   └── main.dart        # Entry point
│   ├── android/         # Deep linking & gradle config
│   ├── ios/             # Deep linking & Xcode config
│   └── pubspec.yaml     # Dependencies (Riverpod, Dio, Hive, sqflite)
│
├── server/              # Node.js/Express backend (HEADLESS API)
│   ├── src/
│   │   ├── models/      # MongoDB schemas
│   │   ├── routes/      # REST API endpoints (/api/v2/*)
│   │   ├── middleware/  # JWT auth, rate limit, gzip
│   │   ├── jobs/        # Background tasks (archive, cleanup)
│   │   └── index.ts     # Server entry (port 5000)
│   ├── package.json
│   └── .env.example
│
├── docs/                # Project documentation
│   ├── README_FLUTTER.md         # Flutter overview & features
│   ├── FLUTTER_ARCHITECTURE.md   # Technical architecture
│   ├── FLUTTER_SETUP.md          # Step-by-step setup
│   ├── FLUTTER_MD3_GUIDE.md      # Material Design 3 guide
│   ├── 02-architecture/          # System design docs
│   ├── 04-design/                # Design system & theme
│   ├── 05-authentication/        # OAuth & PKCE flow
│   └── 07-improvements/          # Past enhancements
│
├── mobile/              # [ARCHIVED] Old React Native (Expo)
├── web/                 # [ARCHIVED] Old MUI web app
└── README.md            # This file
```

## 🚀 Getting Started (Flutter)

### Prerequisites

- **Flutter SDK** (3.x or higher) - [Install here](https://flutter.dev/docs/get-started/install)
- **Dart SDK** (included with Flutter)
- **Android Studio** + Android SDK (for Android)
- **Xcode** (for iOS on Mac)
- **Node.js** (v16+) - for backend server
- **MongoDB Atlas** account (cloud) or local MongoDB
- **Spotify Developer Account** - [Create here](https://developer.spotify.com/dashboard)

### 1. Clone Repository & Set Up Backend

```bash
# Clone project
git clone <repo-url>
cd ratesangeet

# Install backend dependencies
cd server
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit .env with Spotify OAuth credentials and MongoDB URI
```

### 2. Create Flutter Project

```bash
# Create Flutter app (or open existing Flutter folder)
flutter create flutter_app
cd flutter_app

# Or use provided structure from docs/FLUTTER_SETUP.md
```

### 3. Configure Flutter App

```bash
# Add dependencies
flutter pub get

# Generate code (JSON serialization, Riverpod)
flutter pub run build_runner build --delete-conflicting-outputs
```

Edit `lib/config/api_config.dart`:
```dart
class ApiConfig {
  static const String baseUrl = 'http://YOUR_LOCAL_IP:5000/api/v2';
  static const String spotifyClientId = 'YOUR_SPOTIFY_CLIENT_ID';
  static const String redirectUri = 'ratesangeet://callback';
}
```

### 4. Configure Deep Linking

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="ratesangeet" android:host="callback" />
</intent-filter>
```

**iOS** (`ios/Runner/Info.plist`):
```xml
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

### 5. Start Backend Server

```bash
cd server
npm run dev  # Runs on http://localhost:5000
```

### 6. Run Flutter App

```bash
# Terminal 2 - in flutter_app folder
flutter run

# Or specify device
flutter run -d android       # Android emulator
flutter run -d ios           # iOS simulator
flutter run -d chrome        # Web browser
```

### 7. Log In with Spotify

1. Open app → tap "Login with Spotify"
2. Authenticate with your Spotify account
3. Grant permissions (scrobble detection, offline)
4. Redirect back to app

✅ **Done!** You're now tracking music.

### 3. Configure Environment Variables

**Backend** (`server/.env`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ratesangeet

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/api/auth/callback

# Rate limiting & caching
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Archive settings
SCROBBLES_TTL_DAYS=90
ARCHIVE_KEEP_RECENT=200
```

**See [docs/FLUTTER_SETUP.md](docs/FLUTTER_SETUP.md) for complete setup instructions.**

## 📱 Building & Deployment

### Build for Android

```bash
# Debug APK (for testing)
flutter build apk --debug

# Release APK (optimized)
flutter build apk --release

# Or use EAS Build (Expo services)
eas build --platform android --profile production
```

### Build for iOS (Mac Only)

```bash
# Debug
flutter run -d ios

# Release for App Store
flutter build ipa --release
```

### Deploy Backend to Render

```bash
# Push to GitHub
git add .
git commit -m "Flutter migration + Material Design 3"
git push origin main

# Render auto-deploys from main branch
# Check: https://ratesangeet.onrender.com/api/v2/stats/summary
```

## 🛠️ Tech Stack

### Flutter Frontend
- **Flutter 3.x** - UI framework with Material Design 3 built-in
- **Dart** - Programming language
- **Riverpod 2.x** - Reactive state management (no Provider package)
- **Dio** - HTTP client for REST API calls
- **Hive** - Local key-value storage (auth tokens, preferences)
- **SQLite** (sqflite) - Device archive for full scrobble history
- **uni_links** - Deep linking for OAuth redirect
- **Material Design 3** - Google's latest design system with default static theme

### Backend API (Headless)
- **Node.js** with **Express** - REST API server
- **TypeScript** - Type safety
- **MongoDB Atlas** - Cloud database (90-day scrobble retention)
- **Mongoose** - Database ORM
- **Spotify Web API** - Music data & OAuth
- **JWT** - Secure authentication
- **Render** - Cloud deployment

## 📚 API Endpoints (v2 - Minimal Payloads)

### Authentication
- `GET /api/v2/auth/login` - Get Spotify authorization URL
- `POST /api/v2/auth/callback` - Handle OAuth callback
- `POST /api/v2/auth/refresh` - Refresh JWT token

### Scrobbles & Stats
- `POST /api/v2/scrobbles/batch-upsert` - Batch sync scrobbles (max 100)
- `GET /api/v2/scrobbles/recent` - Get recent scrobbles with pagination
- `GET /api/v2/scrobbles/archive-ready` - Get scrobbles ready for device archive
- `POST /api/v2/scrobbles/ack-archive` - Acknowledge archived scrobbles
- `GET /api/v2/stats/summary` - User statistics summary
- `GET /api/v2/stats/top-albums` - Top albums by play count
- `GET /api/v2/stats/top-tracks` - Top tracks by play count

### Music Data
- `GET /api/v2/track/:id` - Get track details
- `GET /api/v2/album/:id` - Get album details
- `GET /api/v2/artist/:id` - Get artist details
- `GET /api/v2/credits/:trackId` - Get track credits

### Reviews & Ratings
- `POST /api/v2/reviews` - Create review
- `GET /api/v2/reviews/:id` - Get review
- `PUT /api/v2/reviews/:id` - Update review
- `DELETE /api/v2/reviews/:id` - Delete review

**All endpoints return minimal JSON (typically <30KB) with automatic gzip compression & ETag caching.**

See [Backend API Spec](docs/02-architecture/PROJECT_SUMMARY.md) for full documentation.

## 🎨 Material Design 3 Screens

1. **Login Screen** - Spotify OAuth with deep linking redirect
2. **Home Screen** - Now playing card with wavy progress indicator, stats summary, recent scrobbles
3. **Album Detail** - Album art, tracks, completion progress (4+ tracks, 70% = complete)
4. **Search Screen** - Search Spotify catalog, add to track list
5. **Profile Screen** - User stats, top albums/tracks, account settings
6. **Review Screen** - Rate (1-5 stars) and review tracks/albums
7. **History Screen** - Full listening history with pagination

**All screens use Material Design 3 components with default static theme.**

## 🐛 Troubleshooting

### "Cannot connect to server"
- Verify backend is running: `curl http://localhost:5000/api/v2/stats/summary`
- Use your machine's local IP in Flutter config (not localhost)
- Check firewall settings

### "Spotify redirect URI mismatch"
- Ensure Spotify Dashboard has exact redirect URI: `ratesangeet://callback`
- Verify deep linking is configured in AndroidManifest.xml and Info.plist
- Check that app scheme matches config

### "MongoDB connection error"
- Verify MongoDB Atlas credentials in `server/.env`
- Check network access is allowed from your IP
- Test connection: `mongosh "mongodb+srv://user:pass@..."`

### "Flutter build fails"
- Run `flutter clean` and `flutter pub get`
- Check Android SDK is installed: `flutter doctor`
- For iOS: `cd ios && pod install && cd ..`

### "Deep linking not working"
- Android: Rebuild app (not just hot reload): `flutter run --no-fast-start`
- iOS: Rebuild app on device
- Test with: `adb shell am start -W -a android.intent.action.VIEW -d "ratesangeet://callback"`

See [FLUTTER_SETUP.md](docs/FLUTTER_SETUP.md) for more solutions.

## 📊 Architecture Overview

### Hybrid Storage Model
```
Spotify API ← Flutter App → Backend API
              ↓              ↓
           SQLite       MongoDB Atlas
         (Local, all)  (Cloud, 90 days)
           ↓                ↓
        Device         Recent Data
      (Permanent)     (Rotating)
```

### Client-Side Scrobble Detection
```
Spotify Playback
  ↓
Check: (progressMs / durationMs >= 0.4) OR (progressMs >= 30s)?
  ↓ YES
Queue locally (batch every 30s)
  ↓
POST /api/v2/scrobbles/batch-upsert
  ↓
Server: Dedup + Album Logic + Stats Update
  ↓
SQLite Archive (local) + MongoDB (cloud)
```

### API Optimization
- **Payload sizes**: <30KB typical, <100KB max
- **Smart polling**: Dynamic intervals based on playback state
- **Caching**: ETag-based caching with gzip compression
- **Rate limiting**: 10/s burst, 100/min per user

See [FLUTTER_ARCHITECTURE.md](docs/FLUTTER_ARCHITECTURE.md) for full technical details.

### Backend (`server/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` or `production` |
| `MONGODB_URI` | MongoDB connection | `mongodb+srv://user:pass@cluster...` |
| `SPOTIFY_CLIENT_ID` | Spotify OAuth ID | From Spotify Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth Secret | From Spotify Dashboard |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `http://127.0.0.1:5000/api/auth/callback` |
| `JWT_SECRET` | JWT signing key | Random secret string |
| `SCROBBLES_TTL_DAYS` | Cloud retention days | `90` |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window | `100` |

### Flutter (`lib/config/api_config.dart`)

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | Backend API URL | `http://192.168.1.100:5000/api/v2` |
| `spotifyClientId` | Spotify Client ID | From Spotify Dashboard |
| `redirectUri` | Deep link scheme | `ratesangeet://callback` |

## � Uptime Monitoring (Render Free Tier)

To keep the Render free tier server awake and avoid 15-minute idle timeouts:

1. **Endpoint**: `GET /ping` returns `"pong"`
2. **Setup UptimeRobot**: 
   - Add monitor: `https://ratesangeet.onrender.com/ping`
   - Interval: 5 minutes (free tier)
3. **Result**: Server stays awake 24/7, no cold starts

📖 **Full guide**: See [`docs/UPTIME_INTEGRATION_SUMMARY.md`](docs/UPTIME_INTEGRATION_SUMMARY.md)

## 📞 Quick Links

- 📘 [Flutter Complete Guide](docs/README_FLUTTER.md)
- 🏗️ [Architecture & Internals](docs/FLUTTER_ARCHITECTURE.md)
- ⚙️ [Step-by-Step Setup](docs/FLUTTER_SETUP.md)
- 📦 [Material Design 3 Details](docs/04-design/)
- 💾 [Hybrid Storage Strategy](docs/02-architecture/HYBRID_STORAGE.md)
- 🔐 [Spotify OAuth Setup](docs/05-authentication/SPOTIFY_SETUP.md)
- 🚀 [Deployment Guide](docs/06-deployment/RENDER_DEPLOYMENT.md)

## 📝 Future Enhancements

- [ ] Social features (follow users, share reviews)
- [ ] Playlist integration
- [ ] Export reviews to PDF/CSV
- [ ] Dark/Light theme toggle
- [ ] Push notifications for new releases
- [ ] Music recommendations based on ratings
- [ ] Year in Review stats

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We love contributions from the community! Whether it's:

- 🐛 **Bug reports** - Help us identify and fix issues
- ✨ **Feature requests** - Share your ideas for improvements
- 📝 **Documentation** - Help others understand the project
- 💻 **Code contributions** - Submit PRs to improve the codebase

**Getting Started:**

1. Read our [Contributing Guide](CONTRIBUTING.md)
2. Check out [Good First Issues](https://github.com/hetcharusat/ratesangeet/labels/good%20first%20issue)
3. Join the [Discussions](https://github.com/hetcharusat/ratesangeet/discussions)

**Quick Setup:**

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/ratesangeet.git
cd ratesangeet

# Install dependencies
cd server && npm install
cd ../mobile && npm install

# Set up environment variables (see CONTRIBUTING.md)
# Start development servers
npm run start:server  # Terminal 1
npm run start:mobile  # Terminal 2
```

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## 📞 Support

For issues or questions:
1. Check the [documentation](docs/INDEX.md)
2. Search existing [issues](https://github.com/hetcharusat/ratesangeet/issues)
3. Join [GitHub Discussions](https://github.com/hetcharusat/ratesangeet/discussions)
4. Create a new issue with details

## 🙏 Acknowledgments

- Spotify Web API for music data
- The open-source community for amazing tools and libraries
- All contributors who help improve this project

---

**Built with ❤️ by the community, for music lovers**

**⭐ Star this repo if you find it useful!**
