import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

import { AnimatedPress } from '@/components/ui';
import { DayMenuConfig } from '../../data/WeeklyMenuTypes';
import { Radii, Palette, Colors } from '@/theme';

interface KitchenNeedsBannerProps {
  config: DayMenuConfig;
  onViewMenuPress?: () => void;
}

export const KitchenNeedsBanner: React.FC<KitchenNeedsBannerProps> = ({
  config,
  onViewMenuPress,
}) => {
  const { type, day, menu } = config;
  const isVeg = type === 'pureVeg' || type === 'veg';

  // Dynamic styles based on food type matching:
  // - Green + Cream for Pure Veg
  // - Green + Orange + Cream for Non-Veg
  const cardBg = isVeg ? Colors.surfaceElevated : Palette.TintAmber;
  const accentBorder = isVeg ? Colors.success : Colors.warning;
  const badgeBg = isVeg ? Colors.surfaceElevated : Palette.TintAmber;
  const badgeText = isVeg ? Colors.success : Colors.warning;
  const dishText = isVeg ? Colors.success : Colors.warning;

  return (
    <View style={[styles.bannerCard, { backgroundColor: cardBg, borderColor: accentBorder }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <Text maxFontSizeMultiplier={1.3} style={styles.dayLabel}>{day.toUpperCase()}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text maxFontSizeMultiplier={1.3} style={[styles.badgeText, { color: badgeText }]}>
            {isVeg ? '🥗 PURE VEG DAY' : '🍗 NON-VEG DAY'}
          </Text>
        </View>
      </View>

      {/* Menu Dishes List */}
      <View style={styles.menuContainer}>
        <Text maxFontSizeMultiplier={1.3} style={[styles.dishesText, { color: dishText }]} numberOfLines={2}>
          {menu.slice(0, 4).join(' • ')}
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.supportingText}>Fresh ingredients for today's kitchen</Text>
      </View>

      {/* Bottom View Menu Button */}
      <View style={styles.footerRow}>
        <AnimatedPress accessibilityRole="button"
          style={[styles.viewMenuBtn, { backgroundColor: isVeg ? Colors.success : Colors.warning }]}

          onPress={onViewMenuPress}
        >
          <Text maxFontSizeMultiplier={1.3} style={styles.viewMenuText}>View Menu</Text>
        </AnimatedPress>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerCard: {
    width: 320,
    height: 180,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    padding: 16,
    justifyContent: 'space-between',
    alignSelf: 'center',
    marginVertical: 10,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.control,
  },
  badgeText: {
    fontSize: 10,
  },
  menuContainer: {
    marginVertical: 8,
  },
  dishesText: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 4,
  },
  supportingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  viewMenuBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.control,
  },
  viewMenuText: {
    color: Colors.textInverse,
    fontSize: 11,
  },
});

export default KitchenNeedsBanner;
