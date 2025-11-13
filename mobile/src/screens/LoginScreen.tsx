import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Platform, Linking } from 'react-native';
import { Button, Text, useTheme, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../context/AuthContext';
import { Motion } from '../theme/tokens';
import config from '../config';

// Required for WebBrowser to work properly on mobile
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// PKCE helper functions (Web-compatible)
const generateCodeVerifier = async (): Promise<string> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto) {
    // Use browser's native crypto API (works on http://localhost)
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return base64URLEncode(array.buffer);
  } else {
    // Use expo-crypto for mobile
    const randomBytes = Crypto.getRandomBytes(32);
    return base64URLEncode(randomBytes);
  }
};

const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto?.subtle) {
    // Use browser's native SubtleCrypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(hashBuffer);
  } else {
    // Use expo-crypto for mobile
    const hashed = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier
    );
    return base64URLEncode(hashed);
  }
};

const base64URLEncode = (input: string | ArrayBuffer): string => {
  let base64: string;
  
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    // ArrayBuffer to base64
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export default function LoginScreen() {
  const { setAuth } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  
  // Generate redirect URI based on platform and environment
  const getRedirectUri = (): string => {
    if (Platform.OS === 'web') {
      // Use current origin (works with localhost OR 127.0.0.1)
      // User can access via either URL, we match what they're using
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        console.log('🔗 Web redirect URI (from origin):', origin);
        return origin;
      }
      // Fallback
      return 'http://localhost:8081';
    } else {
      // Mobile uses custom scheme
      return 'ratesangeet://callback';
    }
  };

  // Handle URL parameters on web (code from Spotify callback)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const errorParam = urlParams.get('error');
        
        if (errorParam) {
          console.error('❌ Auth error:', errorParam);
          setError(`Authentication failed: ${errorParam}`);
          setSnackbarVisible(true);
          window.history.replaceState({}, document.title, '/');
          return;
        }
        
        if (code && state) {
          setLoading(true);
          try {
            console.log('🔑 Exchanging code with server...');
            
            // Retrieve codeVerifier from localStorage (per Spotify docs)
            const codeVerifier = localStorage.getItem('spotify_code_verifier');
            const redirectUri = localStorage.getItem('spotify_redirect_uri');
            
            if (!codeVerifier) {
              throw new Error('Code verifier missing from storage');
            }
            
            // Exchange code for tokens via server
            const response = await fetch(`${config.API_URL}/auth/callback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                redirectUri: redirectUri || getRedirectUri(),
                codeVerifier,
                target: 'web',
              }),
            });
            
            const data = await response.json();
            
            if (data.success && data.data) {
              console.log('✅ Server auth successful');
              
              // Save auth data
              await setAuth({
                accessToken: data.data.accessToken,
                refreshToken: data.data.refreshToken,
                user: data.data.user,
              });
              
              console.log('✅ Auth stored, user logged in');
              
              // Clean up
              localStorage.removeItem('spotify_code_verifier');
              localStorage.removeItem('spotify_redirect_uri');
              localStorage.removeItem('spotify_state');
              window.history.replaceState({}, document.title, '/');
            } else {
              console.error('❌ Login failed:', data.error || 'Unknown error');
              setError(data.error || 'Authentication failed');
              setSnackbarVisible(true);
            }
          } catch (err: any) {
            console.error('❌ Login error:', err);
            setError(err.message || 'Authentication failed');
            setSnackbarVisible(true);
          } finally {
            setLoading(false);
          }
        }
      };
      
      handleWebCallback();
    }
  }, [setAuth]);

  // Handle deep linking on mobile (when redirected back from server with tokens)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const handleDeepLink = async (event: { url: string }) => {
        const url = event.url;
        console.log('🔗 Deep link received:', url);
        // Ignore Expo dev links and unrelated URLs
        if (url.startsWith('exp://') || url.startsWith('expo://')) {
          return;
        }
        
        // Server sends tokens directly in URL params
        if (url.includes('accessToken=')) {
          setLoading(true);
          try {
            const urlObj = new URL(url);
            const accessToken = urlObj.searchParams.get('accessToken');
            const refreshToken = urlObj.searchParams.get('refreshToken');
            const userId = urlObj.searchParams.get('userId');
            const displayName = urlObj.searchParams.get('displayName');
            const email = urlObj.searchParams.get('email');
            const profileImage = urlObj.searchParams.get('profileImage');
            const username = urlObj.searchParams.get('username');
            const error = urlObj.searchParams.get('error');
            
            if (error) {
              console.error('❌ Auth error from server:', error);
              setLoading(false);
              return;
            }
            
            if (accessToken && refreshToken) {
              console.log('✅ Received tokens from server');
              
              // Save auth data
              await setAuth({
                accessToken,
                refreshToken,
                user: {
                  id: userId || '',
                  displayName: displayName || '',
                  email: email || '',
                  profileImage: profileImage || '',
                  username: username || '',
                },
              });
              
              console.log('✅ Auth stored, user logged in');
            } else {
              console.error('❌ Missing tokens in deep link');
              setLoading(false);
            }
          } catch (error) {
            console.error('❌ Deep link login error:', error);
            setLoading(false);
          }
        }
      };

      // Listen for deep links
      const subscription = Linking.addEventListener('url', handleDeepLink);
      
      // Check if app was opened via deep link
      Linking.getInitialURL().then((url) => {
        if (url) {
          handleDeepLink({ url });
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, [setAuth]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const redirectUri = getRedirectUri();
      console.log('🔗 Using redirect URI:', redirectUri);
      
      if (Platform.OS === 'web') {
        // Web: Generate PKCE parameters and store them
        const codeVerifier = await generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = Math.random().toString(36).substring(7);
        
        // Store PKCE parameters in localStorage (per Spotify docs)
        localStorage.setItem('spotify_code_verifier', codeVerifier);
        localStorage.setItem('spotify_redirect_uri', redirectUri);
        localStorage.setItem('spotify_state', state);
        
        // Build Spotify authorization URL
        const params = new URLSearchParams({
          client_id: config.SPOTIFY_CLIENT_ID,
          response_type: 'code',
          redirect_uri: redirectUri,
          code_challenge_method: 'S256',
          code_challenge: codeChallenge,
          state,
          scope: [
            'user-read-private',
            'user-read-email',
            'user-read-recently-played',
            'user-top-read',
            'user-read-currently-playing',
            'user-read-playback-state',
          ].join(' '),
        });
        
        const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
        console.log('🔑 Redirecting to Spotify...');
        
        // Redirect to Spotify (full page redirect)
        window.location.href = authUrl;
      } else {
        // Mobile: Use expo-auth-session with PKCE
        const discovery = {
          authorizationEndpoint: 'https://accounts.spotify.com/authorize',
          tokenEndpoint: 'https://accounts.spotify.com/api/token',
        };
        
        const codeVerifier = await generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        const authRequest = new AuthSession.AuthRequest({
          clientId: config.SPOTIFY_CLIENT_ID,
          redirectUri,
          scopes: [
            'user-read-private',
            'user-read-email',
            'user-read-recently-played',
            'user-top-read',
            'user-read-currently-playing',
            'user-read-playback-state',
          ],
          usePKCE: true,
          codeChallenge,
          codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        });
        
        console.log('🔑 Opening Spotify auth...');
        const result = await authRequest.promptAsync(discovery);
        
        if (result.type === 'success' && result.params.code) {
          console.log('✅ Got authorization code');
          
          // Exchange code for tokens via server
          const response = await fetch(`${config.API_URL}/auth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: result.params.code,
              redirectUri,
              codeVerifier,
              target: 'mobile',
            }),
          });
          
          const data = await response.json();
          
          if (data.success && data.data) {
            console.log('✅ Server auth successful');
            
            // Save auth data
            await setAuth({
              accessToken: data.data.accessToken,
              refreshToken: data.data.refreshToken,
              user: data.data.user,
            });
            
            console.log('✅ Auth stored, user logged in');
          } else {
            console.error('❌ Login failed:', data.error || 'Unknown error');
            setError(data.error || 'Authentication failed');
            setSnackbarVisible(true);
          }
        } else if (result.type === 'error') {
          console.error('❌ Auth error:', result.error);
          setError(result.error?.message || 'Authentication failed');
          setSnackbarVisible(true);
        } else {
          console.log('🔙 Auth cancelled');
        }
        
        setLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Login error:', err);
      setError(err.message || 'Authentication failed');
      setSnackbarVisible(true);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* App Logo/Icon */}
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

        {/* Features List */}
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

type FeatureItemProps = {
  icon: string;
  text: string;
  theme: any;
};

function FeatureItem({ icon, text, theme }: FeatureItemProps) {
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
