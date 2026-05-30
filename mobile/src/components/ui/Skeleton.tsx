import { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const W = Dimensions.get('window').width;

interface SkeletonProps {
  className?: string;
  style?: object;
}

export function Skeleton({ className, style }: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-W, W], Extrapolation.CLAMP);
    return { transform: [{ translateX }] };
  });

  return (
    <View
      style={[{ backgroundColor: '#22263a', borderRadius: 8, overflow: 'hidden' }, style]}
      className={className ?? 'h-4 rounded-lg'}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          shimmerStyle,
          { width: '40%', backgroundColor: 'rgba(255,255,255,0.06)' },
        ]}
      />
    </View>
  );
}
