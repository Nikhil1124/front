import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

interface HeroBannerProps {
  onPress?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onPress }) => {
  return (
    <AnimatedPress accessibilityRole="button" onPress={onPress} style={styles.outerContainer}>
      <View style={styles.dashedContainer}>
        <Txt maxFontSizeMultiplier={1.1} style={styles.megaText}>MEGA</Txt>
        <Txt maxFontSizeMultiplier={1.1} style={styles.saleText}>SALE</Txt>
        <View style={styles.pillBadge}>
          <Txt maxFontSizeMultiplier={1.1} style={styles.pillText}>UP TO 80% OFF</Txt>
        </View>
      </View>
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedContainer: {
    borderWidth: 2,
    borderColor: '#E6D35E', // Yellowish dash
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(230, 211, 94, 0.05)', // slight tint
  },
  megaText: {
    fontSize: 28,
    fontWeight: '900',
    color: GroceryColors.white,
    letterSpacing: 2,
    lineHeight: 30,
  },
  saleText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#E6D35E', // Yellow text
    lineHeight: 36,
    marginBottom: 12,
  },
  pillBadge: {
    backgroundColor: '#E6D35E',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    position: 'absolute',
    bottom: -14, // overlap the bottom border
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: GroceryColors.primaryDark,
  },
});
