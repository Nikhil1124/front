
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Txt, Row, AnimatedPress, Col } from '@/components/ui';
import { Colors, Radii } from '@/theme';

export function ScheduledBroadcastCard() {
  return (
    <View>
      <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Row gap={8} align="center" style={{ flex: 1, paddingRight: 8 }}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primaryDark} />
          <Col style={{ flex: 1 }}>
            <Txt size={15} weight="800" color={Colors.textPrimary} numberOfLines={1}>Scheduled Broadcasts</Txt>
            <Txt size={12} weight="600" color={Colors.textMuted} style={{ marginTop: 2 }} numberOfLines={1}>Upcoming automatic announcements</Txt>
          </Col>
        </Row>
        <AnimatedPress onPress={() => router.push('/scheduled-broadcasts')}>
          <Row gap={4} align="center">
            <Txt size={13} weight="700" color={Colors.textPrimary}>Manage</Txt>
            <Ionicons name="chevron-forward" size={14} color={Colors.textPrimary} />
          </Row>
        </AnimatedPress>
      </Row>

      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center">
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
            </View>
            <Col>
              <Txt size={12} weight="600" color={Colors.textMuted}>Next Broadcast</Txt>
              <Txt size={14} weight="700" color={Colors.textPrimary} style={{ marginTop: 2 }}>Lunch reminder</Txt>
            </Col>
          </Row>
          <Col align="flex-end">
            <Txt size={12} weight="600" color={Colors.textSecondary}>Today, 12:00 PM</Txt>
            <View style={styles.badge}>
              <Txt size={10} weight="700" color={Colors.primary}>Scheduled</Txt>
            </View>
          </Col>
        </Row>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    marginTop: 6,
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  }
});
