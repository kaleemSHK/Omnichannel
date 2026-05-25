import React, { Component, type ReactNode } from 'react';
import { View, Text } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-bg items-center justify-center p-6">
          <Text className="text-danger text-lg font-bold mb-2">Something went wrong</Text>
          <Text className="text-text-secondary text-center">Please restart the app.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
