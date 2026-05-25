import { View, Text } from 'react-native';
import { useEffect } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide?: () => void;
}

const BG: Record<ToastType, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-brand',
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
      className={`absolute bottom-8 left-4 right-4 ${BG[type]} rounded-xl px-4 py-3 z-50`}
    >
      <Text className="text-black font-medium text-center">{message}</Text>
    </Animated.View>
  );
}
