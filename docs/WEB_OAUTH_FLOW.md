# Web OAuth Flow Setup

## Development (127.0.0.1 - Required by Spotify)

⚠️ **CRITICAL**: Spotify changed their policy and NO LONGER accepts `localhost`. You MUST use `127.0.0.1`.

### Add to Spotify Dashboard:
- `http://127.0.0.1:8081/callback` (NOT localhost)
- `ratesangeet://callback` (for native mobile)

### How to access:
- Open your web app at: `http://127.0.0.1:8081` (not localhost)
- The app will automatically use `127.0.0.1` in the redirect URI

### How it works:
1. User clicks "Login with Spotify" on web
2. Redirected to Spotify authorization page
3. After approval, Spotify redirects to `http://localhost:8081/callback`
4. The callback page (served by Expo Metro) completes the OAuth flow
5. User is logged in

## Production (hosted web app)

When you deploy your web app to production (e.g., Netlify, Vercel, or Expo hosting):

### Steps:
1. Deploy your app to HTTPS hosting (Spotify requires HTTPS for production)
2. Add your production redirect URI to Spotify Dashboard:
   - Example: `https://yourapp.netlify.app/callback`
   - Or: `https://yourapp.vercel.app/callback`
3. The app automatically uses `window.location.origin + /callback` so it works in any environment

### Expo Hosting Option:
If using `expo export:web` and hosting on Expo's servers:
- Get your hosted URL from Expo (e.g., `https://spotify-tracker.expo.dev`)
- Add `https://spotify-tracker.expo.dev/callback` to Spotify Dashboard

## Why not use Expo's AuthSession proxy?

Expo's auth proxy (`auth.expo.io`) is **deprecated** and unreliable:
- Blocked by Safari's tracking prevention
- Requires cookies to work (often blocked)
- Not recommended by Expo anymore

Instead, we use direct redirect URIs which are:
- More reliable
- More secure
- Recommended by both Spotify and Expo
- Work consistently across all browsers

## Callback Handler

The `/callback` route is handled by:
- **Web**: `public/callback.html` - a simple page that completes the OAuth session
- **Native**: Deep link handler in `App.tsx` that catches `ratesangeet://callback`

Both work with `expo-auth-session` and `expo-web-browser` to complete the PKCE flow securely.
