/**
 * Groceries shortcut card — shown above every Chef-dashboard tab (Eaters/Broadcast/Kitchen),
 * chef role only. Extracted so the three tab route files don't each duplicate it.
 */
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Image, StyleSheet } from 'react-native';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { Card, Col, Row, Txt } from '@/components/ui';

export function ChefGroceriesShortcut() {
  const activeRole = usePGowStore((s) => s.activeRole);
  if (activeRole !== 'CHEF') return null;

  return (
    <AnimatedPress scale={0.98} onPress={() => router.push('/groceries')}>
      <Card containerColor={Colors.surfaceElevated} borderRadius={Radii.card} borderWidth={0} padding={[14, 14]} style={styles.shadow}>
        {/* `flex: 1` on the text side, and the subtitle clamped. Without it this row sized
            itself to its content, so at a larger font scale the subtitle pushed the chevron
            clean off the right edge of the card instead of wrapping. */}
        <Row justify="space-between" align="center" gap={8}>
          <Row gap={12} align="center" style={{ flex: 1, minWidth: 0 }}>
            <Image source={require('../../../assets/img_meal_service_ad_1784642265436.webp')} style={styles.image} />
            <Col style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="cardTitle" weight="700" color={Colors.primaryDark} numberOfLines={1}>Groceries</Txt>
              <Txt size={11} color={Colors.textSecondary} numberOfLines={2}>Request kitchen supplies from the Manager</Txt>
            </Col>
          </Row>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </Row>
      </Card>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 48,
    height: 48,
    borderRadius: Radii.card,
  },
  shadow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  }
});
