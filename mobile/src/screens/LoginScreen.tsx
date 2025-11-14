/**
 * LoginScreen - Production-Ready OAuth 2.0 PKCE Implementation
 * 
 * Features:
 * - RFC 7636 compliant PKCE flow
 * - Platform-aware (Web + Mobile native)
 * - Secure token handling (no tokens in URLs/deep links)
 * - State validation (CSRF protection)
 * - Proper error handling
 * - Works in Expo Dev Build and Production
 * 
 * Flow:
 * 1. User clicks login
 * 2. Generate PKCE params (verifier, challenge, state)
 * 3. Store verifier + state securely (localStorage/memory)
 * 4. Redirect to Spotify with challenge
 * 5. Spotify redirects back with code
 * 6. Validate state
 * 7. Exchange code + verifier for tokens via backend
 * 8. Backend returns tokens via secure JSON
 * 9. Store tokens and navigate to app
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import { Button, Text, useTheme, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/pkce';
import { getRedirectUri } from '../utils/redirectUri';
import { SPOTIFY_CONFIG } from '../utils/spotifyConfig';

// Required for WebBrowser to work on mobile
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export default function LoginScreen() {
  const { setAuth } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [loginSuccessful, setLoginSuccessful] = useState(false);

  /**
   * Handle OAuth callback on web
   * 
   * Triggered when Spotify redirects back with code parameter
   * Validates state and exchanges code for tokens
   */
  const handleWebCallback = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const errorParam = urlParams.get('error');

    console.log('🔍 Callback check:', { hasCode: !!code, hasError: !!errorParam, state });

    // No OAuth params = not a callback
    if (!code && !errorParam) {
      console.log('ℹ️ No OAuth params, skipping callback');
      return;
    }

    console.log('✅ OAuth callback detected! Processing...');

    // Clear URL immediately (security: don't leave code in history)
    window.history.replaceState({}, document.title, '/');

    // Handle Spotify error
    if (errorParam) {
      console.error('❌ Spotify OAuth error:', errorParam);
      setError(`Authentication failed: ${errorParam}`);
      setSnackbarVisible(true);
      return;
    }

    // Missing code (shouldn't happen)
    if (!code) {
      setError('No authorization code received');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);

    try {
      // Retrieve PKCE parameters from storage
      const storedVerifier = localStorage.getItem(SPOTIFY_CONFIG.STORAGE_KEYS.CODE_VERIFIER);
      const storedState = localStorage.getItem(SPOTIFY_CONFIG.STORAGE_KEYS.STATE);
      const storedRedirectUri = localStorage.getItem(SPOTIFY_CONFIG.STORAGE_KEYS.REDIRECT_URI);

      // Validate we have required data
      if (!storedVerifier) {
        throw new Error('Code verifier not found. Please try logging in again.');
      }

      // Validate state (CSRF protection)
      if (state !== storedState) {
        throw new Error('Invalid state parameter. Possible CSRF attack.');
      }

      console.log('🔑 Exchanging authorization code for tokens...');

      // Exchange code for tokens via backend
      const response = await fetch(`${config.API_URL}/auth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          codeVerifier: storedVerifier,
          redirectUri: storedRedirectUri || getRedirectUri(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Authentication failed');
      }

      console.log('✅ Token exchange successful');

      // Save auth data to context
      await setAuth({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        user: data.data.user,
      });

      console.log('✅ User logged in:', data.data.user.displayName);

      // Clean up storage
      localStorage.removeItem(SPOTIFY_CONFIG.STORAGE_KEYS.CODE_VERIFIER);
      localStorage.removeItem(SPOTIFY_CONFIG.STORAGE_KEYS.STATE);
      localStorage.removeItem(SPOTIFY_CONFIG.STORAGE_KEYS.REDIRECT_URI);
    } catch (err: any) {
      console.error('❌ Token exchange failed:', err);
      setError(err.message || 'Authentication failed');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  }, [setAuth]);

  /**
   * Handle OAuth callback - run once on mount
   */
  useEffect(() => {
    handleWebCallback();
  }, [handleWebCallback]);

  /**
   * Clear error state on unmount (cleanup)
   */
  useEffect(() => {
    return () => {
      setError('');
      setSnackbarVisible(false);
    };
  }, []);

  /**
   * Handle login button click
   * 
   * Platform-specific flows:
   * - Web: Manual PKCE + full-page redirect
   * - Mobile: expo-auth-session (handles PKCE internally)
   */
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setSnackbarVisible(false); // Hide any previous error snackbar
    setLoginSuccessful(false); // Reset success flag

    try {
      const redirectUri = getRedirectUri();
      console.log('🔐 Starting OAuth flow...');
      console.log('📍 Redirect URI:', redirectUri);

      if (Platform.OS === 'web') {
        // ============================================================
        // WEB FLOW: Manual PKCE Implementation
        // ============================================================

        // Step 1: Generate PKCE parameters
        const codeVerifier = await generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = generateState();

        // Step 2: Store parameters securely (needed for callback)
        localStorage.setItem(SPOTIFY_CONFIG.STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
        localStorage.setItem(SPOTIFY_CONFIG.STORAGE_KEYS.STATE, state);
        localStorage.setItem(SPOTIFY_CONFIG.STORAGE_KEYS.REDIRECT_URI, redirectUri);

        console.log('🔑 Generated PKCE parameters');
        console.log('   Verifier length:', codeVerifier.length);
        console.log('   Challenge length:', codeChallenge.length);
        console.log('   State:', state);

        // Step 3: Build authorization URL
        const params = new URLSearchParams({
          client_id: config.SPOTIFY_CLIENT_ID,
          response_type: 'code',
          redirect_uri: redirectUri,
          code_challenge_method: 'S256',
          code_challenge: codeChallenge,
          state,
          scope: SPOTIFY_CONFIG.SCOPES.join(' '),
        });

        const authUrl = `${SPOTIFY_CONFIG.AUTH_URL}?${params.toString()}`;

        console.log('🚀 Redirecting to Spotify...');

        // Step 4: Redirect to Spotify (full page redirect)
        window.location.href = authUrl;

        // Note: Execution stops here. When Spotify redirects back,
        // the page reloads and handleWebCallback() runs.
      } else {
        // ============================================================
        // MOBILE FLOW: expo-auth-session with PKCE
        // ============================================================

        console.log('📱 Using expo-auth-session for mobile');

        // Discovery endpoints
        const discovery = {
          authorizationEndpoint: SPOTIFY_CONFIG.AUTH_URL,
        };

        // Create auth request (expo-auth-session generates PKCE internally)
        const authRequest = new AuthSession.AuthRequest({
          clientId: config.SPOTIFY_CLIENT_ID,
          redirectUri,
          scopes: SPOTIFY_CONFIG.SCOPES,
          usePKCE: true, // This makes expo-auth-session generate PKCE params
          codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        });

        console.log('🔑 Opening Spotify authorization...');

        // Prompt user to authorize (opens browser)
        const result = await authRequest.promptAsync(discovery);

        console.log('📱 Auth session result:', result.type);

        if (result.type === 'success') {
          const { code } = result.params;

          if (!code) {
            throw new Error('No authorization code received');
          }

          console.log('✅ Got authorization code');
          console.log('🔑 Exchanging code for tokens...');

          // Exchange code for tokens via backend
          // CRITICAL: We send the code_verifier that expo-auth-session generated
          const codeVerifier = authRequest.codeVerifier;

          if (!codeVerifier) {
            throw new Error('Code verifier not available from auth session');
          }

          const response = await fetch(`${config.API_URL}/auth/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              codeVerifier,
              redirectUri,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || 'Authentication failed');
          }

          console.log('✅ Token exchange successful');

          // Mark login as successful IMMEDIATELY to prevent any error display
          setLoginSuccessful(true);
          
          // Clear any existing errors
          setError('');
          setSnackbarVisible(false);

          // Save auth data to context
          await setAuth({
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
            user: data.data.user,
          });

          console.log('✅ User logged in:', data.data.user.displayName);
          
          // Exit early on success
          return;
        } else if (result.type === 'error') {
          throw new Error(result.error?.message || 'Authorization failed');
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          console.log('🔙 User cancelled or dismissed authorization');
          // Not an error - user cancelled/dismissed intentionally
          setLoading(false);
          return;
        } else {
          console.warn('⚠️ Unknown auth result type:', result.type);
          throw new Error(`Unknown authorization result type: ${result.type}`);
        }

        setLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Login error:', err);
      // Only show error if login wasn't successful
      if (!loginSuccessful) {
        setError(err.message || 'Authentication failed');
        setSnackbarVisible(true);
      }
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* App Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* App Title */}
        <Text variant="displaySmall" style={[styles.title, { color: theme.colors.onBackground }]}>
          Ratesangeet
        </Text>
        <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Track, Rate & Discover Music
        </Text>

        {/* Features */}
        <View style={styles.features}>
          <FeatureItem icon="🎵" text="Track your listening history" theme={theme} />
          <FeatureItem icon="⭐" text="Rate and review albums" theme={theme} />
          <FeatureItem icon="📊" text="View personalized stats" theme={theme} />
          <FeatureItem icon="🔍" text="Discover new music" theme={theme} />
        </View>

        {/* Login Button */}
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.loginButton}
          contentStyle={styles.loginButtonContent}
          labelStyle={styles.loginButtonLabel}
        >
          {loading ? 'Connecting...' : 'Login with Spotify'}
        </Button>

        {/* Footer */}
        <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
          Powered by Spotify • Free to use
        </Text>
      </View>

      {/* Error Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={5000}
        action={{
          label: 'Retry',
          onPress: handleLogin,
        }}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
}

/** Feature item component */
function FeatureItem({ icon, text, theme }: { icon: string; text: string; theme: any }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 48,
    textAlign: 'center',
  },
  features: {
    width: '100%',
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  loginButton: {
    width: '100%',
    borderRadius: 8,
    marginBottom: 16,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
  },
});
