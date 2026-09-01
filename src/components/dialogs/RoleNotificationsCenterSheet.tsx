/**
 * RoleNotificationsCenterSheet — Completely redesigned notification center.
 * Modern mobile layout, horizontal scroll filter chips, visual skeletons,
 * customized category icons, and high-priority sorting.
 */
import { useState } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Txt, Btn, Row, Col, Spacer, Skeleton } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { formatTimeAgo } from '@/utils/format';
import { RoleNotificationBroadcastDialog } from './RoleNotificationBroadcastDialog';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore } from '@/store/authStore';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';
import { Motion } from '@/theme';

// ── Color System ─────────────────────────────────────────────────────────────
const PRIMARY = '#4F51D5';      // Premium Indigo / Violet
const PRIMARY_SOFT = '#EEEAFE'; // Soft Indigo
const BG = '#F7F8FC';           // Canvas bg
const CHARCOAL = '#15171A';     // Main text
const MUTED = '#6B7280';        // Secondary text
const BORDER = '#E5E7EB';       // Subtle border
const WHITE = '#FFFFFF';
const SUCCESS = '#16A34A';
const WARNING = '#F59E0B';
const ERROR = '#DC2626';

interface Props {
  roleTitle: string;
  onDismiss: () => void;
}

const FILTERS: Array<[string, string]> = [
  ['ALL', 'All'],
  ['UNREAD', 'Unread'],
  ['HIGH_PRIORITY', 'High Priority'],
  ['MEAL_RSVP', 'Meals'],
  ['RENT_PAYMENT', 'Payments'],
  ['COMPLAINT', 'Issues'],
  ['EXPENSE_FINANCE', 'Finance'],
];

const FILTER_CONFIGS: Record<string, { label: string; icon: string }> = {
  ALL: { label: 'All', icon: 'list-outline' },
  UNREAD: { label: 'Unread', icon: 'mail-unread-outline' },
  HIGH_PRIORITY: { label: 'High Priority', icon: 'alert-circle-outline' },
  MEAL_RSVP: { label: 'Meals', icon: 'restaurant-outline' },
  RENT_PAYMENT: { label: 'Payments', icon: 'wallet-outline' },
  COMPLAINT: { label: 'Issues', icon: 'construct-outline' },
  EXPENSE_FINANCE: { label: 'Finance', icon: 'cash-outline' },
};

function getNotifConfig(category: string, priority?: string) {
  switch (category) {
    case 'RENT_PAYMENT':
      return {
        label: 'RENT',
        icon: 'wallet-outline',
        iconBg: '#EEEAFE', // Soft purple
        iconColor: PRIMARY,
        labelColor: PRIMARY,
        actionLabel: 'View Payment',
      };
    case 'KYC':
      return {
        label: 'KYC',
        icon: 'shield-checkmark-outline',
        iconBg: '#ECFDF5', // Soft green
        iconColor: SUCCESS,
        labelColor: SUCCESS,
        actionLabel: 'View KYC',
      };
    case 'COMPLAINT':
      const isHigh = priority === 'HIGH';
      return {
        label: 'COMPLAINT',
        icon: 'construct-outline',
        iconBg: isHigh ? '#FFF7ED' : '#FEF2F2', // Soft orange or soft pink/red
        iconColor: isHigh ? WARNING : ERROR,
        labelColor: isHigh ? WARNING : ERROR,
        actionLabel: 'Book Technician',
      };
    case 'MEAL_RSVP':
      return {
        label: 'MEALS',
        icon: 'restaurant-outline',
        iconBg: '#EFF6FF', // Soft blue
        iconColor: '#2563EB',
        labelColor: '#2563EB',
        actionLabel: 'View Meals',
      };
    case 'EXPENSE_FINANCE':
      return {
        label: 'FINANCE',
        icon: 'cash-outline',
        iconBg: '#ECFDF5', // Soft green
        iconColor: SUCCESS,
        labelColor: SUCCESS,
        actionLabel: 'View Finance',
      };
    default:
      return {
        label: 'ALERT',
        icon: 'notifications-outline',
        iconBg: '#F3F4F6', // Muted gray
        iconColor: MUTED,
        labelColor: MUTED,
        actionLabel: 'View Detail',
      };
  }
}

export function RoleNotificationsCenterSheet({ roleTitle, onDismiss }: Props) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const {
    data: roleNotifs = [],
    isLoading,
    isError,
    refetch,
  } = useRoleNotificationsQuery(activePgId ?? undefined);

  const markAllRead = usePGowStore((s) => s.markAllRoleNotificationsAsRead);
  const markRead = usePGowStore((s) => s.markRoleNotificationAsRead);
  const deleteNotif = usePGowStore((s) => s.deleteRoleNotification);

  const [filter, setFilter] = useState('ALL');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  // Filter list
  const filtered = roleNotifs.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'HIGH_PRIORITY') return n.priority === 'HIGH';
    if (filter === 'ALL') return true;
    return n.category === filter;
  });

  // Sort by priority and read/unread status
  const sortedNotifications = [...filtered].sort((a, b) => {
    const aHigh = a.priority === 'HIGH' ? 1 : 0;
    const bHigh = b.priority === 'HIGH' ? 1 : 0;
    if (aHigh !== bHigh) return bHigh - aHigh;

    const aUnread = a.isRead ? 0 : 1;
    const bUnread = b.isRead ? 0 : 1;
    if (aUnread !== bUnread) return bUnread - aUnread;

    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime;
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissBackdropArea} onPress={onDismiss} testID="sheet_backdrop_dismiss" />

        <View
          style={styles.sheet}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandlePill} />

          {/* Redesigned Premium Header */}
          <View style={styles.sheetHeaderContainer}>
            <Row justify="space-between" align="center" style={{ width: '100%' }}>
              <Row gap={8} align="center">
                <TouchableOpacity onPress={onDismiss} style={styles.backArrowBtn}>
                  <Ionicons name="arrow-back" size={20} color={CHARCOAL} />
                </TouchableOpacity>
                <Col>
                  <Txt size={20} weight="900" color={CHARCOAL}>Notifications</Txt>
                  <Txt size={11} color={MUTED} style={{ marginTop: 2 }}>
                    Real-time updates for your PG
                  </Txt>
                </Col>
              </Row>

              <Row gap={12} align="center">
                <View style={styles.bellWrapper}>
                  <Ionicons name="notifications-outline" size={20} color={CHARCOAL} />
                  {unreadCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Txt size={9} weight="900" color={WHITE}>{unreadCount}</Txt>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={onDismiss} style={styles.headerCloseBtn}>
                  <Ionicons name="close" size={20} color={CHARCOAL} />
                </TouchableOpacity>
              </Row>
            </Row>
          </View>

          {/* Action Bar: Broadcast & Mark All Read */}
          <Row justify="space-between" align="center" style={styles.actionsBar}>
            <Row gap={8} align="center">
              <Txt size={12} weight="800" color={CHARCOAL}>
                {filtered.length} Message{filtered.length === 1 ? '' : 's'}
              </Txt>
              {(roleTitle === 'OWNER' || roleTitle === 'MANAGER') && (
                <TouchableOpacity
                  onPress={() => { hapticSelect(); setShowBroadcast(true); }}
                  style={styles.broadcastBtn}
                >
                  <Ionicons name="megaphone-outline" size={14} color={PRIMARY} />
                  <Txt size={11} weight="800" color={PRIMARY}>Broadcast</Txt>
                </TouchableOpacity>
              )}
            </Row>

            {unreadCount > 0 ? (
              <TouchableOpacity onPress={() => { hapticSuccess(); markAllRead(roleTitle); }} style={styles.markAllBtn}>
                <Ionicons name="checkbox-outline" size={14} color={PRIMARY} />
                <Txt size={12} weight="800" color={PRIMARY} style={{ marginLeft: 4 }}>
                  Mark all as read
                </Txt>
              </TouchableOpacity>
            ) : (
              <Row style={{ opacity: 0.4 }}>
                <Ionicons name="checkbox-outline" size={14} color={MUTED} />
                <Txt size={12} weight="800" color={MUTED} style={{ marginLeft: 4 }}>
                  Mark all as read
                </Txt>
              </Row>
            )}
          </Row>

          <Spacer size={12} />

          {/* Horizontal Filters */}
          <View style={{ paddingHorizontal: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
              {FILTERS.map(([key, label]) => {
                const isSelected = filter === key;
                const count = key === 'ALL'
                  ? roleNotifs.length
                  : key === 'UNREAD'
                    ? unreadCount
                    : null;
                const displayLabel = count != null ? `${FILTER_CONFIGS[key]?.label ?? label} (${count})` : (FILTER_CONFIGS[key]?.label ?? label);
                const iconName = FILTER_CONFIGS[key]?.icon ?? 'notifications-outline';

                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => { hapticSelect(); setFilter(key); }}
                    style={[
                      styles.filterChip,
                      isSelected ? styles.filterChipSelected : styles.filterChipUnselected
                    ]}
                  >
                    <Row gap={4}>
                      {key === 'UNREAD' && unreadCount > 0 && <View style={styles.unreadDot} />}
                      <Ionicons
                        name={iconName as any}
                        size={14}
                        color={isSelected ? WHITE : MUTED}
                      />
                      <Txt
                        size={11}
                        weight="800"
                        color={isSelected ? WHITE : MUTED}
                      >
                        {displayLabel}
                      </Txt>
                    </Row>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Spacer size={16} />

          {/* Scrollable list */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <NotificationSkeleton />
            ) : isError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={40} color={ERROR} />
                <Txt size={15} weight="900" color={CHARCOAL} style={{ marginTop: 12 }}>
                  Couldn't load notifications
                </Txt>
                <Txt size={12} color={MUTED} style={{ marginTop: 4, textAlign: 'center' }}>
                  Please check your connection and try again.
                </Txt>
                <Spacer size={16} />
                <Btn onPress={() => refetch()} containerColor={PRIMARY} textColor={WHITE} borderRadius={10} height={36} style={{ paddingHorizontal: 16 }}>
                  <Txt size={12} weight="800" color={WHITE}>Retry</Txt>
                </Btn>
              </View>
            ) : sortedNotifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyBellIconBox}>
                  <Ionicons name="notifications-outline" size={44} color={PRIMARY} />
                </View>
                <Txt size={16} weight="900" color={CHARCOAL} style={{ marginTop: 12 }}>
                  You're all caught up
                </Txt>
                <Txt size={12} color={MUTED} style={{ marginTop: 4 }}>
                  No new updates right now.
                </Txt>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {sortedNotifications.map((notif) => {
                  const isRead = notif.isRead;
                  const config = getNotifConfig(notif.category, notif.priority);
                  const isHigh = notif.priority === 'HIGH';

                  return (
                    <View
                      key={notif.id}
                      style={[
                        styles.notifCard,
                        !isRead && styles.notifCardUnread
                      ]}
                    >
                      <Row align="flex-start" gap={12}>
                        {/* Left Icon */}
                        <View style={[styles.notifIconBox, { backgroundColor: config.iconBg }]}>
                          <Ionicons name={config.icon as any} size={22} color={config.iconColor} />
                        </View>

                        {/* Right Info Section */}
                        <Col style={{ flex: 1 }}>
                          {/* Header: Category, Badges, Timestamp & Deletion */}
                          <Row justify="space-between" align="center" style={{ width: '100%', flexWrap: 'wrap' }}>
                            <Row gap={6} align="center" style={{ flexWrap: 'wrap' }}>
                              <Txt size={11} weight="900" color={config.labelColor} style={{ letterSpacing: 0.5 }}>
                                {config.label}
                              </Txt>
                              {isHigh && (
                                <View style={styles.highPriorityBadge}>
                                  <Txt size={8} weight="900" color="#B91C1C">HIGH PRIORITY</Txt>
                                </View>
                              )}
                            </Row>
                            
                            <Row gap={8} align="center">
                              <Txt size={10} color={MUTED}>{formatTimeAgo(notif.timestamp)}</Txt>
                              <TouchableOpacity
                                style={styles.moreBtn}
                                onPress={() => {
                                  hapticSelect();
                                  Alert.alert(
                                    'Delete Alert',
                                    'Would you like to delete this notification?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Delete', style: 'destructive', onPress: () => deleteNotif(notif.id) }
                                    ]
                                  );
                                }}
                              >
                                <Ionicons name="ellipsis-horizontal" size={16} color={MUTED} />
                              </TouchableOpacity>
                            </Row>
                          </Row>

                          <Spacer size={6} />

                          {/* Title and Message */}
                          <Txt size={14} weight="800" color={CHARCOAL}>{notif.title}</Txt>
                          <Spacer size={4} />
                          <Txt size={12} color={MUTED} style={{ lineHeight: 16 }}>{notif.message}</Txt>

                          <Spacer size={12} />

                          {/* Footer Actions & State */}
                          <Row justify="space-between" align="center" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {isRead ? (
                              <Row gap={4} align="center">
                                <Ionicons name="checkmark-circle-outline" size={14} color={MUTED} />
                                <Txt size={11} color={MUTED} weight="700">Read</Txt>
                              </Row>
                            ) : (
                              <Row gap={4} align="center">
                                <View style={styles.unreadDotIndicator} />
                                <Txt size={11} color={PRIMARY} weight="800">Unread</Txt>
                                <TouchableOpacity onPress={() => { hapticSelect(); markRead(notif.id); }} style={{ marginLeft: 8 }}>
                                  <Txt size={10} color={MUTED} weight="700">Mark read</Txt>
                                </TouchableOpacity>
                              </Row>
                            )}

                            {/* Dynamic Action Trigger */}
                            {(notif.actionLabel || config.actionLabel) && (
                              <Btn
                                onPress={() => {
                                  hapticSuccess();
                                  markRead(notif.id);
                                  onDismiss();
                                  if (notif.category === 'COMPLAINT' && notif.actionId) {
                                    router.push(`/book-technician/${notif.actionId}`);
                                  }
                                }}
                                containerColor={config.iconColor}
                                textColor={WHITE}
                                borderRadius={10}
                                height={30}
                                contentStyle={{ paddingHorizontal: 12 }}
                              >
                                <Txt size={11} weight="800" color={WHITE}>
                                  {config.actionLabel || notif.actionLabel}
                                </Txt>
                              </Btn>
                            )}
                          </Row>
                        </Col>
                      </Row>
                    </View>
                  );
                })}
              </View>
            )}

            <Spacer size={20} />
          </ScrollView>
        </View>
      </View>

      {showBroadcast && (
        <RoleNotificationBroadcastDialog onDismiss={() => setShowBroadcast(false)} />
      )}
    </Modal>
  );
}

function NotificationSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      {[1, 2, 3].map((key) => (
        <View key={key} style={styles.notifCard}>
          <Row align="flex-start" gap={12}>
            <Skeleton style={{ width: 52, height: 52, borderRadius: 14 }} />
            <Col style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ height: 10, width: 60 }} />
              <Skeleton style={{ height: 14, width: '75%' }} />
              <Skeleton style={{ height: 10, width: '90%' }} />
              <Skeleton style={{ height: 10, width: '80%' }} />
              <Row justify="space-between" align="center" style={{ marginTop: 8 }}>
                <Skeleton style={{ height: 10, width: 40 }} />
                <Skeleton style={{ height: 26, width: 85, borderRadius: 8 }} />
              </Row>
            </Col>
          </Row>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  dismissBackdropArea: {
    flex: 1,
    width: '100%',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dragHandlePill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 8,
  },

  // Premium Header
  sheetHeaderContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  bellWrapper: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: PRIMARY,
    borderRadius: 9,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: WHITE,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },

  // Actions Bar
  actionsBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },

  // Filters chips
  filtersScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterChipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterChipUnselected: {
    backgroundColor: WHITE,
    borderColor: BORDER,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ERROR,
    alignSelf: 'center',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Notification card
  notifCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notifCardUnread: {
    backgroundColor: '#F5F3FF', // Very soft lavender/indigo tint
    borderColor: '#E0DBFF',
  },
  notifIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highPriorityBadge: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unreadDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  moreBtn: {
    padding: 4,
  },

  // Empty state
  emptyBox: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBellIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  // Error Box
  errorBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
