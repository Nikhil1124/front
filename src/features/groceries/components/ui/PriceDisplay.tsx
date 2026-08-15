import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors, AppFonts } from '../../theme/AppColors';

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
      <Text style={[styles.price, styles[`price_${size}`]]}>
        {prefix}{price}
      </Text>

      {originalPrice && originalPrice > price ? (
        <Text style={[styles.strike, styles[`strike_${size}`]]}>
          {prefix}{originalPrice}
        </Text>
      ) : null}

      {showBadge && discountPercent > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{discountPercent}% off</Text>
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
    fontFamily: AppFonts.bold,
    color: AppColors.primary,
  },
  price_sm: { fontSize: 12 },
  price_md: { fontSize: 15 },
  price_lg: { fontSize: 20 },

  strike: {
    fontFamily: AppFonts.regular,
    color: AppColors.textMuted,
    textDecorationLine: 'line-through',
  },
  strike_sm: { fontSize: 10 },
  strike_md: { fontSize: 12 },
  strike_lg: { fontSize: 14 },

  badge: {
    backgroundColor: AppColors.error,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: AppColors.surface,
    fontSize: 9,
    fontFamily: AppFonts.bold,
  },
});
