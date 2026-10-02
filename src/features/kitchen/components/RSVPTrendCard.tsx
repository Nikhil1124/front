
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Txt, Row, AnimatedPress, Col } from '@/components/ui';
import { Colors, Radii } from '@/theme';

/**
 * The current meal's answers, and a way into the real 7-day trends screen. It used to add a
 * percentage change beside each count and a small bar chart — fixed numbers passed in from the
 * kitchen tab, not data — under a "Last 7 Days" title the counts did not match.
 */
interface RSVPTrendCardProps {
  eatingCount: number;
  skippingCount: number;
  noReplyCount: number;
}

export function RSVPTrendCard({
  eatingCount,
  skippingCount,
  noReplyCount,
}: RSVPTrendCardProps) {

  const renderTrend = (label: string, count: number, dotColor: string) => (
    <Col gap={2} style={{ flexShrink: 1, minWidth: 60 }}>
      <Row gap={4} align="center">
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Txt size={11} weight="700" color={Colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
      </Row>
      <Txt size={18} weight="800" color={Colors.textPrimary}>{count}</Txt>
    </Col>
  );

  return (
    <AnimatedPress accessibilityRole="button" onPress={() => router.push('/rsvp-trends')}>
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 20]}>
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <Row gap={8} align="center" style={{ flexShrink: 1 }}>
            <Ionicons name="people" size={18} color={Colors.primary} />
            <Txt size={15} weight="800" color={Colors.textPrimary} style={{ flexShrink: 1 }}>RSVPs for this meal <Txt size={12} weight="600" color={Colors.textMuted}>· 7-day trends</Txt></Txt>
          </Row>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Row>

        <Row justify="space-between" align="center">
          {renderTrend('Eating', eatingCount, Colors.success)}
          {renderTrend('Skipping', skippingCount, Colors.warning)}
          {renderTrend('No Reply', noReplyCount, Colors.textMuted)}
        </Row>
      </Card>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: Radii.badge },
});
