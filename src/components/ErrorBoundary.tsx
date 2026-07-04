import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort safety net for render-time exceptions. Without this, any
 * uncaught error in a screen white-screens the app with no way back and no
 * diagnostic trail (there is no crash reporting wired up in this app).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.description}>
            Please try again. If the problem continues, restart the app.
          </Text>
          <Button title="Try Again" onPress={this.handleReset} variant="primary" size="medium" />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 22,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
