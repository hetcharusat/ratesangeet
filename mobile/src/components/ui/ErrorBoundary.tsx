import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import RSButton from './RSButton';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text variant="headlineMedium" style={styles.title}>Something went wrong</Text>
          <Text variant="bodyLarge" style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <RSButton mode="contained" onPress={this.handleRestart} style={{ marginTop: 24 }}>
            Restart App
          </RSButton>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
