/**
 * Spotify OAuth Configuration
 */

export const SPOTIFY_CONFIG = {
  // Spotify OAuth endpoints
  AUTH_URL: 'https://accounts.spotify.com/authorize',
  TOKEN_URL: 'https://accounts.spotify.com/api/token',
  
  // Required scopes
  SCOPES: [
    'user-read-private',
    'user-read-email',
    'user-read-recently-played',
    'user-top-read',
    'user-read-currently-playing',
    'user-read-playback-state',
  ],
  
  // Storage keys
  STORAGE_KEYS: {
    CODE_VERIFIER: 'spotify_code_verifier',
    STATE: 'spotify_state',
    REDIRECT_URI: 'spotify_redirect_uri',
  },
} as const;
