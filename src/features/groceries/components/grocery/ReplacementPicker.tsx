import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReplacementPreference } from '../../store/useCartStore';
import { AppColors, AppFonts, AppRadius } from '../../theme/AppColors';

const OPTIONS: { value: ReplacementPreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'best-match', label: "Shopper's best match", icon: 'sparkles-outline' },
  { value: 'specific', label: 'Pick specific replacement', icon: 'swap-horizontal-outline' },
  { value: 'refund', label: 'Refund this item', icon: 'cash-outline' },
];

export interface ReplacementPickerProps {
  value: ReplacementPreference;
  onChange: (val: ReplacementPreference) => void;
  compact?: boolean;
}

export function ReplacementPicker({ value, onChange, compact }: ReplacementPickerProps) {
  if (compact) {
    const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];
    return (
      <View style={styles.compactRow}>
        <Ionicons name={current.icon} size={12} color={AppColors.primary} />
        <Text style={styles.compactText}>{current.label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>If item is unavailable:</Text>
      <View style={styles.optionsList}>
        {OPTIONS.map((opt) => {
          const selected = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionCard, selected && styles.selectedOptionCard]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={selected ? AppColors.primary : AppColors.textSecondary}
              />
              <Text style={[styles.optionLabel, selected && styles.selectedLabel]}>
                {opt.label}
              </Text>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={selected ? AppColors.primary : AppColors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: AppColors.surfaceAlt,
    padding: 10,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  title: {
    fontSize: 12,
    fontFamily: AppFonts.bold,
    color: AppColors.textSecondary,
    marginBottom: 6,
  },
  optionsList: {
    gap: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: AppRadius.sm,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 8,
  },
  selectedOptionCard: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  optionLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: AppFonts.semiBold,
    color: AppColors.textSecondary,
  },
  selectedLabel: {
    color: AppColors.textPrimary,
    fontFamily: AppFonts.bold,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  compactText: {
    fontSize: 11,
    color: AppColors.primary,
    fontFamily: AppFonts.bold,
  },
});
