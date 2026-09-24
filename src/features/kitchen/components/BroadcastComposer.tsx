
import { View, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Row, Col, AnimatedPress } from '@/components/ui';
import { Colors, Radii } from '@/theme';

interface BroadcastComposerProps {
  message: string;
  onChangeMessage: (msg: string) => void;
  onPreview?: () => void;
  maxLength?: number;
}

export function BroadcastComposer({
  message,
  onChangeMessage,
  onPreview,
  maxLength = 200,
}: BroadcastComposerProps) {
  const templates = [
    { text: 'Special Dessert today!', emoji: '🍨', color: '#E8F5E9' },
    { text: 'Serving started! Come get hot portions!', emoji: '🍽️', color: '#FFF3E0' },
    { text: 'Delay of 10 mins due to prep', emoji: '⏰', color: '#E8F0FE' },
    { text: 'Limited portions available. Hurry!', emoji: '🏃‍♂️', color: '#F3E5F5' },
    { text: 'Chai is ready in the dining area!', emoji: '☕', color: '#EFEBE9' },
  ];
  
  return (
    <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]}>
      <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Row gap={10} align="center" style={{ flex: 1, paddingRight: 8 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
          <Col style={{ flex: 1 }}>
            <Txt size={15} weight="800" color={Colors.textPrimary} numberOfLines={1}>Broadcast Custom Message</Txt>
            <Txt size={12} weight="600" color={Colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>Send instant updates to all residents</Txt>
          </Col>
        </Row>
        <AnimatedPress onPress={onPreview} style={styles.previewBtn}>
          <Row gap={6} align="center">
            <Ionicons name="eye-outline" size={16} color={Colors.textPrimary} />
            <Txt size={12} weight="700" color={Colors.textPrimary}>Preview</Txt>
          </Row>
        </AnimatedPress>
      </Row>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Type your kitchen update..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          value={message}
          onChangeText={onChangeMessage}
          maxLength={maxLength}
          textAlignVertical="top"
        />
      </View>
      <Row justify="flex-end" style={{ marginTop: 8 }}>
        <Txt size={11} weight="600" color={Colors.textMuted}>{message.length}/{maxLength}</Txt>
      </Row>

      <View style={styles.divider} />

      <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Row gap={8} align="center" style={{ flex: 1 }}>
          <Ionicons name="flash-outline" size={16} color={Colors.primaryDark} />
          <Txt size={13} weight="800" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>Quick Templates</Txt>
        </Row>
      </Row>

      <View style={styles.grid}>
        {templates.map((tpl, i) => (
          <AnimatedPress 
            key={i} 
            onPress={() => onChangeMessage(message ? `${message}\n${tpl.text} ${tpl.emoji}` : `${tpl.text} ${tpl.emoji}`)}
            style={[styles.templateBtn, { backgroundColor: tpl.color }]}
          >
            <Row gap={6} align="center" style={{ flexShrink: 1 }}>
              <Txt size={12}>{tpl.emoji}</Txt>
              <Txt size={10} weight="700" color={Colors.textPrimary} numberOfLines={2} style={{ flexShrink: 1 }}>
                {tpl.text}
              </Txt>
            </Row>
          </AnimatedPress>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  previewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.card,
    padding: 12,
    backgroundColor: Colors.surface,
  },
  input: {
    minHeight: 80,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateBtn: {
    width: '48%',
    padding: 10,
    borderRadius: Radii.card,
    minHeight: 46,
    justifyContent: 'center',
  }
});
