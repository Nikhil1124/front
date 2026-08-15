import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, AppFonts } from '../../theme/AppColors';

export type AlertType = 'success' | 'info' | 'error';

export interface CustomAlertState {
  visible: boolean;
  title: string;
  message: string;
  type: AlertType;
}

interface CustomAlertModalProps {
  state: CustomAlertState;
  onClose: () => void;
}

const ICON_CONFIG: Record<AlertType, { name: 'checkmark-circle' | 'alert-circle' | 'information-circle'; color: string; bg: string }> = {
  success: { name: 'checkmark-circle', color: '#2E7D32', bg: '#E8F5E9' },
  error: { name: 'alert-circle', color: AppColors.error, bg: AppColors.errorLight },
  info: { name: 'information-circle', color: AppColors.info, bg: AppColors.infoLight },
};

/**
 * Reusable custom alert dialog.
 * Extracted from TodaysKitchenNeeds.tsx.
 * Supports success / info / error variants.
 */
export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({ state, onClose }) => {
  const iconCfg = ICON_CONFIG[state.type];

  return (
    <Modal
      animationType="fade"
      transparent
      visible={state.visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: iconCfg.bg }]}>
            <Ionicons name={iconCfg.name} size={42} color={iconCfg.color} />
          </View>
          <Text style={styles.title}>{state.title}</Text>
          <Text style={styles.message}>{state.message}</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.confirmText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,46,78,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    fontFamily: AppFonts.regular,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 40,
  },
  confirmText: {
    color: AppColors.surface,
    fontFamily: AppFonts.bold,
    fontSize: 14,
  },
});
