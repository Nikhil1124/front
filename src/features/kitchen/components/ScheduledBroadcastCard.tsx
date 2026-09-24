import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useScheduledBroadcastsQuery, type ScheduledBroadcast } from '@/features/meals/useMeals';

/**
 * The pushes the server will send by itself, soonest first. This card used to show a fixed
 * "Lunch reminder · Today, 12:00 PM" whatever was actually scheduled, and its Manage link
 * went to a screen that does not exist.
 */
const KIND_LABEL: Record<ScheduledBroadcast['kind'], string> = {
  announce: 'announcement',
  reminder_2h: 'reminder',
  followup_15m: 'final call',
};

function whenLabel(iso: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(at) - startOf(today)) / 86_400_000);
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : at.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

export function ScheduledBroadcastCard() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data = [], isLoading, error } = useScheduledBroadcastsQuery(activePgId ?? undefined);
  const next = data.slice(0, 3);

  return (
    <View>
      <Row gap={8} align="center" style={{ marginBottom: 12 }}>
        <Ionicons name="calendar-outline" size={20} color={Colors.primaryDark} />
        <Col style={{ flex: 1 }}>
          <Txt size={15} weight="800" color={Colors.textPrimary} numberOfLines={1}>Scheduled Broadcasts</Txt>
          <Txt size={12} weight="600" color={Colors.textMuted} style={{ marginTop: 2 }} numberOfLines={1}>Sent automatically — nothing to do</Txt>
        </Col>
      </Row>
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        {isLoading ? (
          <Txt size={13} color={Colors.textMuted}>Loading…</Txt>
        ) : error ? (
          <Txt size={13} color={Colors.textMuted}>Could not load the schedule. Pull to refresh.</Txt>
        ) : next.length === 0 ? (
          <Txt size={13} color={Colors.textMuted}>Nothing scheduled. Announced meals get reminders here while RSVPs are open.</Txt>
        ) : (
          next.map((b, i) => (
            <Row key={`${b.meal_id}-${b.kind}`} justify="space-between" align="center" style={i > 0 ? { marginTop: 12 } : undefined}>
              <Row gap={12} align="center" style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.iconCircle}>
                  <Ionicons name={b.kind === 'announce' ? 'megaphone-outline' : 'time-outline'} size={18} color={Colors.textSecondary} />
                </View>
                <Txt size={14} weight="700" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
                  {`${b.meal_type[0].toUpperCase()}${b.meal_type.slice(1)} ${KIND_LABEL[b.kind]}`}
                </Txt>
              </Row>
              <Col align="flex-end">
                <Txt size={12} weight="600" color={Colors.textSecondary}>{whenLabel(b.at)}</Txt>
                <View style={styles.badge}>
                  <Txt size={10} weight="700" color={Colors.primary}>Scheduled</Txt>
                </View>
              </Col>
            </Row>
          ))
        )}
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
