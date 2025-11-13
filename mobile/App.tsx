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

  // Handle deep link callback from Spotify OAuth
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
