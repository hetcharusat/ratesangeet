# Web Version Strategy - Spotify Music Tracker

## Overview
Creating a web version of the Spotify Music Tracker app to reach users on desktop/web browsers while sharing maximum code with the mobile app.

---

## Recommended Approach: React Native Web

### Why React Native Web?
- **Maximum Code Reuse**: Share 80-90% of codebase between mobile and web
- **Same Tech Stack**: Continue using React Native, TypeScript, same components
- **Unified State Management**: Share contexts, hooks, and business logic
- **Single Backend**: Use existing Node.js/MongoDB server
- **Cost-Effective**: No need to rebuild UI from scratch

### Architecture

```
/mobile (existing)          → Builds to APK/IPA via Expo
  /src
    /components
    /screens
    /context
    /services
    /storage (SQLite)

/web (new)                  → Builds to static website
  /public
  /src
    → Import shared components from /mobile/src
    → Override platform-specific modules (storage, auth)
```

---

## Implementation Options

### **Option 1: Expo Web (Recommended)**
Expo has built-in web support via React Native Web.

**Pros:**
- Minimal setup (just `expo build:web`)
- Automatic platform detection
- Hot reload for web development
- Uses same Expo components

**Cons:**
- Some native modules need web alternatives (SQLite → IndexedDB)
- Bundle size can be larger
- Limited to Expo-supported packages

**Setup Steps:**
1. Install web dependencies:
   ```bash
   cd mobile
   npx expo install react-dom react-native-web @expo/webpack-config
   ```

2. Add web script to `package.json`:
   ```json
   "scripts": {
     "web": "expo start --web"
   }
   ```

3. Create platform-specific storage adapter:
   ```typescript
   // mobile/src/storage/index.ts
   import * as SQLite from 'expo-sqlite';
   
   export const storage = Platform.select({
     web: () => import('./indexedDB'),
     default: () => import('./sqlite'),
   })();
   ```

4. Run web version:
   ```bash
   npm run web
   ```

5. Build for production:
   ```bash
   npx expo export:web
   ```

---

### **Option 2: Next.js + Shared Components**
Separate Next.js app that imports shared components.

**Pros:**
- Better SEO (server-side rendering)
- Faster initial load
- Full control over web-specific optimizations
- Static site generation possible

**Cons:**
- More setup required
- Need to configure React Native Web manually
- Some components may need refactoring

**Setup Steps:**
1. Create Next.js app:
   ```bash
   npx create-next-app@latest web --typescript
   cd web
   ```

2. Install React Native Web:
   ```bash
   npm install react-native-web react-native-svg
   ```

3. Configure `next.config.js`:
   ```javascript
   module.exports = {
     webpack: (config) => {
       config.resolve.alias = {
         ...(config.resolve.alias || {}),
         'react-native$': 'react-native-web',
       };
       config.resolve.extensions = [
         '.web.js',
         '.web.ts',
         '.web.tsx',
         ...config.resolve.extensions,
       ];
       return config;
     },
   };
   ```

4. Create shared component imports:
   ```typescript
   // web/components/ActivityFeed.tsx
   import ActivityScreen from '../../mobile/src/screens/ActivityScreen';
   export default ActivityScreen;
   ```

---

## Platform-Specific Adaptations

### 1. **Storage Layer**
- **Mobile**: expo-sqlite (SQLite database)
- **Web**: IndexedDB or localStorage (browser storage)

```typescript
// mobile/src/storage/adapter.ts
interface StorageAdapter {
  saveScrobbles(items: Scrobble[]): Promise<void>;
  getRecentScrobbles(limit: number): Promise<Scrobble[]>;
  // ... other methods
}

// mobile/src/storage/sqlite.ts (existing)
export const sqliteAdapter: StorageAdapter = { /* ... */ };

// mobile/src/storage/indexedDB.ts (new for web)
export const indexedDBAdapter: StorageAdapter = {
  async saveScrobbles(items) {
    const db = await openDB('spotiireate', 1);
    const tx = db.transaction('scrobbles', 'readwrite');
    for (const item of items) {
      await tx.store.put(item);
    }
  },
  // ... implement other methods
};

// mobile/src/storage/index.ts
import { Platform } from 'react-native';
export const storage = Platform.OS === 'web' 
  ? indexedDBAdapter 
  : sqliteAdapter;
```

### 2. **Authentication Flow**
- **Mobile**: Spotify OAuth with PKCE (in-app browser)
- **Web**: Standard OAuth redirect flow (browser tabs)

```typescript
// mobile/src/utils/auth.web.ts
export const loginWithSpotify = async () => {
  // Redirect to Spotify OAuth
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
};

export const handleAuthCallback = () => {
  // Parse URL params after redirect
  const code = new URLSearchParams(window.location.search).get('code');
  // Exchange code for token
};
```

### 3. **Navigation**
- **Mobile**: React Navigation (stack/tab)
- **Web**: React Navigation Web or Next.js routing

### 4. **Responsive Design**
Use media queries for desktop-optimized layouts:

```typescript
import { useWindowDimensions } from 'react-native';

const ProfileScreen = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  return (
    <View style={isDesktop ? styles.desktopLayout : styles.mobileLayout}>
      {/* ... */}
    </View>
  );
};
```

---

## Deployment Strategy

### Web Hosting Options

1. **Vercel** (Recommended for Next.js)
   - Free tier available
   - Auto SSL, CDN, preview deployments
   - Deploy: `vercel --prod`

2. **Netlify** (Good for static Expo web builds)
   - Free tier available
   - Drag-and-drop deployment
   - Deploy: `netlify deploy --prod`

3. **GitHub Pages** (Free static hosting)
   - Deploy from repo
   - No server-side rendering

### Build Process

**Expo Web:**
```bash
cd mobile
npx expo export:web
# Output in web-build/ folder
```

**Next.js:**
```bash
cd web
npm run build
npm run export  # For static export
```

---

## Features to Adapt

### ✅ Works Without Changes
- Reviews UI
- Activity feed
- Search functionality
- User profiles
- Follow system
- API client (`services/api.ts`)

### 🔧 Needs Platform-Specific Code
- Local storage (SQLite → IndexedDB)
- OAuth flow (in-app browser → redirect)
- Push notifications (remove or use web notifications)
- Native modules (camera, file picker)

### 📱 Mobile-Only (Remove for Web)
- App store links
- Mobile-specific gestures
- Biometric auth

---

## Recommended Tech Stack for Web

```
Frontend:
- React Native Web (via Expo or Next.js)
- TypeScript (same as mobile)
- Official color palette (shared theme/colors.ts)
- React Navigation Web or Next.js Router

Storage:
- IndexedDB (via idb library) for local scrobble cache
- Same MongoDB backend (cloud data)

Auth:
- Spotify OAuth (redirect flow)
- JWT tokens (same as mobile)

Deployment:
- Vercel or Netlify
- CI/CD via GitHub Actions
```

---

## Step-by-Step Quick Start (Expo Web)

1. **Enable web support:**
   ```bash
   cd mobile
   npx expo install react-dom react-native-web
   ```

2. **Test web version locally:**
   ```bash
   npx expo start --web
   ```

3. **Create platform-specific storage:**
   ```bash
   # Create mobile/src/storage/indexedDB.ts
   # Implement same interface as sqlite.ts
   ```

4. **Update imports to use platform detection:**
   ```typescript
   import { Platform } from 'react-native';
   const storage = Platform.select({
     web: () => require('./indexedDB').default,
     default: () => require('./sqlite').default,
   })();
   ```

5. **Build for production:**
   ```bash
   npx expo export:web
   ```

6. **Deploy to Netlify/Vercel:**
   ```bash
   # Upload web-build/ folder
   ```

---

## Benefits of Web Version

1. **Wider Reach**: Users without mobile app can access on desktop
2. **Better for Reviews**: Easier to type long reviews on keyboard
3. **SEO**: Web pages can be indexed by search engines
4. **Shareable Links**: Direct links to profiles, reviews, albums
5. **Cross-Platform**: Works on any device with a browser
6. **No App Store**: No approval process, instant updates

---

## Timeline Estimate

- **Expo Web (Basic)**: 1-2 weeks
  - Setup: 2 days
  - Storage adapter: 3 days
  - Auth flow: 2 days
  - Testing + fixes: 3 days

- **Next.js (Full Featured)**: 3-4 weeks
  - Setup + config: 3 days
  - Component migration: 5 days
  - Storage + auth: 4 days
  - Responsive design: 5 days
  - Testing + deployment: 3 days

---

## Conclusion

**Recommended Path**: Start with **Expo Web** for quickest deployment, then migrate to Next.js later if SEO/performance becomes critical.

**Action Items:**
1. Run `npx expo start --web` to test current state
2. Implement IndexedDB storage adapter
3. Add web-specific OAuth redirect flow
4. Test all screens on desktop browsers
5. Deploy to Netlify or Vercel
6. Share web URL with beta testers

---

## Resources

- [Expo Web Documentation](https://docs.expo.dev/workflow/web/)
- [React Native Web](https://necolas.github.io/react-native-web/)
- [Next.js + RN Web Guide](https://github.com/vercel/next.js/tree/canary/examples/with-react-native-web)
- [IndexedDB (idb library)](https://github.com/jakearchibald/idb)
