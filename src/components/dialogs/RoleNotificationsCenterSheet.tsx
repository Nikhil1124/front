/**
 * RoleNotificationsCenterSheet — port of Kotlin `RoleNotificationsCenterSheet`.
 * Bottom-sheet style modal that lists role-targeted notifications with filters,
 * broadcast dialog (for OWNER/MANAGER), per-item actions, backdrop touch-to-dismiss,
 * hardware back support, and prominent Close/Back options.
 */
import { useState } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { formatTimeAgo } from '@/utils/format';
import { RoleNotificationBroadcastDialog } from './RoleNotificationBroadcastDialog';

interface Props {
  roleTitle: string;
  onDismiss: () => void;
}

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
    case 'EXPENSE_FINANCE': return Colors.CyberGreen;
    case 'RENT_PAYMENT': return Colors.CyberAmber;
    case 'MEAL_RSVP': return '#00E5FF';
    case 'COMPLAINT_MAINTENANCE': return Colors.CyberPink;
    default: return Colors.CyberPurple;
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

function roleBg(role: string): string {
  switch (role) {
    case 'OWNER': return 'rgba(0,163,140,0.2)';
    case 'MANAGER': return 'rgba(255,167,38,0.2)';
    case 'CHEF': return 'rgba(20,226,177,0.2)';
    default: return 'rgba(0,229,255,0.2)';
  }
}

function roleTint(role: string): string {
  switch (role) {
    case 'OWNER': return Colors.CyberPurple;
    case 'MANAGER': return Colors.CyberAmber;
    case 'CHEF': return Colors.CyberGreen;
    default: return '#00E5FF';
  }
}

export function RoleNotificationsCenterSheet({ roleTitle, onDismiss }: Props) {
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  const markAllRead = usePGowStore((s) => s.markAllRoleNotificationsAsRead);
  const markRead = usePGowStore((s) => s.markRoleNotificationAsRead);
  const deleteNotif = usePGowStore((s) => s.deleteRoleNotification);

  const [filter, setFilter] = useState('ALL');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  const filtered = roleNotifs.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'HIGH_PRIORITY') return n.priority === 'HIGH';
    if (filter === 'ALL') return true;
    return n.category === filter;
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        {/* Touch above popup sheet to dismiss */}
        <Pressable style={styles.dismissBackdropArea} onPress={onDismiss} testID="sheet_backdrop_dismiss" />

        <View style={styles.sheet}>
          {/* Top Drag Handle & Quick Back Bar */}
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.8} style={styles.topHandleBar}>
            <View style={styles.dragHandlePill} />
            <Txt variant="caption" weight="700" color={Colors.SlateMutedText} style={{ marginTop: 4 }}>
              ▼ Tap or Swipe Down to Close
            </Txt>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
            {/* Header with Back/Close button */}
            <Row justify="space-between" align="center" style={styles.headerRow}>
              <Row gap={10} style={{ flex: 1 }} align="center">
                <View style={[styles.roleIconBox, { backgroundColor: '#F0FDF9' }]}>
                  <Ionicons name={roleIcon(roleTitle)} size={20} color={Colors.primary} />
                </View>
                <Col style={{ flex: 1 }}>
                  <Row align="center">
                    <Txt variant="cardTitle" weight="900" color={Colors.textPrimary} style={{ letterSpacing: 0.5 }}>
                      {roleTitle} NOTIFICATIONS
                    </Txt>
                    {unreadCount > 0 && (
                      <View style={styles.unreadPill}>
                        <Txt variant="labelSmall" weight="900" color={Colors.textInverse}>{unreadCount} New</Txt>
                      </View>
                    )}
                  </Row>
                  <Txt variant="caption" color={Colors.textMuted}>Real-time updates & alerts for your PG role</Txt>
                </Col>
              </Row>

              <Row gap={8} align="center">
                {(roleTitle === 'OWNER' || roleTitle === 'MANAGER') && (
                  <IconBtn
                    onPress={() => setShowBroadcast(true)}
                    icon="megaphone"
                    size={18}
                    tint={Colors.primary}
                    containerColor={Colors.surfaceMuted}
                  />
                )}
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={() => markAllRead(roleTitle)}>
                    <Txt variant="caption" weight="700" color={Colors.primary}>Mark All Read</Txt>
                  </TouchableOpacity>
                )}
                {/* Prominent Back/Close Button */}
                <TouchableOpacity
                  onPress={onDismiss}
                  style={styles.closeButtonPill}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  testID="close_notifications_sheet_button"
                >
                  <Ionicons name="close" size={16} color={Colors.textPrimary} />
                  <Txt variant="caption" weight="800" color={Colors.textPrimary}>Close</Txt>
                </TouchableOpacity>
              </Row>
            </Row>

            <Spacer size={14} />

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {FILTERS.map(([key, label]) => {
                const count = key === 'ALL'
                  ? roleNotifs.length
                  : key === 'UNREAD'
                    ? unreadCount
                    : null;
                const displayLabel = count != null ? `${label.split(' ')[0]} (${count})` : label;
                return (
                  <Chip
                    key={key}
                    label={displayLabel}
                    selected={filter === key}
                    onPress={() => setFilter(key)}
                  />
                );
              })}
            </ScrollView>

            <Spacer size={16} />

            {filtered.length === 0 ? (
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
                  return (
                    <Card
                      key={notif.id}
                      containerColor={notif.isRead ? Colors.surface : '#F0FDF9'}
                      borderRadius={16}
                      borderWidth={1}
                      borderColor={notif.isRead ? Colors.borderSubtle : Colors.primary}
                      padding={[14, 14]}
                    >
                      <Row justify="space-between" align="center">
                        <Row gap={6} align="center">
                          <View style={[styles.dot, { backgroundColor: notif.isRead ? Colors.borderSubtle : Colors.primary }]} />
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
                      <Row justify="space-between" align="center">
                        {notif.isRead ? (
                          <Txt size={9} color={Colors.textMuted}>✓ Read</Txt>
                        ) : (
                          <TouchableOpacity onPress={() => markRead(notif.id)}>
                            <Txt variant="labelSmall" weight="800" color={Colors.primary}>Mark as Read ✓</Txt>
                          </TouchableOpacity>
                        )}
                        {notif.actionLabel && (
                          <Btn
                            onPress={() => { markRead(notif.id); onDismiss(); }}
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

            <Spacer size={20} />

            {/* Bottom Explicit Dismiss / Back Button */}
            <TouchableOpacity onPress={onDismiss} style={styles.bottomCloseButton}>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textPrimary} />
              <Txt variant="body" weight="800" color={Colors.textPrimary}>Done / Close Center</Txt>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {showBroadcast && (
        <RoleNotificationBroadcastDialog onDismiss={() => setShowBroadcast(false)} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  dismissBackdropArea: {
    flex: 1,
    width: '100%',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingTop: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  topHandleBar: {
    alignItems: 'center',
    paddingVertical: 8,
    width: '100%',
  },
  dragHandlePill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.borderSubtle,
  },
  headerRow: {
    marginBottom: 8,
  },
  roleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPill: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.accentRose,
  },
  closeButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  highPill: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
  },
  emptyBox: {
    height: 180,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
});
