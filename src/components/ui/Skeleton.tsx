import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ViewStyle, StyleProp } from 'react-native';

export function Skeleton({ style }: { style: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 850, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#E5E7EB',
          borderRadius: 8,
        },
        style,
        animatedStyle,
      ]}
    />
  );
}
