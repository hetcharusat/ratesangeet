import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, TextInput, Platform, Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ScrobbleProvider } from './src/context/ScrobbleContext';
import LoginScreen from './src/screens/LoginScreen';
import MainNavigator from './src/navigation/MainNavigator';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import * as WebBrowser from 'expo-web-browser';
import * as Updates from 'expo-updates';
import { md3BaselineLight } from './src/theme';
import config from './src/config';

const Stack = createStackNavigator();

// Use MD3 Baseline Light theme as default
const theme = md3BaselineLight;

function AppNavigator() {
  const { user, isLoading, setAuth } = useAuth();

  // Handle web OAuth callback (runs before navigation decision)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleWebCallback = async () => {
      // Skip callback handling if already authenticated
      if (auth.accessToken) {
        console.log('🔍 [App] Already authenticated, skipping callback handler');
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const errorParam = urlParams.get('error');

      console.log('🔍 [App] Callback check:', { hasCode: !!code, hasError: !!errorParam });

      // No OAuth params = not a callback
      if (!code && !errorParam) return;

      console.log('✅ [App] OAuth callback detected! Processing...');

      // Clear URL immediately (security: don't leave code in history)
      window.history.replaceState({}, document.title, '/');

      // Handle Spotify error
      if (errorParam) {
        console.error('❌ Spotify OAuth error:', errorParam);
        Alert.alert('Authentication Failed', errorParam);
        return;
      }

      if (!code) return;

      try {
        // Retrieve PKCE parameters from storage
        const storedVerifier = localStorage.getItem('spotify_code_verifier');
        const storedState = localStorage.getItem('spotify_state');
        const storedRedirectUri = localStorage.getItem('spotify_redirect_uri');

        if (!storedVerifier) {
          throw new Error('Code verifier not found. Please try logging in again.');
        }

        // Validate state (CSRF protection)
        if (state !== storedState) {
          throw new Error('Invalid state parameter. Possible CSRF attack.');
        }

        console.log('🔑 [App] Exchanging authorization code for tokens...');

        // Exchange code for tokens via backend
        const response = await fetch(`${config.API_URL}/auth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier: storedVerifier,
            redirectUri: storedRedirectUri,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || 'Authentication failed');
        }

        console.log('✅ [App] Login successful!');

        // Clear stored PKCE params
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_state');
        localStorage.removeItem('spotify_redirect_uri');

        // Save auth state
        setAuth(
          data.data.accessToken,
          data.data.refreshToken,
          data.data.user
        );

      } catch (error: any) {
        console.error('❌ [App] Token exchange failed:', error);
        Alert.alert('Login Failed', error.message || 'Authentication failed');
      }
    };

    handleWebCallback();
  }, [setAuth]);

  // Handle deep link callback from Spotify OAuth (mobile)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      
      // Check if this is a Spotify callback
      if (url.startsWith('ratesangeet://callback')) {
        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          
          if (code) {
            // Exchange code for tokens
            const response = await fetch(`${config.API_URL}/auth/callback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                redirectUri: 'ratesangeet://callback',
                target: 'mobile',
              }),
            });
            
            const data = await response.json();
            
            if (data.success && data.data) {
              // Save auth data
              await setAuth({
                accessToken: data.data.accessToken,
                refreshToken: data.data.refreshToken,
                user: data.data.user,
              });
            } else {
              Alert.alert('Login Failed', data.error || 'Failed to authenticate with Spotify');
            }
          }
        } catch (error) {
          console.error('Deep link handling error:', error);
          Alert.alert('Error', 'Failed to complete authentication');
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [setAuth]);

  if (isLoading) {
    return null; // Or a splash screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  // Check for OTA updates on app launch
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) return; // Skip in development
      
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update Available',
            'A new version has been downloaded. Restart the app to apply.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Restart Now', onPress: () => Updates.reloadAsync() }
            ]
          );
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    }
    
    checkForUpdates();
  }, []);

  // Disable font scaling globally to prevent UI breakage on devices with large accessibility fonts
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const T: any = Text;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const TI: any = TextInput;
      T.defaultProps = {
        ...(T.defaultProps || {}),
        allowFontScaling: false,
      };
      TI.defaultProps = {
        ...(TI.defaultProps || {}),
        allowFontScaling: false,
      };
    } catch {}
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <ScrobbleProvider>
              <NavigationContainer>
                <StatusBar style="dark" />
                <AppNavigator />
              </NavigationContainer>
            </ScrobbleProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
