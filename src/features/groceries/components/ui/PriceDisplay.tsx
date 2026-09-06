import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Radii, Colors } from '@/theme';
import { Txt } from '@/components/ui';


export interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  /** Size variant. Default: 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Show discount percentage badge. Default: false */
  showBadge?: boolean;
  /** Prefix character. Default: '₹' */
  prefix?: string;
}

/**
 * Reusable price display with strikethrough MRP and optional discount badge.
 * Used across ProductCard, MiniProductCard, Cart, and ProductDetail.
 */
export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  originalPrice,
  size = 'md',
  showBadge = false,
  prefix = '₹',
}) => {
  const discountPercent = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <View style={styles.row}>
      <Txt maxFontSizeMultiplier={1.3} style={[styles.price, styles[`price_${size}`]]}>
        {prefix}{price}
      </Txt>

      {originalPrice && originalPrice > price ? (
        <Txt maxFontSizeMultiplier={1.3} style={[styles.strike, styles[`strike_${size}`]]}>
          {prefix}{originalPrice}
        </Txt>
      ) : null}

      {showBadge && discountPercent > 0 ? (
        <View style={styles.badge}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.badgeText}>{discountPercent}% off</Txt>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 5,
  },
  price: {
    color: Colors.primary,
  },
  price_sm: { fontSize: 12 },
  price_md: { fontSize: 15 },
  price_lg: { fontSize: 20 },

  strike: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  strike_sm: { fontSize: 10 },
  strike_md: { fontSize: 12 },
  strike_lg: { fontSize: 14 },

  badge: {
    backgroundColor: Colors.danger,
    borderRadius: Radii.badge,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 9,
  },
});
