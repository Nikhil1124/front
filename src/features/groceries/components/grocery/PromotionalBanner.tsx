import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';

import { AnimatedPress } from '@/components/ui';
import { Radii } from '@/theme';
import { storefrontImage, type BuiltinImage } from '../../useStorefront';

interface PromotionalBannerProps {
  imageUrl: string | null;
  builtinImage: BuiltinImage | null;
  /** `hero`: full width under the search bar. `banner`: a card-width strip further down. */
  variant: 'hero' | 'banner';
  onPress: () => void;
}

/** A banner from the storefront — the picture ops uploaded in the portal (animated GIFs play). */
export const PromotionalBanner: React.FC<PromotionalBannerProps> = ({
  imageUrl,
  builtinImage,
  variant,
  onPress,
}) => {
  const { width } = useWindowDimensions();
  const source = storefrontImage(imageUrl, builtinImage);

  const isHero = variant === 'hero';
  const bannerWidth = isHero ? width : width - 32;
  const bannerHeight = bannerWidth * (isHero ? 0.75 : 0.42);

  // Subtle pulsing glow.
  //
  // Every hook stays ABOVE the `!source` return below. React tracks hooks by call order, so a
  // banner that renders empty once and then gets its picture — which is exactly what happens
  // when the storefront refetches after an upload — would call three more hooks on the second
  // render than the first, and React throws rather than rendering.
  const glowOpacity = useSharedValue(0.3);
  React.useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [glowOpacity]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    shadowColor: '#FFD54A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value,
    shadowRadius: 15,
    elevation: glowOpacity.value * 15,
  }));

  if (!source) return null;

  return (
    <AnimatedPress
      accessibilityRole="button"
      accessibilityLabel="Offer banner"
      onPress={onPress}
      style={[styles.outer, !isHero && styles.stripOuter]}
    >
      <Animated.View
        style={[
          { width: bannerWidth, height: bannerHeight },
          !isHero && { borderRadius: Radii.card, backgroundColor: '#FFD54A' },
          animatedGlowStyle,
        ]}
      >
        <View style={[styles.frame, { width: '100%', height: '100%' }, !isHero && styles.stripFrame]}>
          <Image source={source} style={styles.image} resizeMode="cover" />
        </View>
      </Animated.View>
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center' },
  stripOuter: { marginVertical: 12 },
  frame: { overflow: 'hidden' },
  stripFrame: { borderRadius: Radii.card },
  image: { width: '100%', height: '100%' },
});
