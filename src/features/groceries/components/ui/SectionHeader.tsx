import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppColors, AppFonts } from '../../theme/AppColors';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared section header: left bold title + optional right-side "See All →" action.
 * Replaces duplicated recHeaderRow / relatedHeaderRow patterns in Cart, ProductDetail, Home.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
  },
  action: {
    fontSize: 12,
    fontFamily: AppFonts.bold,
    color: AppColors.primary,
  },
});
