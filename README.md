# 🎵 Spotify Music Tracker

[![Server Status](https://img.shields.io/uptimerobot/status/m797959122-0b3e8e3f5c5c7a0d5f5e5e5e?label=API%20Status&style=for-the-badge)](https://stats.uptimerobot.com/OyUXm4nc9m)
[![Uptime](https://img.shields.io/uptimerobot/ratio/7/m797959122-0b3e8e3f5c5c7a0d5f5e5e5e?label=Uptime&style=for-the-badge)](https://stats.uptimerobot.com/OyUXm4nc9m)

A mobile music tracking application similar to Letterboxd but for Spotify. Track, rate, and review songs, albums, and singles you've listened to. Built with React Native (Expo) and Node.js.

> **Live Status**: [View Server Uptime Dashboard →](https://stats.uptimerobot.com/OyUXm4nc9m)

> Data storage overview: We use a hybrid model (cloud + local). See docs/HYBRID_STORAGE.md for the full specification.

## ✨ Features

- 🔐 **Spotify OAuth Authentication** - Secure login with your Spotify account
- 🎧 **Track Your Music** - View your recently played and top tracks from Spotify
- ⭐ **Rate & Review** - Rate songs and albums on a 1-10 scale
- 📝 **Write Reviews** - Add personal notes and thoughts about tracks
- 📊 **User Dashboard** - View your statistics and listening history
- 🔍 **Search** - Find and add any song or album from Spotify's catalog
- 📱 **Native Mobile App** - Build APK for Android (iOS support included)

## 📚 Documentation

**[→ Browse Complete Documentation](docs/INDEX.md)**

Our documentation is organized into 7 sections for easy navigation:

1. **[Getting Started](docs/01-getting-started/)** - Quickstart, setup checklist, commands
2. **[Architecture](docs/02-architecture/)** - System design, hybrid storage, scrobble algorithm
3. **[Features](docs/03-features/)** - Threaded reviews, caching, uptime monitoring
4. **[Design](docs/04-design/)** - Theme system, color palette
5. **[Authentication](docs/05-authentication/)** - Spotify OAuth setup and PKCE flow
6. **[Deployment](docs/06-deployment/)** - Render deployment guide
7. **[Improvements](docs/07-improvements/)** - Past enhancements and fixes

## 🏗️ Project Structure

```
spotify-tracker/
├── mobile/              # React Native mobile app (Expo)
│   ├── src/
│   │   ├── screens/     # App screens (Login, Home, Search, AddReview)
│   │   ├── navigation/  # React Navigation setup
│   │   ├── context/     # Auth context
│   │   ├── services/    # API service layer
│   │   ├── storage/     # Local SQLite for scrobbles
│   │   ├── utils/       # Helper functions
│   │   └── config/      # App configuration
│   └── App.tsx          # Entry point
├── server/              # Node.js/Express backend API
│   └── src/
│       ├── models/      # MongoDB models (User, Review, AlbumStats, TrackStats)
│       ├── routes/      # API routes (auth, music, reviews, stats)
│       ├── jobs/        # Background jobs (archive scrobbles)
│       └── index.ts     # Server entry point
├── docs/                # Organized documentation (7 sections)
│   ├── INDEX.md         # Documentation homepage
│   ├── 01-getting-started/
│   ├── 02-architecture/
│   ├── 03-features/
│   ├── 04-design/
│   ├── 05-authentication/
│   ├── 06-deployment/
│   └── 07-improvements/
└── package.json         # Root package with helper scripts
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local or MongoDB Atlas)
- **Spotify Developer Account** - [Create one here](https://developer.spotify.com/dashboard)
- **Expo Go** app (for testing on physical device)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd spotiireate
```

### 2. Set Up Spotify API

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Note your **Client ID** and **Client Secret**
4. Add redirect URI: `http://127.0.0.1:5000/api/auth/callback` (⚠️ Must use `127.0.0.1`, NOT `localhost`)

### 3. Configure Environment Variables

Create `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your credentials:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/spotify-tracker
SESSION_SECRET=your-super-secret-session-key-change-this

# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/api/auth/callback

# For mobile development
CLIENT_URL=http://127.0.0.1:8081
```

### 4. Configure Mobile App

Edit `mobile/src/config/index.ts`:

```typescript
const API_URL = 'http://YOUR_LOCAL_IP:5000/api'; // Use your computer's IP, not localhost
export default {
  API_URL,
  SPOTIFY_CLIENT_ID: 'your_spotify_client_id_here',
  SPOTIFY_REDIRECT_URI: 'exp://localhost:8081',
};
```

**Important:** Replace `YOUR_LOCAL_IP` with your computer's local IP address (e.g., `192.168.1.100`). You can find this by running:
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr`

### 5. Start MongoDB

Make sure MongoDB is running:

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (cloud) by updating MONGODB_URI in .env
```

### 6. Install Dependencies

```bash
# Install all dependencies (root, mobile, and server)
npm run install:all
```

### 7. Run the Application

#### Option 1: Run Both (Recommended)

```bash
# From root directory - runs both server and mobile app
npm run dev
```

#### Option 2: Run Separately

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```

**Archive old scrobbles (server-side maintenance)**

To run the archival job that aggregates old scrobbles into album summaries and reduces raw scrobble storage:

```bash
# from the server folder
npm run archive
# Dry run (no deletes)
ARCHIVE_DRY_RUN=1 npm run archive
```

**Terminal 2 - Mobile App:**
```bash
cd mobile
npm start
```

### 8. Test on Device/Emulator

1. Install **Expo Go** on your physical device (from App Store or Google Play)
2. Scan the QR code shown in the terminal
3. Or press `a` to run on Android emulator or `i` for iOS simulator

## 📱 Building APK for Android

### Method 1: Using EAS Build (Recommended)

1. Install EAS CLI globally:
```bash
npm install -g eas-cli
```

2. Login to your Expo account:
```bash
eas login
```

3. Configure your project:
```bash
cd mobile
eas build:configure
```

4. Build APK:
```bash
# Build APK for testing (doesn't require Google Play)
eas build --platform android --profile preview

# Or build AAB for Google Play Store
eas build --platform android --profile production
```

5. Download the APK from the link provided after the build completes

### Method 2: Local Build

1. Install Android Studio and set up Android SDK
2. Run:
```bash
cd mobile
expo run:android --variant release
```

## 🛠️ Tech Stack

### Mobile App
- **React Native** with **Expo**
- **TypeScript**
- **React Navigation** (Stack & Bottom Tabs)
- **Expo Auth Session** (Spotify OAuth)
- **AsyncStorage** (Local data persistence)
- **Axios** (API requests)

### Backend
- **Node.js** with **Express**
- **TypeScript**
- **MongoDB** with **Mongoose**
- **Spotify Web API**
- **CORS & Session Management**

## 📚 API Endpoints

### Authentication
- `GET /api/auth/login` - Get Spotify authorization URL
- `POST /api/auth/callback` - Handle Spotify callback with auth code
- `POST /api/auth/refresh` - Refresh access token

### Music
- `GET /api/music/recent` - Get recently played tracks
- `GET /api/music/top-tracks` - Get user's top tracks
- `GET /api/music/search` - Search for tracks/albums

### Reviews
- `POST /api/reviews` - Create new review
- `GET /api/reviews/user/:userId` - Get all reviews for a user
- `GET /api/reviews/:id` - Get specific review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review
- `GET /api/reviews/stats/:userId` - Get user statistics

## 🎨 App Screens

1. **Login Screen** - Spotify OAuth authentication
2. **Home Screen** - Dashboard with user stats and review list
3. **Search Screen** - Search and discover music
4. **Add Review Screen** - Rate and review tracks with 1-10 stars

## 🐛 Troubleshooting

### "Cannot connect to server"
- Make sure backend server is running on port 5000
- Use your computer's local IP instead of `localhost` in mobile config
- Check firewall settings

### "Spotify authentication fails"
- Verify Spotify Client ID and Secret are correct
- Ensure redirect URI matches in Spotify Dashboard and `.env` file
- Check that user has given required permissions

### "MongoDB connection error"
- Ensure MongoDB is running
- Verify `MONGODB_URI` in `.env` is correct (use `127.0.0.1` not `localhost`)
- Check MongoDB service status

### "Spotify redirect URI mismatch"
- In Spotify Dashboard, use **exactly**: `http://127.0.0.1:5000/api/auth/callback`
- Do NOT use `localhost` - Spotify requires `127.0.0.1` for loopback addresses
- Ensure no trailing slashes

## 🔒 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/spotify-tracker` |
| `SESSION_SECRET` | Secret for session encryption | `random-secret-key` |
| `SPOTIFY_CLIENT_ID` | Spotify API Client ID | From Spotify Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify API Client Secret | From Spotify Dashboard |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `http://127.0.0.1:5000/api/auth/callback` |
| `CLIENT_URL` | Mobile app URL | `http://127.0.0.1:8081` |

## � Uptime Monitoring (Render Free Tier)

To keep the Render free tier server awake and avoid 15-minute idle timeouts:

1. **Endpoint**: `GET /ping` returns `"pong"`
2. **Setup UptimeRobot**: 
   - Add monitor: `https://ratesangeet.onrender.com/ping`
   - Interval: 5 minutes (free tier)
3. **Result**: Server stays awake 24/7, no cold starts

📖 **Full guide**: See [`docs/UPTIME_INTEGRATION_SUMMARY.md`](docs/UPTIME_INTEGRATION_SUMMARY.md)

## �📝 Future Enhancements

- [ ] Social features (follow users, share reviews)
- [ ] Playlist integration
- [ ] Export reviews to PDF/CSV
- [ ] Dark/Light theme toggle
- [ ] Push notifications for new releases
- [ ] Music recommendations based on ratings
- [ ] Year in Review stats

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ for music lovers**
