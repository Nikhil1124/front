import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { DayMenuConfig } from '../../data/WeeklyMenuTypes';
import { AppColors, AppFonts } from '../../theme/AppColors';

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
  const cardBg = isVeg ? '#F0FDF4' : '#FFF7ED';
  const accentBorder = isVeg ? '#15803D' : '#F97316';
  const badgeBg = isVeg ? '#DCFCE7' : '#FFEFD6';
  const badgeText = isVeg ? '#166534' : '#C2410C';
  const dishText = isVeg ? '#166534' : '#7C2D12';

  return (
    <View style={[styles.bannerCard, { backgroundColor: cardBg, borderColor: accentBorder }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.dayLabel}>{day.toUpperCase()}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeText }]}>
            {isVeg ? '🥗 PURE VEG DAY' : '🍗 NON-VEG DAY'}
          </Text>
        </View>
      </View>

      {/* Menu Dishes List */}
      <View style={styles.menuContainer}>
        <Text style={[styles.dishesText, { color: dishText }]} numberOfLines={2}>
          {menu.slice(0, 4).join(' • ')}
        </Text>
        <Text style={styles.supportingText}>Fresh ingredients for today's kitchen</Text>
      </View>

      {/* Bottom View Menu Button */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          style={[styles.viewMenuBtn, { backgroundColor: isVeg ? '#15803D' : '#F97316' }]}
          activeOpacity={0.8}
          onPress={onViewMenuPress}
        >
          <Text style={styles.viewMenuText}>View Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerCard: {
    width: 320,
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    justifyContent: 'space-between',
    alignSelf: 'center',
    marginVertical: 10,
    shadowColor: '#17201A',
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
    fontFamily: AppFonts.bold,
    color: '#647067',
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: AppFonts.bold,
  },
  menuContainer: {
    marginVertical: 8,
  },
  dishesText: {
    fontSize: 18,
    fontFamily: AppFonts.bold,
    lineHeight: 22,
    marginBottom: 4,
  },
  supportingText: {
    fontSize: 12,
    fontFamily: AppFonts.regular,
    color: '#647067',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  viewMenuBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewMenuText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: AppFonts.bold,
  },
});

export default KitchenNeedsBanner;
