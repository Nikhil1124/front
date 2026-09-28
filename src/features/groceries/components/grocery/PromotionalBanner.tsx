import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

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
  if (!source) return null;

  const isHero = variant === 'hero';
  const bannerWidth = isHero ? width : width - 32;
  const bannerHeight = bannerWidth * (isHero ? 0.75 : 0.42);

  return (
    <AnimatedPress
      accessibilityRole="button"
      accessibilityLabel="Offer banner"
      onPress={onPress}
      style={[styles.outer, !isHero && styles.stripOuter]}
    >
      <View
        style={[
          styles.frame,
          { width: bannerWidth, height: bannerHeight },
          !isHero && styles.stripFrame,
        ]}
      >
        <Image source={source} style={styles.image} resizeMode="cover" />
      </View>
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
