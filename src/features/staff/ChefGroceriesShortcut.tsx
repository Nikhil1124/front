/**
 * Groceries shortcut card — shown above every Chef-dashboard tab (Eaters/Broadcast/Kitchen),
 * chef role only. Extracted so the three tab route files don't each duplicate it.
 */
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
import { useUserRole } from '@/store/authStore';

export function ChefGroceriesShortcut() {
  const activeRole = useUserRole();
  if (activeRole !== 'CHEF') return null;

  return (
    <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => router.push('/groceries')}>
      <Card containerColor={Colors.surfaceElevated} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
        <Row justify="space-between" align="center">
          <Row gap={10} align="center">
            <Ionicons name="nutrition" size={22} color={Colors.primary} />
            <Col>
              <Txt variant="cardTitle" weight="800" color={Colors.textPrimary}>Groceries</Txt>
              <Txt variant="caption" color={Colors.textMuted}>Request kitchen supplies from the Manager</Txt>
            </Col>
          </Row>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Row>
      </Card>
    </AnimatedPress>
  );
}
