/**
 * EmptyState — a consistent "this list is empty" placeholder used across all
 * dashboard tabs. Icon + title + optional subtitle, centred in a card.
 *
 * Every list on the dashboards (meals, complaints, expenses, guests, payments)
 * has at least three reasons to be empty: nothing created yet, all filtered
 * out, or the API returned 0. Showing a friendly icon + caption stops the
 * user from wondering if the screen is still loading.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Card, Spacer } from '@/components/ui';
import { Colors } from '@/theme';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  accent?: string;
}

export function EmptyState({
  icon = 'information-circle',
  title,
  subtitle,
  accent = Colors.SlateMutedText,
}: EmptyStateProps) {
  return (
    <Card
      containerColor={Colors.LuxurySurfaceDark}
      borderRadius={16}
      borderWidth={1}
      borderColor="rgba(126,149,153,0.18)"
      padding={[32, 24]}
    >
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
          <Ionicons name={icon} size={36} color={accent} />
        </View>
        <Spacer size={12} />
        <Txt size={14} weight="700" color={Colors.IvoryWhiteText} align="center">
          {title}
        </Txt>
        {subtitle ? (
          <>
            <Spacer size={6} />
            <Txt size={12} color={Colors.SlateMutedText} align="center" style={{ lineHeight: 17 }}>
              {subtitle}
            </Txt>
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EmptyState;
