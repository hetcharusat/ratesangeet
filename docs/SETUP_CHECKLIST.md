# ✅ Setup Checklist

Use this checklist to get your Spotify Music Tracker up and running!

## 📋 Before You Start

- [ ] Node.js installed (v16+)
- [ ] npm or yarn installed
- [ ] MongoDB installed OR MongoDB Atlas account created
- [ ] Spotify account

---

## 🎯 Step-by-Step Setup

### 1. Spotify Developer Account
- [ ] Go to https://developer.spotify.com/dashboard
- [ ] Log in with your Spotify account
- [ ] Click "Create an App"
- [ ] Fill in app name and description
- [ ] Accept terms and create
- [ ] Click "Edit Settings"
- [ ] Add Redirect URI: `http://127.0.0.1:5000/api/auth/callback`
  - ⚠️ **CRITICAL**: Use `127.0.0.1` NOT `localhost` (Spotify security requirement)
  - Make sure there's no trailing slash
- [ ] Save settings
- [ ] Copy your **Client ID** (you'll need this)
- [ ] Click "Show Client Secret" and copy it (you'll need this too)

### 2. Install Dependencies
- [ ] Open terminal in project root
- [ ] Run: `npm run install:all`
- [ ] Wait for all packages to install

### 3. Configure Backend
- [ ] Navigate to `server` folder
- [ ] Copy `.env.example` to `.env`
- [ ] Open `server/.env` in text editor
- [ ] Paste your Spotify Client ID
- [ ] Paste your Spotify Client Secret
- [ ] Update MongoDB URI if not using local MongoDB

### 4. Find Your Local IP Address
**Windows:**
- [ ] Open Command Prompt
- [ ] Run: `ipconfig`
- [ ] Find "IPv4 Address" under your active network adapter
- [ ] Write it down (e.g., 192.168.1.100)

**Mac/Linux:**
- [ ] Open Terminal
- [ ] Run: `ifconfig` or `ip addr show`
- [ ] Find your local IP under your network interface
- [ ] Write it down (e.g., 192.168.1.100)

### 5. Configure Mobile App
- [ ] Navigate to `mobile/src/config/`
- [ ] Open `index.ts`
- [ ] Replace `localhost` with your IP address in `API_URL`
- [ ] Example: `http://192.168.1.100:5000/api`
- [ ] Paste your Spotify Client ID in `SPOTIFY_CLIENT_ID`
- [ ] Save the file

### 6. Start MongoDB
**If using local MongoDB:**
- [ ] Open a new terminal
- [ ] Run: `mongod`
- [ ] Keep this terminal open

**If using MongoDB Atlas:**
- [ ] Create a free cluster at https://www.mongodb.com/cloud/atlas
- [ ] Get connection string
- [ ] Update `MONGODB_URI` in `server/.env`

### 7. Run the Application
- [ ] Open terminal in project root
- [ ] Run: `npm run dev`
- [ ] Wait for both server and mobile app to start
- [ ] You should see:
  - ✅ "Server running on http://localhost:5000"
  - ✅ "MongoDB connected successfully"
  - ✅ QR code displayed for mobile app

### 8. Test on Mobile Device
- [ ] Install "Expo Go" app from App Store or Google Play
- [ ] Make sure your phone is on the same WiFi network as your computer
- [ ] Open Expo Go app
- [ ] Scan the QR code from terminal
- [ ] App should load on your phone
- [ ] Try logging in with Spotify

---

## 🎉 First Time Using the App

- [ ] Click "Login with Spotify"
- [ ] Authorize the app in browser
- [ ] You should be logged in
- [ ] See your dashboard (might be empty at first)
- [ ] Go to "Search" tab
- [ ] Search for a song
- [ ] Tap the "+" to add a review
- [ ] Rate it (1-10 stars)
- [ ] Write a review (optional)
- [ ] Save
- [ ] Go back to "Home" tab
- [ ] See your first review! 🎉

---

## 🏗️ Building APK (Optional)

- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Create Expo account at https://expo.dev
- [ ] Run: `eas login`
- [ ] Navigate to `mobile` folder
- [ ] Run: `eas build:configure`
- [ ] Run: `eas build --platform android --profile preview`
- [ ] Wait for build to complete (can take 10-20 minutes)
- [ ] Download APK from provided link
- [ ] Install on Android device

---

## ✅ Verification Checklist

Test these features to ensure everything works:

- [ ] Login with Spotify works
- [ ] Home screen shows user name
- [ ] Search finds songs
- [ ] Can add a review
- [ ] Rating stars work
- [ ] Review text saves
- [ ] Review appears on home screen
- [ ] Stats update (total reviews, avg rating)
- [ ] Can logout and login again

---

## 🐛 Troubleshooting

If something doesn't work, check:

- [ ] Backend server is running (no errors in terminal)
- [ ] MongoDB is connected
- [ ] Mobile app API_URL uses IP address, not localhost
- [ ] Phone and computer are on same WiFi
- [ ] Spotify credentials are correct in .env
- [ ] Redirect URI matches exactly in Spotify Dashboard
- [ ] Port 5000 is not blocked by firewall

---

## 🎊 All Done!

Congratulations! You now have a fully functional music tracking app! 🎵

Start tracking your favorite songs and build your music diary!
