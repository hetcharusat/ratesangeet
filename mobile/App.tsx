import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, TextInput, Platform, Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ScrobbleProvider } from './src/context/ScrobbleContext';
import AppNavigator from './src/navigation/AppNavigator';
import * as WebBrowser from 'expo-web-browser';
import * as Updates from 'expo-updates';

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
    <AuthProvider>
      <ScrobbleProvider>
        <SafeAreaProvider>
          <AppNavigator />
          <StatusBar style="light" />
        </SafeAreaProvider>
      </ScrobbleProvider>
    </AuthProvider>
  );
}
