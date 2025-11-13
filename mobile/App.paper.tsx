import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Contexts
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ScrobbleProvider } from './src/context/ScrobbleContext';

// Screens
import LoginScreenPaper from './src/screens/LoginScreenPaper';
import MainNavigator from './src/navigation/MainNavigator';

const Stack = createStackNavigator();

// Custom Dark Theme matching Spotify
const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#1DB954',
    secondary: '#191414',
    background: '#121212',
    surface: '#191414',
    surfaceVariant: '#282828',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#B3B3B3',
  },
};

function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a splash screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreenPaper} />
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <ScrobbleProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <AppNavigator />
            </NavigationContainer>
          </ScrobbleProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
