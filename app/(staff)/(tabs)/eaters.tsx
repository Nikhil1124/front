/** Chef dashboard "Eaters" tab — pick the active meal, see RSVP portion counts. */
import { View, StyleSheet } from 'react-native';
import { Card, Txt, Spacer, Chip, Col, Row } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';

export default function ChefEatersTab() {
  const notifications = usePGowStore((s) => s.currentPGNotifications);
  const allRSVPs = usePGowStore((s) => s.allRSVPsState);
  const guests = usePGowStore((s) => s.currentGuests);
  const { activeMeal, setActiveMeal } = useActiveMeal();

  const rsvpsForActive = activeMeal ? allRSVPs.filter((r) => r.notificationId === activeMeal.id) : [];
  const reqCount = rsvpsForActive.filter((r) => r.choice === 'REQUIRED').length;
  const notReqCount = rsvpsForActive.filter((r) => r.choice === 'NOT_REQUIRED').length;
  const noResponse = Math.max(0, guests.length - reqCount - notReqCount);

  return (
    <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
      <ChefGroceriesShortcut />

      {!activeMeal ? (
        <View style={styles.emptyMealBox}>
          <Txt size={12} color={Colors.textMuted} align="center">No active meals. Use 'Broadcast Food Alert' tab to create a meal.</Txt>
        </View>
      ) : (
        <>
          <Txt size={11} weight="700" color={Colors.textSecondary}>Select Active Meal to View RSVP Data:</Txt>
          <Spacer size={6} />
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {notifications.map((n) => (
              <Chip key={n.id} label={`${n.mealType} - ${n.menuItems.slice(0, 20)}...`} selected={activeMeal?.id === n.id} onPress={() => setActiveMeal(n)} selectedColor={Colors.primary} size={11} />
            ))}
          </FormScroll>
          <Spacer size={14} />

          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]}>
            <Col align="center">
              <Txt size={11} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1.2 }}>TOTAL PORTIONS TO PREPARE TODAY</Txt>
              <Spacer size={10} />
              <View style={styles.bigPortionBox}>
                <Txt size={46} weight="900" color={Colors.primary}>{reqCount}</Txt>
              </View>
              <Spacer size={10} />
              <Txt size={13} weight="700" color={Colors.textPrimary} align="center">Active Menu: {activeMeal?.menuItems}</Txt>
            </Col>
          </Card>

          <Spacer size={14} />
          <Row gap={10}>
            <View style={[styles.metricCard, { backgroundColor: '#F0FDF9', borderColor: '#CCFBF1' }]}>
              <Txt size={10} weight="800" color={Colors.primaryDark}>COOK PORTIONS</Txt>
              <Txt size={28} weight="900" color={Colors.primary}>{reqCount}</Txt>
              <Txt size={10} weight="700" color={Colors.textMuted}>Eating ✅</Txt>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' }]}>
              <Txt size={10} weight="800" color="#B91C1C">SKIPPED / SAVED</Txt>
              <Txt size={28} weight="900" color={Colors.danger}>{notReqCount}</Txt>
              <Txt size={10} weight="700" color={Colors.textMuted}>Skipping ❌</Txt>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
              <Txt size={10} weight="800" color="#B45309">NO REPLY</Txt>
              <Txt size={28} weight="900" color={Colors.warning}>{noResponse}</Txt>
              <Txt size={10} weight="700" color={Colors.textMuted}>Awaiting ⏳</Txt>
            </View>
          </Row>
        </>
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  emptyMealBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', padding: 16 },
  bigPortionBox: { width: 104, height: 104, borderRadius: 52, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  metricCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center' },
});
