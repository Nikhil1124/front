import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';

import { AnimatedPress, Txt } from '@/components/ui';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Colors } from '@/theme';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '@/store/authStore';

interface HeaderProps {
  /** Static "delivering to" line — groceries always ship to the PG's own
   *  address, so there is no map picker here (unlike the source app). */
  deliveryLabel: string;
  onProfilePress: () => void;
  /** Leaves the groceries mini-app back to whatever screen pushed it. */
  onBack: () => void;
}

export const Header: React.FC<HeaderProps> = ({ deliveryLabel, onProfilePress, onBack }) => {
  // Every other screen's header (TabHeader, HubScreenWrapper) pads by insets.top + 14 — this
  // one used a fixed 4/8pt instead, so it sat under the status bar / notch. Same fix, same
  // value, so the grocery mini-app's header lines up with the rest of the app.
  const insets = useSafeAreaInsets();
  // Same derivation GroceryProfileScreen.tsx uses — this avatar used to be hardcoded "S"
  // regardless of who was signed in.
  const userName = useAuthStore((s) => s.user?.name);
  const avatarLetter = (userName?.trim().charAt(0).toUpperCase()) || 'P';
  return (
    <BlurView intensity={80} tint="light" style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </AnimatedPress>
      <View style={styles.headerLeft}>
        <View style={styles.deliveryContainer}>
          <View style={styles.deliveryBadge}>
            <Ionicons name="time" size={13} color={Colors.textInverse} />
            {/* Matches checkout's actual fastest slot ("Express • 15–25 min") — this used
                to promise a flat "10 MINS", a number nothing in the order flow can meet. */}
            <Txt maxFontSizeMultiplier={1.3} style={styles.deliveryBadgeText}>EXPRESS</Txt>
          </View>
          <Txt maxFontSizeMultiplier={1.3} style={styles.deliveryText}>Delivery to</Txt>
        </View>
        <View style={styles.locationRow}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.locationTitle} numberOfLines={1}>
            {deliveryLabel}
          </Txt>
        </View>
      </View>

      <AnimatedPress accessibilityRole="button"
        style={styles.profileIconBtn}
        onPress={onProfilePress}

      >
        <View style={styles.profileAvatar}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.profileAvatarText}>{avatarLetter}</Txt>
        </View>
      </AnimatedPress>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  deliveryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  deliveryBadge: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.badge,
    gap: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryBadgeText: {
    color: Colors.textInverse,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  deliveryText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginRight: 2,
    maxWidth: '85%',
  },
  profileIconBtn: {
    padding: 2,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surfaceElevated,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  profileAvatarText: {
    color: Colors.textInverse,
    fontSize: 16,
  },
});
