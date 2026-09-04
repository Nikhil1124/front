import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme';

export interface QuantityStepperProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  /** If true, renders a compact horizontal stepper. Default: false */
  compact?: boolean;
}

/**
 * Shared quantity stepper used across Cart, ProductDetail, and KitchenNeeds.
 * Shows [−] qty [+] controls with green-tinted buttons.
 */
export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  onIncrease,
  onDecrease,
  compact = false,
}) => {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Decrease quantity" accessibilityRole="button"
        style={[styles.btn, compact && styles.compactBtn]}
        onPress={onDecrease}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={compact ? 12 : 14} color={Colors.primary} />
      </TouchableOpacity>

      <Text maxFontSizeMultiplier={1.3} style={[styles.qty, compact && styles.compactQty]}>{quantity}</Text>

      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button"
        style={[styles.btn, compact && styles.compactBtn]}
        onPress={onIncrease}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={compact ? 12 : 14} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 4,
    gap: 8,
  },
  compact: {
    height: 28,
    gap: 6,
    borderRadius: 6,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  qty: {
    fontSize: 14,
    color: Colors.textPrimary,
    minWidth: 16,
    textAlign: 'center',
  },
  compactQty: {
    fontSize: 12,
    minWidth: 14,
  },
});
