/**
 * TextPromptDialog — a cross-platform stand-in for `Alert.prompt`.
 *
 * `Alert.prompt` is iOS-only (see react-native/Libraries/Alert/Alert.js — its entire body is
 * gated behind `if (Platform.OS === 'ios')`, with no Android branch at all). Two screens
 * (GroceryCartScreen, GroceryCheckoutScreen) called it to let someone edit their delivery
 * address; on Android that made "Change Address" a dead button — no dialog, no error, the
 * tap just did nothing. One small real modal, used by both, replaces it everywhere at once.
 */
import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';

export interface TextPromptDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}

export function TextPromptDialog({
  visible,
  title,
  message,
  label,
  initialValue = '',
  placeholder,
  onCancel,
  onSave,
}: TextPromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  // Re-seed the field every time the dialog opens, so a previous edit that was cancelled
  // does not leak into the next time it's shown.
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.backdrop}>
          <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onCancel} />
          <View style={styles.card}>
            <Text maxFontSizeMultiplier={1.3} style={styles.title}>{title}</Text>
            {message ? <Text maxFontSizeMultiplier={1.3} style={styles.message}>{message}</Text> : null}
            <OutlinedTextField
              label={label}
              placeholder={placeholder}
              value={value}
              onChangeText={setValue}
              style={{ marginTop: 12 }}
            />
            <View style={styles.row}>
              <TouchableOpacity accessibilityRole="button" style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                <Text maxFontSizeMultiplier={1.3} style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                style={[styles.saveBtn, !value.trim() && styles.saveBtnDisabled]}
                onPress={() => value.trim() && onSave(value.trim())}
                disabled={!value.trim()}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  message: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textInverse,
  },
});
