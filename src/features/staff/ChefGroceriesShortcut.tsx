/**
 * Groceries shortcut card — shown above every Chef-dashboard tab (Eaters/Broadcast/Kitchen),
 * chef role only. Extracted so the three tab route files don't each duplicate it.
 */
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Image, StyleSheet } from 'react-native';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

export function ChefGroceriesShortcut() {
  const activeRole = usePGowStore((s) => s.activeRole);
  if (activeRole !== 'CHEF') return null;

  return (
    <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => router.push('/groceries')}>
      <Card containerColor={Colors.surfaceElevated} borderRadius={16} borderWidth={0} padding={[14, 14]} style={styles.shadow}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center">
            <Image source={require('../../../assets/img_meal_service_ad_1784642265436.jpg')} style={styles.image} />
            <Col>
              <Txt variant="cardTitle" weight="900" color={Colors.primaryDark}>Groceries</Txt>
              <Txt size={11} color={Colors.textSecondary}>Request kitchen supplies from the Manager</Txt>
            </Col>
          </Row>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </Row>
      </Card>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  shadow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  }
});
