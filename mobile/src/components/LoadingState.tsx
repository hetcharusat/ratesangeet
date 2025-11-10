import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Text, withTheme } from 'react-native-paper';
import { Theme } from 'react-native-paper/lib/typescript/types';

interface LoadingStateProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
  theme: Theme;
}

const LoadingStateWithoutTheme: React.FC<LoadingStateProps> = ({
  loading,
  error,
  onRetry,
  empty,
  emptyMessage = 'No data available',
  children,
  theme,
}) => {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating={true} color={theme.colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: theme.colors.backdrop }}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ color: theme.colors.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        {onRetry && (
          <Button mode="contained" onPress={onRetry}>
            Try Again
          </Button>
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
        <Text style={{ color: theme.colors.backdrop, fontSize: 16, textAlign: 'center' }}>{emptyMessage}</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});

export const LoadingState = withTheme(LoadingStateWithoutTheme);
