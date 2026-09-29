import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Svg, Path } from 'react-native-svg';

const GOLD_COLORS = ['#FFD54A', '#FFF0A6', '#FF9D24', '#F97316', '#FFF8E1'];

const StarSparkle = ({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite loop
        true
      )
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      opacity: interpolate(progress.value, [0, 1], [0, 0.8]),
      transform: [
        { scale: interpolate(progress.value, [0, 1], [0.4, 1.2]) },
        { rotate: `${progress.value * 90}deg` },
      ],
    };
  });

  // 4-point star using SVG
  return (
    <Animated.View style={style} pointerEvents="none">
      <Svg viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 0C12 0 13.5 10.5 24 12C24 12 13.5 13.5 12 24C12 24 10.5 13.5 0 12C0 12 10.5 10.5 12 0Z"
          fill="#FFF0A6"
        />
      </Svg>
    </Animated.View>
  );
};

const FloatingParticle = ({ config }: { config: any }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      )
    );
  }, [config, progress]);

  const style = useAnimatedStyle(() => {
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [config.startY, config.startY - config.travelDistance]
    );
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [config.startX, config.startX + config.horizontalDrift]
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.2, 0.8, 1],
      [0, config.maxOpacity, config.maxOpacity, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      progress.value,
      [0, 0.5, 1],
      [config.scale * 0.5, config.scale, config.scale * 0.8]
    );
    const rotate = interpolate(
      progress.value,
      [0, 1],
      [0, config.rotation]
    );

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: config.size,
      height: config.size,
      backgroundColor: config.color,
      borderRadius: config.size / 2,
      opacity,
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate: `${rotate}deg` }
      ],
    };
  });

  return <Animated.View style={style} pointerEvents="none" />;
};

const GoldenLightTrail = ({ config }: { config: any }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        false
      )
    );
  }, [config, progress]);

  const style = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [config.startY, config.startY - config.travelDistance]);
    const translateX = interpolate(progress.value, [0, 1], [config.startX, config.startX + config.horizontalDrift]);
    const opacity = interpolate(progress.value, [0, 0.3, 0.7, 1], [0, 0.4, 0.4, 0], Extrapolation.CLAMP);

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: config.width,
      height: config.height,
      backgroundColor: '#FFD54A',
      borderRadius: config.width / 2,
      opacity,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${config.rotate}deg` }
      ],
    };
  });

  return <Animated.View style={style} pointerEvents="none" />;
};

export function DussehraPromoLayer() {
  const { width, height } = useWindowDimensions();

  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const isForeground = Math.random() > 0.5;
      return {
        id: i,
        startX: Math.random() * width,
        startY: (height * 0.4) + (Math.random() * 200), // Start around banner area
        travelDistance: 300 + Math.random() * 600,
        horizontalDrift: (Math.random() - 0.5) * 200,
        duration: 2500 + Math.random() * 2500,
        delay: Math.random() * 5000,
        size: 3 + Math.random() * 6,
        color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
        maxOpacity: 0.4 + Math.random() * 0.6,
        scale: 0.5 + Math.random() * 1.5,
        rotation: (Math.random() - 0.5) * 360,
        zIndex: isForeground ? 10 : 0,
      };
    });
  }, [width, height]);

  const sparkles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      x: width * 0.1 + Math.random() * (width * 0.8),
      y: height * 0.15 + Math.random() * (height * 0.45),
      size: 15 + Math.random() * 25,
      delay: Math.random() * 4000,
    }));
  }, [width, height]);

  const trails = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      startX: width * 0.2 + Math.random() * (width * 0.6),
      startY: height * 0.5 + Math.random() * 100,
      travelDistance: 500 + Math.random() * 300,
      horizontalDrift: (Math.random() - 0.5) * 150,
      duration: 3500 + Math.random() * 1500,
      delay: Math.random() * 6000,
      width: 2 + Math.random() * 2,
      height: 60 + Math.random() * 80,
      rotate: (Math.random() - 0.5) * 45,
    }));
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Background Particles */}
      {particles.filter(p => p.zIndex === 0).map(p => (
        <FloatingParticle key={`bg-${p.id}`} config={p} />
      ))}

      {/* Trails */}
      {trails.map(t => (
        <GoldenLightTrail key={`trail-${t.id}`} config={t} />
      ))}

      {/* Foreground Particles */}
      {particles.filter(p => p.zIndex === 10).map(p => (
        <FloatingParticle key={`fg-${p.id}`} config={p} />
      ))}

      {/* Sparkles */}
      {sparkles.map(s => (
        <StarSparkle key={`sparkle-${s.id}`} x={s.x} y={s.y} size={s.size} delay={s.delay} />
      ))}
    </View>
  );
}
