import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

interface HeaderProps {
  /** "PG Name • Address" or just "Your PG" when not loaded yet */
  deliveryLabel: string;
  /** Cart item count for badge */
  cartItemCount?: number;
  onCartPress?: () => void;
  onNotificationPress?: () => void;
  /** Back button — shown only on sub-screens, not on the home tab */
  showBack?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  deliveryLabel,
  cartItemCount = 0,
  onCartPress,
  onNotificationPress,
  showBack = false,
  onBack,
}) => {
  const insets = useSafeAreaInsets();

  // Split "PG Name • Address" into name + address for two-line layout
  const parts = deliveryLabel.split(' • ');
  const pgName = parts[0] ?? deliveryLabel;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.leftSection}>
        {showBack ? (
          <AnimatedPress
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={styles.backBtn}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={20} color={GroceryColors.white} />
          </AnimatedPress>
        ) : (
          <View style={styles.locationIconWrapper}>
            <Ionicons name="location-sharp" size={16} color="#7DFFCB" />
          </View>
        )}

        <AnimatedPress
          accessibilityRole="button"
          style={styles.deliveryInfo}
          onPress={() => {}}
        >
          <Txt maxFontSizeMultiplier={1.2} style={styles.deliverInLabel}>
            8 minutes
          </Txt>
          <View style={styles.pgNameRow}>
            <Txt
              maxFontSizeMultiplier={1.2}
              style={styles.pgName}
              numberOfLines={1}
            >
              HOME - {pgName}
            </Txt>
            <Ionicons name="chevron-down" size={12} color={'rgba(255,255,255,0.7)'} style={{ marginLeft: 4 }} />
          </View>
        </AnimatedPress>
      </View>

      <View style={styles.rightSection}>
        {/* Support/Orders icons */}
        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          style={styles.iconBtn}
          onPress={onCartPress} // Map to cart for now if needed, or leave blank
        >
          <Ionicons name="cube-outline" size={24} color={GroceryColors.white} />
        </AnimatedPress>

        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          style={styles.iconBtn}
          onPress={onNotificationPress}
        >
          <Ionicons name="person-circle-outline" size={26} color={GroceryColors.white} />
        </AnimatedPress>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: GroceryColors.primaryDark,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  locationIconWrapper: {
    marginRight: 2,
  },
  backBtn: {
    marginRight: 4,
    padding: 2,
  },
  deliveryInfo: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  deliverInLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: GroceryColors.white,
    letterSpacing: -0.5,
  },
  pgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pgName: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    maxWidth: 200, // Leave room for right icons
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: Radii.pill,
    backgroundColor: GroceryColors.discountRed,
    borderWidth: 1.5,
    borderColor: GroceryColors.primaryDark,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: Radii.pill,
    backgroundColor: GroceryColors.discountRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: GroceryColors.primaryDark,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: GroceryColors.white,
  },
});
