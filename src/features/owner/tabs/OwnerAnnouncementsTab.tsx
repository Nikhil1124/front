import { useState, useMemo, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Alert, Modal, Pressable, RefreshControl, TextInput, TouchableOpacity, Text, Image, KeyboardAvoidingView, Platform, FlatList, Animated as RNAnimated, PanResponder, BackHandler } from 'react-native';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, LoadingState, ErrorState } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatTimeAgo } from '@/utils/format';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { GuestEntity } from '@/types';
import { OwnerReviewsTab } from './OwnerReviewsTab';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';

const PRIMARY = Colors.primary;       // Deep Ocean Blue
const PRIMARY_DARK = Colors.primaryDark; // Obsidian Navy
const BG = Colors.canvas;            // Light Ice Canvas
const SURFACE = Colors.surface;      // Pure White
const UNREAD_SURFACE = Colors.surfaceElevated; // Soft Ice Cyan Tint
const TEXT_PRIMARY = Colors.textPrimary; // Obsidian Navy
const TEXT_SECONDARY = Colors.textMuted; // Ocean Muted
const DIVIDER = Colors.borderSubtle;     // Ice Subtle Border
const WARNING = Colors.warning;
const DANGER = Colors.danger;

import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useAuthStore } from '@/store/authStore';

// === HELPER COMPONENTS ===

const NotificationHeader = ({ title, onBack }: { title: string, onBack: () => void }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.headerBackBtn}>
        <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
};

const NotificationSummary = ({ total, approvals }: { total: number, approvals: number }) => (
  <View style={styles.summaryContainer}>
    <Text style={styles.summarySub}>{total} updates · {approvals} approvals</Text>
  </View>
);

const NotificationStatusRow = ({ pending }: { pending: number }) => {
  if (pending > 0) {
    return (
      <View style={[styles.statusRow, styles.statusWarning]}>
        <Ionicons name="alert-circle" size={16} color={WARNING} />
        <Text style={styles.statusWarningText}>Needs Attention · {pending} pending</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusRow, styles.statusSuccess]}>
      <Ionicons name="checkmark-circle" size={16} color={PRIMARY} />
      <Text style={styles.statusSuccessText}>All caught up · No pending approvals</Text>
    </View>
  );
};

const NotificationFilterRow = ({ tabs, activeTab, onChange }: { tabs: { id: string, label: string, count?: number }[], activeTab: string, onChange: (id: string) => void }) => (
  <View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.id}
          activeOpacity={0.8}
          onPress={() => onChange(tab.id)}
          style={[styles.filterChip, activeTab === tab.id && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, activeTab === tab.id && styles.filterChipTextActive]}>
            {tab.label} {tab.count !== undefined ? tab.count : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const NotificationEmptyState = () => (
  <View style={styles.emptyContainer}>
    <Ionicons name="notifications-off-outline" size={32} color={TEXT_SECONDARY} />
    <Spacer size={12} />
    <Text style={styles.emptyTitle}>You're all caught up</Text>
    <Text style={styles.emptySub}>No new notifications right now.</Text>
  </View>
);

const NotificationItem = ({ item, onPress }: { item: any, onPress: () => void }) => {
  const isUnread = !item.isRead;
  const isHighPriority = item.priority === 'HIGH';

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={onPress}
      style={[
        styles.notifItemContainer,
        isUnread && styles.notifItemUnread
      ]}
    >
      <Row gap={12} align="flex-start">
        <View style={[styles.iconContainer, isHighPriority && styles.iconContainerHigh]}>
          <Ionicons name={item.icon} size={20} color={isHighPriority ? DANGER : PRIMARY} />
        </View>
        <Col style={{ flex: 1 }}>
          <Row justify="space-between" align="center">
            <Row align="center" gap={6}>
              {isUnread && <View style={styles.unreadIndicator} />}
              <Text style={[styles.categoryLabel, isHighPriority && { color: WARNING }]}>{item.categoryText}</Text>
            </Row>
            <Text style={styles.timeText}>{formatTimeAgo(item.timestamp)}</Text>
          </Row>
          <Spacer size={4} />
          <Text style={[styles.titleText, isUnread && styles.titleTextUnread]} numberOfLines={1}>{item.title}</Text>
          <Spacer size={2} />
          <Text style={styles.descText} numberOfLines={2}>{item.desc}</Text>
        </Col>
        <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} style={{ marginTop: 24, marginLeft: 8 }} />
      </Row>
    </TouchableOpacity>
  );
};

const NotificationFAB = ({ onPress }: { onPress: () => void }) => {
  const insets = useSafeAreaInsets();
  const pan = useRef(new RNAnimated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Start dragging if moved more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  return (
    <RNAnimated.View
      {...panResponder.panHandlers}
      style={[
        styles.fab,
        { bottom: Math.max(insets.bottom + 80, 80) },
        { transform: [{ translateX: pan.x }, { translateY: pan.y }] }
      ]}
    >
      <TouchableOpacity 
        activeOpacity={0.85} 
        onPress={onPress}
        style={styles.fabInner}
      >
        <Ionicons name="megaphone-outline" size={18} color={SURFACE} />
        <Text style={styles.fabText}>New Announcement</Text>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

// === MAIN SCREEN COMPONENT ===

export function OwnerAnnouncementsTab() {
  const router = useRouter();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [], isLoading: inboxLoading, error: inboxError, refetch: refetchInbox } = useRoleNotificationsQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const deleteNotif = usePGowStore((s) => s.deleteRoleNotification);
  const markAsRead = usePGowStore((s) => s.markRoleNotificationAsRead);
  const verifyKyc = usePGowStore((s) => s.verifyGuestKycByOwner);
  const sendNotice = usePGowStore((s) => s.sendRoleNotification);
  const bookRepair = usePGowStore((s) => s.bookPgRepairService);

  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'APPROVALS' | 'ANNOUNCEMENTS' | 'REVIEWS'>('ALL');

  // Override back navigation — notices is a hidden tab, not a stack screen.
  useEffect(() => {
    const onBack = () => { router.replace('/overview'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedInboxItem, setSelectedInboxItem] = useState<any | null>(null);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<'all' | 'guest' | 'staff' | 'manager'>('all');
  const [isPublishing, setIsPublishing] = useState(false);

  const inboxItems = useMemo(() => {
    const items: any[] = [];

    const pendingKycGuests = guests.filter((g: GuestEntity) => g.kycStatus === 'PENDING');
    pendingKycGuests.forEach((g: GuestEntity) => {
      items.push({
        id: `kyc_${g.id}`,
        type: 'KYC',
        categoryText: 'KYC',
        title: 'New resident joined',
        desc: `Room ${g.roomNo} · KYC review required`,
        timestamp: g.kycSubmissionDate || Date.now(),
        isRead: false,
        priority: 'MEDIUM',
        icon: 'shield-checkmark',
        raw: g,
      });
    });

    roleNotifs.forEach((n) => {
      const titleLower = (n.title || '').toLowerCase();
      const catUpper = (n.category || '').toUpperCase();
      const descLower = (n.message || '').toLowerCase();
      
      let isApproval = catUpper.includes('EXPENSE') || catUpper.includes('FINANCE') || titleLower.includes('approval') || titleLower.includes('procurement') || titleLower.includes('salary');
      
      let icon: any = 'notifications';
      let categoryText = 'UPDATE';
      
      if (titleLower.includes('payment') || descLower.includes('payment') || titleLower.includes('rent')) {
        icon = 'wallet';
        categoryText = 'PAYMENT';
      } else if (titleLower.includes('complaint') || titleLower.includes('repair') || titleLower.includes('maintenance')) {
        icon = 'construct';
        categoryText = 'MAINTENANCE';
      } else if (titleLower.includes('review') || titleLower.includes('rating') || titleLower.includes('feedback')) {
        icon = 'star';
        categoryText = 'REVIEW';
      } else if (titleLower.includes('food') || titleLower.includes('meal') || titleLower.includes('rsvp')) {
        icon = 'restaurant';
        categoryText = 'MEAL';
      } else if (isApproval) {
        icon = 'flash';
        categoryText = 'APPROVAL';
      } else {
        icon = 'megaphone';
        categoryText = 'ANNOUNCEMENT';
      }

      items.push({
        id: `notif_${n.id}`,
        type: isApproval ? 'APPROVAL' : 'NOTICE',
        categoryText,
        title: n.title,
        desc: n.message,
        timestamp: n.timestamp,
        isRead: n.isRead,
        priority: isApproval ? 'HIGH' : 'LOW',
        icon,
        raw: n,
      });
    });

    const weights: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return items.sort((a, b) => {
      const wA = weights[a.priority] || 1;
      const wB = weights[b.priority] || 1;
      if (wA !== wB) return wB - wA;
      return b.timestamp - a.timestamp;
    });
  }, [guests, roleNotifs]);

  const totalInboxCount = inboxItems.length;
  const approvalsCount = inboxItems.filter((i) => i.type === 'APPROVAL' || i.type === 'KYC').length;
  const noticesCount = inboxItems.filter((i) => i.type === 'NOTICE').length;

  const displayedItems = useMemo(() => {
    if (activeSubTab === 'APPROVALS') return inboxItems.filter((i) => i.type === 'APPROVAL' || i.type === 'KYC');
    if (activeSubTab === 'ANNOUNCEMENTS') return inboxItems.filter((i) => i.type === 'NOTICE');
    return inboxItems;
  }, [inboxItems, activeSubTab]);

  const handleApproveRequest = async (item: any) => {
    hapticSuccess();
    if (item.type === 'APPROVAL') {
      deleteNotif(item.raw.id);
      toast('success', 'Request Approved', `Approval request "${item.title}" processed.`);
    } else if (item.type === 'KYC') {
      await verifyKyc(item.raw.id, true);
      toast('success', 'KYC Approved', `${item.raw.name} is now verified.`);
    }
    setSelectedInboxItem(null);
  };

  const handleRejectRequest = async (item: any) => {
    hapticSelect();
    if (item.type === 'APPROVAL') {
      Alert.alert('Reject Request', `Are you sure you want to reject "${item.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            deleteNotif(item.raw.id);
            toast('info', 'Request Rejected', 'Request marked as rejected.');
            setSelectedInboxItem(null);
          },
        },
      ]);
    } else if (item.type === 'KYC') {
      Alert.alert('Reject KYC', 'Are you sure you want to reject this KYC document upload?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            await verifyKyc(item.raw.id, false, 'Documents unreadable or incomplete.');
            toast('warning', 'KYC Rejected', 'Resident notified.');
            setSelectedInboxItem(null);
          },
        },
      ]);
    }
  };

  const handleBookService = (item: any) => {
    hapticSuccess();
    const serviceName = item.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim() || "General Repair";
    bookRepair(serviceName, `Direct booking from notification: ${item.desc}`, 'ASAP', 149);
    toast('success', 'Service Booked!', `Technician assigned for ${serviceName}.`);
    setSelectedInboxItem(null);
  };

  const handlePublishNotice = async () => {
    if (!noticeTitle.trim() || !noticeMessage.trim()) {
      Alert.alert('Validation', 'Title and message are required.');
      return;
    }
    setIsPublishing(true);
    try {
      const ok = await sendNotice(
        noticeAudience.toUpperCase(),
        noticeTitle.trim(),
        noticeMessage.trim(),
        'ANNOUNCEMENT',
        'NORMAL'
      );
      if (ok) {
        hapticSuccess();
        toast('success', 'Announcement Published', `Broadcast delivered to target ${noticeAudience}.`);
        setNoticeTitle('');
        setNoticeMessage('');
        setShowBroadcastModal(false);
      }
    } catch {
      hapticError();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenItem = (item: any) => {
    hapticSelect();
    setSelectedInboxItem(item);
    if (item.type === 'NOTICE' || item.type === 'APPROVAL') markAsRead(item.raw.id);
  };

  const tabs = [
    { id: 'ALL', label: 'All', count: totalInboxCount },
    { id: 'APPROVALS', label: 'Approvals', count: approvalsCount },
    { id: 'ANNOUNCEMENTS', label: 'Announcements', count: noticesCount },
    { id: 'REVIEWS', label: 'Reviews' },
  ];

  return (
    <View style={styles.root}>
      <ScrollView 
        contentContainerStyle={[styles.mainScroll, { paddingBottom: 120 }]} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        <NotificationSummary total={totalInboxCount} approvals={approvalsCount} />
        <Spacer size={16} />
        <NotificationStatusRow pending={approvalsCount} />
        <Spacer size={20} />
        <NotificationFilterRow 
          tabs={tabs} 
          activeTab={activeSubTab} 
          onChange={(id) => { hapticSelect(); setActiveSubTab(id as any); }} 
        />
        <Spacer size={16} />
        
        {activeSubTab === 'REVIEWS' ? (
          <View style={{ marginHorizontal: -20 }}>
            <OwnerReviewsTab />
          </View>
        ) : (
          <View>
            {inboxLoading ? (
              <LoadingState label="Loading inbox…" fill={false} />
            ) : inboxError ? (
              <ErrorState error={inboxError} title="Could not load the inbox" onRetry={refetchInbox} fill={false} />
            ) : displayedItems.length === 0 ? (
              <NotificationEmptyState />
            ) : (
              <View style={styles.listContainer}>
                {displayedItems.map((item, index) => (
                  <View key={item.id}>
                    <NotificationItem item={item} onPress={() => handleOpenItem(item)} />
                    {index < displayedItems.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <NotificationFAB onPress={() => { hapticSelect(); setShowBroadcastModal(true); }} />

      {/* ── Inbox Item Detail Modal ── */}
      {selectedInboxItem && (
        <Modal visible transparent animationType="none" onRequestClose={() => setSelectedInboxItem(null)}>
          <Animated.View entering={FadeIn.duration(150)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedInboxItem(null)} />
            <Animated.View entering={SlideInDown.duration(150)} style={styles.detailSheet}>
              <View style={styles.sheetHandle} />
              
              <Row justify="space-between" align="center" style={{ marginBottom: 20 }}>
                <Row gap={8} align="center">
                  <View style={styles.detailIconCircle}>
                     <Ionicons 
                        name={selectedInboxItem.type === 'APPROVAL' ? 'checkmark-circle' : selectedInboxItem.type === 'NOTICE' ? 'megaphone' : 'information-circle'} 
                        size={18} 
                        color={PRIMARY} 
                     />
                  </View>
                  <Text style={styles.detailCategoryText}>{selectedInboxItem.categoryText}</Text>
                </Row>
                <TouchableOpacity onPress={() => setSelectedInboxItem(null)} style={styles.closeIconBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              </Row>

              <Text style={styles.detailTitleText}>
                {selectedInboxItem.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()}
              </Text>
              
              <Text style={styles.detailDateText}>
                {new Date(selectedInboxItem.timestamp).toLocaleString('en-IN', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </Text>

              <Spacer size={24} />

              <View style={styles.detailMessageCard}>
                <Text style={styles.detailDescText}>{selectedInboxItem.desc}</Text>
              </View>

              <Spacer size={32} />

              {selectedInboxItem.type === 'APPROVAL' && (
                <View style={styles.actionBlockBox}>
                  <Text style={styles.actionBlockLabel}>Requires Owner Approval</Text>
                  <Spacer size={16} />
                  <Row gap={12}>
                    <TouchableOpacity style={styles.actionApproveBtn} onPress={() => handleApproveRequest(selectedInboxItem)}>
                      <Text style={styles.actionApproveText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionRejectBtn} onPress={() => handleRejectRequest(selectedInboxItem)}>
                      <Text style={styles.actionRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </Row>
                </View>
              )}

              {selectedInboxItem.type === 'KYC' && (() => {
                const kycGuest = (selectedInboxItem.raw && selectedInboxItem.raw.idProofPhotoUri)
                  ? selectedInboxItem.raw
                  : guests.find((g: GuestEntity) => 
                      (selectedInboxItem.raw?.actionId && g.id === selectedInboxItem.raw.actionId) ||
                      (selectedInboxItem.raw?.name && g.name.toLowerCase() === selectedInboxItem.raw.name.toLowerCase()) ||
                      (selectedInboxItem.desc && selectedInboxItem.desc.includes(g.roomNo)) ||
                      (selectedInboxItem.message && selectedInboxItem.message.toLowerCase().includes(g.name.toLowerCase()))
                    ) || guests.find((g: GuestEntity) => g.kycStatus === 'PENDING') || selectedInboxItem.raw;

                return (
                  <View style={styles.actionBlockBox}>
                    <Text style={styles.actionBlockLabel}>Identity Verification Required</Text>
                    <Text style={styles.actionBlockDesc}>Verify {kycGuest?.name || selectedInboxItem.raw?.name || 'resident'}'s identity documents.</Text>
                    <Spacer size={16} />
                    <KycDocumentsCard
                      idPhotoUri={kycGuest?.idProofPhotoUri}
                      selfieUri={kycGuest?.profilePhotoUri}
                      emptyHint="No document photos uploaded yet."
                    />
                    <Spacer size={16} />
                    <Row gap={12}>
                      <TouchableOpacity style={styles.actionApproveBtn} onPress={() => handleApproveRequest(selectedInboxItem)}>
                        <Text style={styles.actionApproveText}>Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionRejectBtn} onPress={() => handleRejectRequest(selectedInboxItem)}>
                        <Text style={styles.actionRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </Row>
                  </View>
                );
              })()}

              {selectedInboxItem.categoryText === 'MAINTENANCE' && (
                <View style={styles.actionBlockBox}>
                  <Text style={styles.actionBlockLabel}>Resolve this issue</Text>
                  <Text style={styles.actionBlockDesc}>Instantly book a technician to fix this problem.</Text>
                  <Spacer size={16} />
                  <TouchableOpacity style={styles.actionApproveBtn} onPress={() => handleBookService(selectedInboxItem)} activeOpacity={0.85}>
                    <Row gap={8} align="center">
                      <Ionicons name="construct" size={16} color={SURFACE} />
                      <Text style={styles.actionApproveText}>Book Service Now</Text>
                    </Row>
                  </TouchableOpacity>
                </View>
              )}

              {(selectedInboxItem.type !== 'APPROVAL' && selectedInboxItem.type !== 'KYC' && selectedInboxItem.categoryText !== 'MAINTENANCE') && (
                <TouchableOpacity style={styles.primaryDismissBtn} onPress={() => setSelectedInboxItem(null)} activeOpacity={0.85}>
                  <Text style={styles.primaryDismissBtnText}>Got it</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </Animated.View>
        </Modal>
      )}

      {/* ── Publish New Notice Dialog ── */}
      {showBroadcastModal && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowBroadcastModal(false)}>
          <Animated.View entering={FadeIn.duration(150)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBroadcastModal(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
              <Animated.View entering={SlideInDown.duration(150)} style={styles.broadcastSheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>New Announcement</Text>
                <Spacer size={16} />
                <TextInput style={styles.noticeInput} placeholder="Title (e.g. WiFi Maintenance)" placeholderTextColor={TEXT_SECONDARY} value={noticeTitle} onChangeText={setNoticeTitle} />
                <Spacer size={12} />
                <TextInput style={[styles.noticeInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Description..." placeholderTextColor={TEXT_SECONDARY} value={noticeMessage} onChangeText={setNoticeMessage} multiline numberOfLines={3} />
                <Spacer size={16} />
                <Text style={styles.inputLabelStyle}>Target Audience</Text>
                <Spacer size={8} />
                <Row gap={8}>
                  {(['all', 'guest', 'staff', 'manager'] as const).map((aud) => (
                    <TouchableOpacity key={aud} style={[styles.smallChip, noticeAudience === aud && styles.smallChipActive]} onPress={() => setNoticeAudience(aud)}>
                      <Text style={[styles.smallChipText, noticeAudience === aud && styles.smallChipTextActive]}>
                        {aud === 'all' ? 'All' : aud === 'guest' ? 'Residents' : aud === 'staff' ? 'Staff' : 'Managers'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Row>
                <Spacer size={24} />
                <Row gap={12}>
                  <TouchableOpacity style={styles.publishBtn} onPress={handlePublishNotice} disabled={isPublishing} activeOpacity={0.8}>
                    <Text style={styles.publishBtnText}>{isPublishing ? 'Publishing...' : 'Publish'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.publishCancelBtn} onPress={() => setShowBroadcastModal(false)} activeOpacity={0.8}>
                    <Text style={styles.publishCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </Row>
              </Animated.View>
            </KeyboardAvoidingView>
          </Animated.View>
        </Modal>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: BG },
  headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
  
  mainScroll: { paddingHorizontal: 20, paddingTop: 8 },
  
  summaryContainer: { marginTop: 0 },
  summaryTitle: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY },
  summarySub: { fontSize: 14, fontWeight: '500', color: TEXT_SECONDARY },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 12, borderRadius: 8, backgroundColor: SURFACE },
  statusSuccess: { backgroundColor: '#F0FDF4' },
  statusSuccessText: { fontSize: 13, fontWeight: '600', color: '#166534', marginLeft: 8 },
  statusWarning: { backgroundColor: '#FFFBEB' },
  statusWarningText: { fontSize: 13, fontWeight: '600', color: '#B45309', marginLeft: 8 },

  filterScrollContent: { paddingRight: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: DIVIDER, marginRight: 8 },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterChipText: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  filterChipTextActive: { color: SURFACE },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  emptySub: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 4 },

  listContainer: { backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: DIVIDER, overflow: 'hidden' },
  notifItemContainer: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: SURFACE },
  notifItemUnread: { backgroundColor: UNREAD_SURFACE },
  divider: { height: 1, backgroundColor: DIVIDER },
  
  iconContainer: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  iconContainerHigh: { backgroundColor: '#FEF2F2' },
  unreadIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY },
  categoryLabel: { fontSize: 11, fontWeight: '800', color: PRIMARY, letterSpacing: 0.5 },
  timeText: { fontSize: 12, fontWeight: '500', color: TEXT_SECONDARY },
  titleText: { fontSize: 15, fontWeight: '500', color: TEXT_PRIMARY },
  titleTextUnread: { fontWeight: '700' },
  descText: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20 },
  
  fab: { position: 'absolute', right: 20, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  fabInner: { height: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 14, fontWeight: '700', color: SURFACE, marginLeft: 8 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23, 24, 28, 0.45)', justifyContent: 'flex-end' },
  detailSheet: { width: '100%', backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  broadcastSheet: { width: '100%', backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  sheetHandle: { width: 48, height: 5, borderRadius: 2.5, backgroundColor: DIVIDER, alignSelf: 'center', marginBottom: 24 },
  
  detailIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  detailCategoryText: { fontSize: 12, fontWeight: '800', color: PRIMARY, letterSpacing: 0.5, textTransform: 'uppercase' },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  
  detailTitleText: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, lineHeight: 28 },
  detailDateText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, marginTop: 6 },
  
  detailMessageCard: { backgroundColor: '#F9FAFB', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: DIVIDER },
  detailDescText: { fontSize: 15, color: '#374151', lineHeight: 24 },
  
  actionBlockBox: { backgroundColor: SURFACE, borderWidth: 1, borderColor: PRIMARY, borderRadius: 16, padding: 20 },
  actionBlockLabel: { fontSize: 14, fontWeight: '800', color: PRIMARY },
  actionBlockDesc: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  actionApproveBtn: { flex: 1, height: 48, backgroundColor: '#16A34A', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionApproveText: { fontSize: 15, fontWeight: '800', color: SURFACE },
  actionRejectBtn: { flex: 1, height: 48, backgroundColor: '#DC2626', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionRejectText: { fontSize: 15, fontWeight: '800', color: SURFACE },
  
  primaryDismissBtn: { height: 52, backgroundColor: PRIMARY, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryDismissBtnText: { fontSize: 16, fontWeight: '800', color: SURFACE },
  
  sheetTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
  noticeInput: { borderWidth: 1, borderColor: DIVIDER, backgroundColor: BG, borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: TEXT_PRIMARY, height: 48 },
  inputLabelStyle: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  smallChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: SURFACE, borderWidth: 1, borderColor: DIVIDER },
  smallChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  smallChipText: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY },
  smallChipTextActive: { color: SURFACE },
  publishBtn: { flex: 2, height: 48, backgroundColor: PRIMARY, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  publishBtnText: { fontSize: 15, fontWeight: '700', color: SURFACE },
  publishCancelBtn: { flex: 1, height: 48, borderWidth: 1, borderColor: DIVIDER, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  publishCancelText: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
});
