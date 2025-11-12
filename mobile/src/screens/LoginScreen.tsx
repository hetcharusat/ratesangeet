import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Platform, Linking } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { Motion } from '../theme/tokens';
import config from '../config';

// Required for WebBrowser to work properly on mobile
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export default function LoginScreen() {
  const { setAuth } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  // Handle URL parameters on web (code from Spotify callback)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          setLoading(true);
          try {
            console.log('🔑 Exchanging code with server...');
            
            // Exchange code for tokens via server
            const response = await fetch(`${config.API_URL}/auth/callback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                redirectUri: window.location.origin,
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
              
              // Clean URL
              window.history.replaceState({}, document.title, '/');
            } else {
              console.error('❌ Login failed:', data.error || 'Unknown error');
            }
          } catch (error) {
            console.error('❌ Login error:', error);
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
    try {
      // Step 1: Get Spotify auth URL from server
      const authUrl = `${config.API_URL}/auth/login?target=${Platform.OS === 'web' ? 'web' : 'mobile'}`;
      const response = await fetch(authUrl);
      const data = await response.json();
      
      if (data.success && data.data?.url) {
        // Step 2: Open Spotify OAuth
        if (Platform.OS === 'web') {
          // On web, redirect in same window
          window.location.href = data.data.url;
        } else {
          // On mobile, use openBrowserAsync which works better for OAuth
          // It opens system browser but properly handles the redirect back
          console.log('🔑 Opening Spotify auth...');
          
          const result = await WebBrowser.openBrowserAsync(data.data.url);
          
          console.log('🔑 Browser closed:', result.type);
          // Note: The actual auth callback is handled by deep linking
          // See the useEffect below for handling the redirect
          setLoading(false);
        }
      } else {
        console.error('Failed to get auth URL:', data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Login failed:', error);
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
