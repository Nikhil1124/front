import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { AnimatedPress, Txt } from '@/components/ui';

import { Ionicons } from '@expo/vector-icons';
import { ReplacementPreference } from '../../store/useCartStore';
import { Colors, Radii } from '@/theme';

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
        <Ionicons name={current.icon} size={12} color={Colors.primary} />
        <Txt maxFontSizeMultiplier={1.3} style={styles.compactText}>{current.label}</Txt>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Txt maxFontSizeMultiplier={1.3} style={styles.title}>If item is unavailable:</Txt>
      <View style={styles.optionsList}>
        {OPTIONS.map((opt) => {
          const selected = opt.value === value;
          return (
            <AnimatedPress accessibilityState={{ selected: !!selected }} accessibilityRole="button"
              key={opt.value}
              style={[styles.optionCard, selected && styles.selectedOptionCard]}
              onPress={() => onChange(opt.value)}

            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={selected ? Colors.primary : Colors.textSecondary}
              />
              <Txt maxFontSizeMultiplier={1.3} style={[styles.optionLabel, selected && styles.selectedLabel]}>
                {opt.label}
              </Txt>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={selected ? Colors.primary : Colors.textMuted}
              />
            </AnimatedPress>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: Colors.surfaceMuted,
    padding: 10,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  title: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6 },
  optionsList: {
    gap: 6 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radii.control,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 8 },
  selectedOptionCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated },
  optionLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary },
  selectedLabel: {
    color: Colors.textPrimary },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4 },
  compactText: {
    fontSize: 11,
    color: Colors.primary } });
