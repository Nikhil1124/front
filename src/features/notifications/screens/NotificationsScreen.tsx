/**
 * The notifications inbox, as its own screen.
 *
 * Was a bottom sheet capped at 85% of the screen height, opened as a Modal over whatever tab
 * was underneath — a scrollable list of open-ended length (an owner's notifications do not
 * stop) squeezed into a fixed-height overlay, with its own separate close button, backdrop
 * dismiss and "swipe down to close" hint layered on top of the OS back gesture the rest of
 * the app already uses. A real screen gets the full viewport, the platform's own back
 * behaviour, and a shareable route — `router.push('/notifications')` is now also where a
 * push notification tap that has nothing more specific to open can land.
 */
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, Row, Col, Spacer, IconBtn, Chip, LoadingState, ErrorState } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { RoleNotificationBroadcastDialog } from '@/components/dialogs/RoleNotificationBroadcastDialog';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { formatTimeAgo } from '@/utils/format';
import type { AppRoleNotificationEntity } from '@/types';

const FILTERS: Array<[string, string]> = [
  ['ALL', 'All'],
  ['UNREAD', 'Unread'],
  ['HIGH_PRIORITY', '⚡ High Priority'],
  ['MEAL_RSVP', '🍛 Meals'],
  ['RENT_PAYMENT', '💳 Payments'],
  ['COMPLAINT_MAINTENANCE', '🛠️ Issues'],
  ['EXPENSE_FINANCE', '📊 Finance'],
];

function accentColor(category: string): string {
  switch (category) {
    case 'EXPENSE_FINANCE': return Colors.primary;
    case 'RENT_PAYMENT': return Colors.secondary;
    case 'MEAL_RSVP': return '#00E5FF';
    case 'COMPLAINT_MAINTENANCE': return Colors.accentRose;
    default: return Colors.primaryDark;
  }
}

function roleIcon(role: string): keyof typeof Ionicons.glyphMap {
  switch (role) {
    case 'OWNER': return 'business';
    case 'MANAGER': return 'ribbon';
    case 'CHEF': return 'restaurant';
    default: return 'person';
  }
}

/**
 * The one thing pressing a notification's action button used to do was mark it read and
 * close the sheet — `actionLabel` describes an action ("View Ticket", "Verify KYC") that
 * never actually happened, because the mapper dropped `action_id` and there was nothing to
 * point the button at. It is carried through now (see `toRoleNotification` in mappers.ts),
 * so a `request`-typed row can route to the same ticket screen the push itself deep-links to.
 */
function screenForAction(notif: AppRoleNotificationEntity, roleTitle: string): string | null {
  if (notif.actionType !== 'request' || !notif.actionId) return null;
  // Explicit group prefix on both sides: `(guest)/ticket/[id]` and `(owner)/ticket/[id]`
  // resolve to the identical bare path `/ticket/[id]` once expo-router strips the group —
  // harmless today because Stack.Protected only ever mounts one of those groups for a given
  // signed-in user, but naming the group here removes the ambiguity rather than relying on
  // that.
  const base = roleTitle === 'RESIDENT' ? '/(guest)/ticket' : '/(owner)/ticket';
  return `${base}/${notif.actionId}`;
}

export interface NotificationsScreenProps {
  roleTitle: string;
}

export function NotificationsScreen({ roleTitle }: NotificationsScreenProps) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [], isLoading, error, refetch, isRefetching } = useRoleNotificationsQuery(activePgId ?? undefined);
  const markAllRead = usePGowStore((s) => s.markAllRoleNotificationsAsRead);
  const markRead = usePGowStore((s) => s.markRoleNotificationAsRead);
  const deleteNotif = usePGowStore((s) => s.deleteRoleNotification);

  const [filter, setFilter] = useState('ALL');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const canBroadcast = roleTitle === 'OWNER' || roleTitle === 'MANAGER';

  const filtered = roleNotifs.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'HIGH_PRIORITY') return n.priority === 'HIGH';
    if (filter === 'ALL') return true;
    return n.category === filter;
  });

  return (
    <HubScreenWrapper
      title={`${roleTitle} Notifications`}
      subtitle="Real-time updates & alerts for your PG role"
      scrollable={false}
      rightAction={
        <Row gap={8} align="center">
          {canBroadcast && (
            <IconBtn onPress={() => setShowBroadcast(true)} icon="megaphone" size={18} tint={Colors.primary} containerColor={Colors.surfaceMuted} />
          )}
          {unreadCount > 0 && (
            <TouchableOpacity onPress={() => markAllRead(roleTitle)}>
              <Txt variant="caption" weight="700" color={Colors.primary}>Mark All Read</Txt>
            </TouchableOpacity>
          )}
        </Row>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.headerRow}>
          <View style={[styles.roleIconBox, { backgroundColor: '#F0FDF9' }]}>
            <Ionicons name={roleIcon(roleTitle)} size={20} color={Colors.primary} />
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <Txt variant="labelSmall" weight="900" color={Colors.textInverse}>{unreadCount} New</Txt>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(([key, label]) => {
            const count = key === 'ALL' ? roleNotifs.length : key === 'UNREAD' ? unreadCount : null;
            const displayLabel = count != null ? `${label.split(' ')[0]} (${count})` : label;
            return <Chip key={key} label={displayLabel} selected={filter === key} onPress={() => setFilter(key)} />;
          })}
        </ScrollView>

        <Spacer size={4} />

        {isLoading ? (
          <LoadingState label="Loading notifications…" fill={false} />
        ) : error ? (
          <ErrorState error={error} title="Could not load notifications" onRetry={refetch} fill={false} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
            <Txt variant="body" color={Colors.textMuted} weight="600" style={{ marginTop: 8 }}>
              No notifications found
            </Txt>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((notif) => {
              const accent = accentColor(notif.category);
              const actionScreen = screenForAction(notif, roleTitle);
              return (
                <Card
                  key={notif.id}
                  containerColor={notif.isRead ? Colors.surface : '#F0FDF9'}
                  borderRadius={16}
                  borderWidth={1}
                  borderColor={notif.isRead ? Colors.borderSubtle : Colors.primary}
                  padding={[14, 14]}
                >
                  <Row justify="space-between" align="center" style={{ flexWrap: 'wrap' }}>
                    <Row gap={6} align="center" style={{ flexWrap: 'wrap' }}>
                      <View style={[styles.dot, { backgroundColor: notif.isRead ? Colors.borderSubtle : accent }]} />
                      <Txt variant="labelSmall" weight="900" color={Colors.primaryDark}>{notif.category.replace(/_/g, ' ')}</Txt>
                      {notif.priority === 'HIGH' && (
                        <View style={styles.highPill}>
                          <Txt size={8} weight="800" color="#B91C1C">HIGH PRIORITY</Txt>
                        </View>
                      )}
                    </Row>
                    <Row gap={6} align="center">
                      <Txt size={9} color={Colors.textMuted}>{formatTimeAgo(notif.timestamp)}</Txt>
                      <IconBtn onPress={() => deleteNotif(notif.id)} icon="close" size={12} tint={Colors.textMuted} padding={2} />
                    </Row>
                  </Row>
                  <Spacer size={6} />
                  <Txt variant="body" weight="800" color={Colors.textPrimary}>{notif.title}</Txt>
                  <Spacer size={4} />
                  <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 16 }}>{notif.message}</Txt>
                  <Spacer size={10} />
                  <Row justify="space-between" align="center" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {notif.isRead ? (
                      <Txt size={9} color={Colors.textMuted}>✓ Read</Txt>
                    ) : (
                      <TouchableOpacity onPress={() => markRead(notif.id)}>
                        <Txt variant="labelSmall" weight="800" color={Colors.primary}>Mark as Read ✓</Txt>
                      </TouchableOpacity>
                    )}
                    {notif.actionLabel && (
                      <Btn
                        onPress={() => {
                          markRead(notif.id);
                          if (actionScreen) router.push(actionScreen as never);
                        }}
                        containerColor={Colors.primary}
                        textColor={Colors.textInverse}
                        borderRadius={8}
                        height={28}
                        contentStyle={{ paddingHorizontal: 10 }}
                      >
                        <Txt variant="labelSmall" weight="800" color={Colors.textInverse}>{notif.actionLabel}</Txt>
                      </Btn>
                    )}
                  </Row>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {showBroadcast && <RoleNotificationBroadcastDialog onDismiss={() => setShowBroadcast(false)} />}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  unreadPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.accentRose },
  dot: { width: 8, height: 8, borderRadius: 4 },
  highPill: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: '#FEE2E2' },
  emptyBox: { height: 180, backgroundColor: Colors.surfaceMuted, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

export default NotificationsScreen;
