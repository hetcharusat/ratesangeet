# Development Commands

Quick reference for running the Spotify Music Tracker project.

## 🧹 FIRST TIME: Clean Up Cloud Storage

**Important:** Your MongoDB Atlas has 40 scrobbles taking up space. Run this once to clean them up:

```powershell
cd server
npm run cleanup
cd ..
```

This deletes raw scrobbles from MongoDB (they belong in local SQLite). Safe to run anytime.

---

## One-Command Startup (Recommended)

### Start Server + Mobile (Expo)
Opens two separate windows: Express server + Expo mobile dev server.

```powershell
npm run dev
```

or

```powershell
npm run dev:mobile
```

**What opens:**
- Window 1: Express API server (MongoDB + routes)
- Window 2: Expo dev server with QR code
  - Press `w` to open web
  - Press `a` to open Android
  - Press `r` to reload
  - Press `?` to see all commands
  - Press `Ctrl+C` to stop

---

### Start Server + Web
Opens two separate windows: Express server + Expo Web.

```powershell
npm run web
```

or

```powershell
npm run dev:web
```

**What opens:**
- Window 1: Express API server
- Window 2: Expo Web (auto-opens browser at http://localhost:8081)

---

## Individual Commands

### Server Only
Start only the Express backend (MongoDB + API).

```powershell
npm run server
```

Runs on: `http://localhost:5000` (or next available port)

---

### Mobile Only
Start only the Expo dev server (no backend).

```powershell
npm run mobile
```

or

```powershell
npm run mobile:solo
```

**Note:** You'll need the server running separately for the app to work.

---

### Web Only
Start only Expo Web (no backend).

```powershell
npm run web:solo
```

**Note:** You'll need the server running separately.

---

### Android Build
Build the Android APK.

```powershell
npm run android
```

---

## PowerShell Scripts (Direct)

You can also run the launcher scripts directly:

```powershell
# Server + Mobile
.\start-dev.ps1

# Server + Web
.\start-web.ps1

# Server only
.\start-server.ps1

# Expo only
.\start-expo.ps1
```

---

## Environment Configuration

### Using LAN IP for Physical Devices

If testing on a physical Android/iOS device on the same WiFi network, set the API URL to your computer's LAN IP before starting:

```powershell
# Replace with your actual LAN IP (check server startup logs)
$env:EXPO_PUBLIC_API_URL="http://192.168.42.205:5000/api"
npm run dev
```

**How to find your LAN IP:**
- Start the server: `npm run server`
- Look for the line: `🌐 Candidate LAN URLs (pick your active Wi‑Fi/Ethernet):`
- Use the Wi-Fi IP address shown

---

## Initial Setup

### Install Dependencies (First Time Only)

```powershell
npm run install:all
```

This installs packages in:
- Root directory
- `/mobile`
- `/server`

---

## Project Structure

- **Server**: Express + MongoDB backend (`/server`)
  - Port: 5000 (default)
  - Routes: `/api/auth`, `/api/music`, `/api/reviews`, `/api/stats`, `/api/users`

- **Mobile**: React Native + Expo (`/mobile`)
  - Runs on Android, iOS, and Web
  - Port: 8081 (Expo dev server)

- **Web**: Expo Web wrapper (`/web`)
  - Uses the same codebase as mobile
  - Runs via Expo's web target

---

## Common Issues

### Port Already in Use
If you see `⚠️ Port 5000 in use`, the server will auto-increment to 5001, 5002, etc.

### Can't Press 'w' or Other Keys
Make sure you're focused on the **Expo window** (not the server window). Click the Expo terminal window first, then press the key.

### Network Error on Mobile
- Ensure your device is on the same WiFi as your computer
- Set `EXPO_PUBLIC_API_URL` to your LAN IP (see above)
- Check firewall settings if the device can't reach the server

### Web Login Loops Back
- Ensure the server is running
- Check browser console for errors
- Verify redirect URI is registered in Spotify Developer Dashboard:
  - http://127.0.0.1:8081
  - ratesangeet://callback

---

## Quick Reference

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start server + mobile (2 windows) |
| `npm run web` | Start server + web (2 windows) |
| `npm run server` | Start only backend |
| `npm run mobile` | Start only Expo mobile |
| `npm run install:all` | Install all dependencies |
| `npm run android` | Build Android app |

---

## Cloud Storage Optimization

### Clean Up Cloud Scrobbles
Remove raw scrobbles from MongoDB (they belong in local SQLite only):

```powershell
cd server
npm run cleanup
```

**What this does:**
- Deletes all raw scrobbles from MongoDB Atlas
- Keeps AlbumStats, TrackStats, and UserStatsSummaries (lightweight summaries)
- Reduces cloud storage usage significantly

**Storage Policy:**
- ✅ **Local (SQLite)**: All raw scrobbles (full listening history)
- ✅ **Cloud (MongoDB)**: Reviews, comments, favorites, follows, AlbumStats, TrackStats, UserStatsSummaries
- ❌ **Cloud (MongoDB)**: Raw scrobbles (disabled via `CLOUD_ENABLE_SCROBBLES=false`)

This keeps your MongoDB Atlas free tier usage minimal while preserving all user data locally.

---

## VS Code Tasks (Alternative)

You can also use VS Code tasks:

1. Press `Ctrl+Shift+P`
2. Type "Run Task"
3. Choose:
   - **Dev: Mobile (server + expo)** → Starts both in separate terminals
   - **Dev: Web (server + expo-web)** → Starts server + web
   - **Server** → Only server
   - **Expo (mobile)** → Only Expo mobile

Tasks run in VS Code's integrated terminal with dedicated panels.
