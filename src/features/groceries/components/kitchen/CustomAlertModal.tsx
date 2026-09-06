import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Palette, Colors } from '@/theme';
import { Btn, Sheet, Txt } from '@/components/ui';

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
  success: { name: 'checkmark-circle', color: Colors.primary, bg: Colors.surfaceElevated },
  error: { name: 'alert-circle', color: Colors.danger, bg: Palette.TintRed },
  info: { name: 'information-circle', color: Colors.info, bg: Palette.TintBlue },
};

/**
 * Reusable custom alert dialog.
 * Extracted from TodaysKitchenNeeds.tsx.
 * Supports success / info / error variants.
 */
export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({ state, onClose }) => {
  const iconCfg = ICON_CONFIG[state.type];

  return (
    <Sheet
      visible={state.visible}
      title={state.title}
      onDismiss={onClose}
      testID="custom_alert_modal"
      footer={
        <Btn onPress={onClose} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={44}>
          <Txt size={14} color={Colors.textInverse}>OK</Txt>
        </Btn>
      }
    >
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: iconCfg.bg }]}>
          <Ionicons name={iconCfg.name} size={42} color={iconCfg.color} />
        </View>
        <Txt size={18} weight="700" color={Colors.textPrimary} style={styles.title}>{state.title}</Txt>
        <Txt size={13} color={Colors.textSecondary} style={styles.message}>{state.message}</Txt>
      </View>
    </Sheet>
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
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
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
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.control,
    paddingVertical: 10,
    paddingHorizontal: 40,
  },
  confirmText: {
    color: Colors.surface,
    fontSize: 14,
  },
});
