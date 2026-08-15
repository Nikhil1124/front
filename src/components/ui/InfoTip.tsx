/**
 * InfoTip — small "ⓘ" icon that reveals a short explanation on tap (or hover
 * on web), instead of a permanently-visible helper line taking up space.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt } from '@/components/ui';
import { Colors } from '@/theme';

interface Props {
  text: string;
  size?: number;
}

export function InfoTip({ text, size = 15 }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable onPress={() => setVisible(true)} onHoverIn={() => setVisible(true)} hitSlop={8}>
        <Ionicons name="information-circle-outline" size={size} color={Colors.textMuted} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Card
            containerColor={Colors.surface}
            borderRadius={14}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[14, 14]}
            style={{ maxWidth: 300 }}
          >
            <Txt size={12} color={Colors.textPrimary}>{text}</Txt>
          </Card>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
