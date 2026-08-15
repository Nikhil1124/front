import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { AppColors, AppFonts } from '../../theme/AppColors';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * Shared action button used across all screens.
 * Eliminates repeated green button, outlined green, and red danger button styles.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[`base_${size}`],
        styles[`variant_${variant}`],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? AppColors.primary : AppColors.surface}
        />
      ) : (
        <Text style={[styles.label, styles[`label_${size}`], styles[`label_${variant}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  base_sm: { paddingVertical: 6, paddingHorizontal: 14 },
  base_md: { paddingVertical: 10, paddingHorizontal: 20 },
  base_lg: { paddingVertical: 14, paddingHorizontal: 28 },

  variant_primary: { backgroundColor: AppColors.primary },
  variant_outline: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  variant_ghost: { backgroundColor: 'transparent' },
  variant_danger: { backgroundColor: AppColors.error },

  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },

  label: { fontFamily: AppFonts.bold },
  label_sm: { fontSize: 12 },
  label_md: { fontSize: 14 },
  label_lg: { fontSize: 16 },

  label_primary: { color: AppColors.surface },
  label_outline: { color: AppColors.primary },
  label_ghost: { color: AppColors.primary },
  label_danger: { color: AppColors.surface },
});
