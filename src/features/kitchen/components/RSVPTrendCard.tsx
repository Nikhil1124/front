
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Txt, Row, AnimatedPress, Col } from '@/components/ui';
import { Colors, Radii } from '@/theme';

interface RSVPTrendCardProps {
  eatingCount: number;
  skippingCount: number;
  noReplyCount: number;
  eatingChange: number;
  skippingChange: number;
  noReplyChange: number;
}

export function RSVPTrendCard({
  eatingCount,
  skippingCount,
  noReplyCount,
  eatingChange,
  skippingChange,
  noReplyChange,
}: RSVPTrendCardProps) {
  
  const renderTrend = (label: string, count: number, change: number, color: string, dotColor: string) => (
    <Col gap={2} style={{ flexShrink: 1, minWidth: 60 }}>
      <Row gap={4} align="center">
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Txt size={11} weight="700" color={Colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
      </Row>
      <Row gap={4} align="flex-end">
        <Txt size={18} weight="800" color={Colors.textPrimary}>{count}</Txt>
        <Row gap={2} align="center">
          <Ionicons name={change >= 0 ? "trending-up" : "trending-down"} size={10} color={color} />
          <Txt size={10} weight="700" color={color}>{Math.abs(change)}%</Txt>
        </Row>
      </Row>
    </Col>
  );

  return (
    <AnimatedPress accessibilityRole="button" onPress={() => router.push('/rsvp-trends')}>
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 20]}>
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <Row gap={8} align="center" style={{ flexShrink: 1 }}>
            <Ionicons name="trending-up" size={18} color={Colors.primary} />
            <Txt size={15} weight="800" color={Colors.textPrimary} style={{ flexShrink: 1 }}>RSVP Trends <Txt size={12} weight="600" color={Colors.textMuted}>(Last 7 Days)</Txt></Txt>
          </Row>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Row>
        
        <Row justify="space-between" align="center">
          {renderTrend('Eating', eatingCount, eatingChange, Colors.success, Colors.success)}
          {renderTrend('Skipping', skippingCount, skippingChange, Colors.danger, Colors.warning)}
          {renderTrend('No Reply', noReplyCount, noReplyChange, Colors.success, Colors.textMuted)}
          
          {/* Mock mini bar chart */}
          <View style={styles.chartContainer}>
             {[1, 2, 3, 2, 3, 2, 4].map((h, i) => (
               <View key={i} style={styles.chartCol}>
                 <View style={[styles.bar, { height: h * 8 }]} />
                 <Txt size={8} color={Colors.textMuted}>{['M','T','W','T','F','S','S'][i]}</Txt>
               </View>
             ))}
          </View>
        </Row>
      </Card>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
  chartContainer: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 40 },
  chartCol: { alignItems: 'center', gap: 4 },
  bar: { width: 6, backgroundColor: Colors.primary, borderRadius: 3, opacity: 0.8 },
});
