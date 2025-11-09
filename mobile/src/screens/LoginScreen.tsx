import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import config from '../config';
import { pkceLogin, handleSpotifyCallback } from '../services/api';
import { Colors } from '../theme/colors';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const LoginScreen = () => {
  const { setAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Use makeRedirectUri so expo-auth-session can auto-complete the popup on web
  const rawRedirect = AuthSession.makeRedirectUri({
    // Ensure native deep link works in builds
    native: 'ratesangeet://callback',
  });
  // Spotify requires explicit loopback IP, not localhost, for web
  const redirectUri = Platform.OS === 'web'
    ? rawRedirect.replace('localhost', '127.0.0.1')
    : rawRedirect;

  console.log('Platform:', Platform.OS);
  console.log('Redirect URI:', redirectUri);
  console.log('API URL:', config.API_URL);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.SPOTIFY_CLIENT_ID,
      scopes: [
        'user-read-private',
        'user-read-email',
        'user-read-recently-played',
        'user-top-read',
        'user-read-currently-playing',
        'user-read-playback-state',
      ],
      usePKCE: true,
      redirectUri,
      responseType: 'code',
      // Force Spotify to show account selection even if already logged in
      extraParams: {
        show_dialog: 'true', // Forces account selection dialog
      },
    },
    discovery
  );

  const handleLogin = async () => {
    if (Platform.OS === 'web') {
      // On web, use full page redirect instead of popup
      // This provides better UX and avoids popup blockers
      if (request?.url) {
        // Persist PKCE code verifier so we can complete the exchange after full-page redirect
        try {
          if (request.codeVerifier) {
            sessionStorage.setItem('spotify_pkce_verifier', request.codeVerifier);
          }
          sessionStorage.setItem('spotify_redirect_uri', redirectUri);
        } catch {}
        window.location.href = request.url;
      }
    } else {
      // On mobile, use the standard prompt
      await promptAsync();
    }
  };

  // Web-only: If we returned from Spotify via full-page redirect, the URL will contain ?code=...
  // Complete the flow by exchanging via backend /auth/callback (server-side exchange),
  // then upsert user and persist auth. This bypasses the PKCE client exchange and avoids
  // relying on useAuthRequest response handling (since we didn't call promptAsync on web).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const code = qs.get('code');
      const err = qs.get('error');
      if (err) {
        console.error('Auth returned error:', err);
        setError(`Authentication error: ${err}`);
        // Clean the URL to remove params
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      if (code && !isCompleting) {
        setIsCompleting(true);
        (async () => {
          try {
            console.log('Completing web auth via backend callback with redirect:', redirectUri);
            let codeVerifier: string | undefined;
            try {
              codeVerifier = sessionStorage.getItem('spotify_pkce_verifier') || undefined;
            } catch {}
            const data = await handleSpotifyCallback(code, redirectUri, codeVerifier);
            console.log('Backend callback OK. User:', data?.user?.displayName || data?.user?.id);
            await setAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken || null,
              user: data.user,
            });
          } catch (e: any) {
            console.error('Callback exchange failed:', e?.message, e?.response?.data);
            setError(e?.response?.data?.message || e?.message || 'Login failed');
          } finally {
            // Remove auth params from URL to avoid re-triggering on refresh
            window.history.replaceState({}, document.title, window.location.pathname);
            try {
              sessionStorage.removeItem('spotify_pkce_verifier');
              sessionStorage.removeItem('spotify_redirect_uri');
            } catch {}
            setIsCompleting(false);
          }
        })();
      }
    } catch {
      // ignore session storage errors
    }
 
  }, []);

  useEffect(() => {
    if (!response) return;
    console.log('Auth response type:', response.type);
    if (response?.type === 'success') {
      console.log('Auth code received:', (response.params?.code || '').slice(0, 10) + '...');
      exchangeCodeAndLogin(response.params.code);
    } else if (response?.type === 'error') {
      console.error('Auth error:', (response as any).error || response);
      setError('Authentication failed');
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      console.log('Auth dismissed/cancelled');
    }
  }, [response]);

  const exchangeCodeAndLogin = async (code: string) => {
    try {
      if (!request?.codeVerifier) return;
      console.log('Exchanging code for tokens with redirect:', redirectUri);
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: config.SPOTIFY_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery
      );
      console.log('Token exchange OK. Access token present:', !!tokenResponse.accessToken);

      console.log('Calling backend pkce-login at', config.API_URL);
      const authData = await pkceLogin(tokenResponse.accessToken, tokenResponse.refreshToken);
      console.log('Backend login OK. User:', authData?.user?.displayName || authData?.user?.id);
      
      await setAuth({
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken || null,
        user: authData.user,
      });
    } catch (err: any) {
      console.error('Login flow error:', err?.message, err?.response?.data);
      setError(err?.response?.data?.message || err?.message || 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🎵</Text>
        </View>
        <Text style={styles.appName}>RateSangeet</Text>
        <Text style={styles.tagline}>Your Music, Your Story</Text>

        <View style={styles.featuresContainer}>
          <FeatureItem emoji="⭐" text="Rate songs & albums" />
          <FeatureItem emoji="📝" text="Write reviews" />
          <FeatureItem emoji="📊" text="Track your listening" />
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={!request}
        >
          <Text style={styles.loginButtonText}>Continue with Spotify</Text>
        </TouchableOpacity>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const FeatureItem = ({ emoji, text }: { emoji: string; text: string }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureEmoji}>{emoji}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  logoEmoji: {
    fontSize: 50,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 48,
  },
  featuresContainer: {
    marginBottom: 48,
    width: '100%',
    maxWidth: 320,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    maxWidth: 320,
  },
  loginButtonText: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.error + '22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LoginScreen;
