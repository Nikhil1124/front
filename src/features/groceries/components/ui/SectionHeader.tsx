import React from 'react';
import { View, StyleSheet } from 'react-native';

import { GroceryColors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared section header: left bold title + optional right-side "See All →" action.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actionLabel, onAction }) => {
  return (
    <View style={styles.row}>
      <Txt maxFontSizeMultiplier={1.3} style={styles.title}>{title}</Txt>
      {actionLabel && onAction ? (
        <AnimatedPress accessibilityRole="button" onPress={onAction}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.action}>{actionLabel}</Txt>
        </AnimatedPress>
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
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
    color: GroceryColors.primary,
  },
});
