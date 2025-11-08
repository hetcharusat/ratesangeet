import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, TextInput, Platform, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ScrobbleProvider } from './src/context/ScrobbleContext';
import AppNavigator from './src/navigation/AppNavigator';
import * as WebBrowser from 'expo-web-browser';

export default function App() {
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
