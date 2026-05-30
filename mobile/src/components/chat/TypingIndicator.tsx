import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { C } from '@/lib/ui';

export function TypingIndicator() {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.9, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[style, { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textMute }]} />
      ))}
    </View>
  );
}
