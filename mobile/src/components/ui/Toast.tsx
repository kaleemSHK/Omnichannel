import { Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { C } from '@/lib/ui';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide?: () => void;
}

const BG: Record<ToastType, string> = {
  success: C.green,
  error: C.red,
  info: C.brand,
};

export function Toast({ message, type = 'info', visible, onHide }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onHide?.(), 3000);
    return () => clearTimeout(t);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[styles.container, { backgroundColor: BG[type] }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 50,
  },
  text: {
    color: C.textWhite,
    fontWeight: '500',
    textAlign: 'center',
  },
});
