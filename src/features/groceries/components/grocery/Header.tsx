import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, AppFonts } from '../../theme/AppColors';

interface HeaderProps {
  /** Static "delivering to" line — groceries always ship to the PG's own
   *  address, so there is no map picker here (unlike the source app). */
  deliveryLabel: string;
  onProfilePress: () => void;
  /** Leaves the groceries mini-app back to whatever screen pushed it. */
  onBack: () => void;
}

export const Header: React.FC<HeaderProps> = ({ deliveryLabel, onProfilePress, onBack }) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={AppColors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerLeft}>
        <View style={styles.deliveryContainer}>
          <View style={styles.deliveryBadge}>
            <Ionicons name="time" size={13} color="#fff" />
            <Text style={styles.deliveryBadgeText}>10 MINS</Text>
          </View>
          <Text style={styles.deliveryText}>Delivery to</Text>
        </View>
        <View style={styles.locationRow}>
          <Text style={styles.locationTitle} numberOfLines={1}>
            {deliveryLabel}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.profileIconBtn}
        onPress={onProfilePress}
        activeOpacity={0.8}
      >
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>S</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 10,
    backgroundColor: AppColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
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
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: AppFonts.extraBold,
    letterSpacing: 0.3,
  },
  deliveryText: {
    fontSize: 11,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
    marginRight: 2,
    maxWidth: '85%',
  },
  profileIconBtn: {
    padding: 2,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppColors.primaryLight,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
  },
});
