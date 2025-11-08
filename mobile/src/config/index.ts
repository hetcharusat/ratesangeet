import { Platform } from 'react-native';

// Prefer an Expo public env var at runtime, fallback to platform-specific defaults.
// You can set this when starting Expo: EXPO_PUBLIC_API_URL=http://<your-ip>:5000/api
// On Windows PowerShell: $env:EXPO_PUBLIC_API_URL="http://192.168.x.x:5000/api"

// Platform-specific API URL
const getDefaultApiUrl = () => {
  // 1. Highest priority: Explicit Expo public env var (set during build or start)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL as string;
  }

  // 2. Production fallback: If building a beta APK and env var not injected, use Railway placeholder.
  // Replace YOUR_RAILWAY_DOMAIN below after first deploy (e.g. ratesangeet-production.up.railway.app)
  if (process.env.NODE_ENV === 'production') {
    return 'https://YOUR_RAILWAY_DOMAIN/api';
  }

  // 3. Development heuristics (local network / simulator / web dev)
  if (Platform.OS === 'android') {
    // Physical device: Use LAN IP (update this if your IP changes) OR set EXPO_PUBLIC_API_URL to override.
    return 'http://192.168.42.205:5000/api';
  }
  if (Platform.OS === 'ios') {
    return 'http://127.0.0.1:5000/api';
  }
  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:5000/api';
  }
  return 'http://127.0.0.1:5000/api';
};

const API_URL = getDefaultApiUrl();

export default {
  API_URL,
  SPOTIFY_CLIENT_ID: '30d78a30cd9f435eba6edbaa4a427041',
  SPOTIFY_REDIRECT_URI: 'ratesangeet://callback',
};
