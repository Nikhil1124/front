import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { Colors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

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
  },
  title: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  action: {
    fontSize: 12,
    color: Colors.primary,
  },
});
