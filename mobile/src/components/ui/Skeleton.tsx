import { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, interpolate, Extrapolation } from 'react-native-reanimated';
import { C } from '@/lib/ui';

const W = Dimensions.get('window').width;

interface SkeletonProps { style?: object; }

export function Skeleton({ style }: SkeletonProps) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [shimmer]);
  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-W, W], Extrapolation.CLAMP);
    return { transform: [{ translateX }] };
  });
  return (
    <View style={[{ backgroundColor: C.bgMuted, borderRadius: 8, height: 16, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle, { width: '40%', backgroundColor: 'rgba(0,0,0,0.06)' }]} />
    </View>
  );
}
