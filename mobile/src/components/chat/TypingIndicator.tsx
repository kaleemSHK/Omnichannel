import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export function TypingIndicator() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 400 }), withTiming(0.3, { duration: 400 })),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="flex-row gap-1 px-4 py-2">
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={style} className="w-2 h-2 rounded-full bg-text-muted" />
      ))}
    </View>
  );
}
