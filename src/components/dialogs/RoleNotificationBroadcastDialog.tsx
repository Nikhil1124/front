/**
 * RoleNotificationBroadcastDialog — port of Kotlin `RoleNotificationBroadcastDialog`.
 * AlertDialog with target role selector, title input, message input, Send button,
 * hardware back button support, and backdrop touch-to-dismiss.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert, Pressable, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

interface Props {
  onDismiss: () => void;
}

const ROLES: Array<[string, string]> = [
  ['ALL', '🌐 All'],
  ['RESIDENT', '🏠 Residents'],
  ['CHEF', '👨‍🍳 Chef'],
  ['MANAGER', '💼 Manager'],
];

export function RoleNotificationBroadcastDialog({ onDismiss }: Props) {
  const send = usePGowStore((s) => s.sendRoleNotification);
  const [titleInput, setTitleInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [targetRole, setTargetRole] = useState('ALL');

  const handleSend = async () => {
    if (!titleInput.trim() || !messageInput.trim()) {
      Alert.alert('Validation', 'Please enter title and message.');
      return;
    }
    await send(targetRole, titleInput.trim(), messageInput.trim(), 'ANNOUNCEMENT', 'MEDIUM');
    onDismiss();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
          {/* Background tap to dismiss */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

          <Animated.View entering={FadeIn.duration(200).delay(40)} exiting={FadeOut.duration(120)} style={{ width: '90%', zIndex: 2 }}>
            <Card
              containerColor={Colors.surface}
              borderRadius={24}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '100%' }}
            >
          <Row align="center" gap={8} style={{ marginBottom: 12 }}>
            <View style={styles.iconBox}>
              <Ionicons name="megaphone" size={20} color={Colors.primary} />
            </View>
            <Col>
              <Txt variant="screenTitle" weight="900" color={Colors.textPrimary}>Broadcast Announcement</Txt>
              <Txt variant="caption" color={Colors.textMuted}>Deliver notice to residents, staff or managers</Txt>
            </Col>
          </Row>

          <Txt variant="caption" weight="800" color={Colors.textMuted}>Target Audience:</Txt>
          <Spacer size={6} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {ROLES.map(([role, label]) => (
              <Chip
                key={role}
                label={label}
                selected={targetRole === role}
                onPress={() => setTargetRole(role)}
              />
            ))}
          </Row>
          <Spacer size={12} />
          <OutlinedTextField
            label="Notification Title *"
            placeholder="Maintenance Scheduled / Dining Update"
            value={titleInput}
            onChangeText={setTitleInput}
            containerColor={Colors.surfaceMuted}
            focusedBorderColor={Colors.primary}
            unfocusedBorderColor={Colors.borderSubtle}
            style={{ marginBottom: 10 }}
          />
          <OutlinedTextField
            label="Alert Details & Instructions *"
            placeholder="Write your announcement message here..."
            value={messageInput}
            onChangeText={setMessageInput}
            multiline
            numberOfLines={3}
            containerColor={Colors.surfaceMuted}
            focusedBorderColor={Colors.primary}
            unfocusedBorderColor={Colors.borderSubtle}
            style={{ marginBottom: 16, minHeight: 90 }}
          />
          <Row gap={8}>
            <Btn
              onPress={handleSend}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={44}
              style={{ flex: 1 }}
            >
              <Txt variant="body" weight="800" color={Colors.textInverse}>Send Alert 🚀</Txt>
            </Btn>
            <OutlinedBtn
              onPress={onDismiss}
              borderColor={Colors.borderSubtle}
              textColor={Colors.textPrimary}
              borderRadius={12}
              height={44}
              style={{ flex: 1 }}
            >
              <Txt variant="body" weight="800" color={Colors.textPrimary}>Cancel</Txt>
            </OutlinedBtn>
          </Row>
            </Card>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
});
