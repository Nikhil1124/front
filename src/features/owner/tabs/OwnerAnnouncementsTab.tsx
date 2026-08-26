import { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Alert, Modal, Pressable, RefreshControl, TextInput, TouchableOpacity, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatTimeAgo } from '@/utils/format';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { GuestEntity, FeedbackComplaintEntity } from '@/types';

const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#DDE8E0';
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF8F1';
const RADIUS = 16;

import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';

export function OwnerAnnouncementsTab() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { data: submissions = [] } = useComplaintsQuery(activePgId ?? undefined);
  const deleteNotif = usePGowStore((s) => s.deleteRoleNotification);
  const markAsRead = usePGowStore((s) => s.markRoleNotificationAsRead);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const verifyKyc = usePGowStore((s) => s.verifyGuestKycByOwner);
  const respondComplaint = usePGowStore((s) => s.respondToFeedbackComplaint);
  const sendNotice = usePGowStore((s) => s.sendRoleNotification);

  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'APPROVALS' | 'ANNOUNCEMENTS'>('ALL');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedInboxItem, setSelectedInboxItem] = useState<any | null>(null);

  // Broadcast notice form states
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<'all' | 'guest' | 'staff' | 'manager'>('all');
  const [isPublishing, setIsPublishing] = useState(false);

  // Resolution inputs inside detail sheet
  const [complaintReplyText, setComplaintReplyText] = useState('');

  // 1. Compile Unified Inbox Items
  const inboxItems = useMemo(() => {
    const items: any[] = [];

    // Pending KYC Reviews
    const pendingKycGuests = guests.filter((g: GuestEntity) => g.kycStatus === 'PENDING');
    pendingKycGuests.forEach((g: GuestEntity) => {
      items.push({
        id: `kyc_${g.id}`,
        type: 'KYC',
        title: 'New resident joined',
        desc: `Room ${g.roomNo} · KYC review required`,
        timestamp: g.kycSubmissionDate || Date.now(),
        isRead: false,
        priority: 'MEDIUM',
        icon: 'document-text-outline',
        raw: g,
      });
    });

    // Active complaints
    const openComplaints = submissions.filter((s: FeedbackComplaintEntity) => s.type === 'COMPLAINT' && s.status !== 'Resolved');
    openComplaints.forEach((c: FeedbackComplaintEntity) => {
      items.push({
        id: `complaint_${c.id}`,
        type: 'COMPLAINT',
        title: c.title || 'Plumbing request',
        desc: `Room ${c.roomNo} · ${c.description}`,
        timestamp: c.timestamp,
        isRead: c.status === 'In Progress',
        priority: c.overallRating <= 2 ? 'HIGH' : 'MEDIUM',
        icon: 'alert-circle-outline',
        raw: c,
      });
    });

    // Manager Approvals & General Notices
    roleNotifs.forEach((n) => {
      const isApproval =
        (n.category || '').toUpperCase().includes('EXPENSE') ||
        (n.category || '').toUpperCase().includes('FINANCE') ||
        (n.title || '').toLowerCase().includes('approval') ||
        (n.title || '').toLowerCase().includes('procurement') ||
        (n.title || '').toLowerCase().includes('salary');

      items.push({
        id: `notif_${n.id}`,
        type: isApproval ? 'APPROVAL' : 'NOTICE',
        title: n.title,
        desc: n.message,
        timestamp: n.timestamp,
        isRead: n.isRead,
        priority: isApproval ? 'HIGH' : 'LOW',
        icon: isApproval ? 'flash-outline' : 'megaphone-outline',
        raw: n,
      });
    });

    // Sort: HIGH -> MEDIUM -> LOW, then timestamp desc
    const weights: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sorted = items.sort((a, b) => {
      const wA = weights[a.priority] || 1;
      const wB = weights[b.priority] || 1;
      if (wA !== wB) return wB - wA;
      return b.timestamp - a.timestamp;
    });

    return sorted;
  }, [guests, submissions, roleNotifs]);

  // Counts
  const totalInboxCount = inboxItems.length;
  const approvalsCount = inboxItems.filter((i) => i.type === 'APPROVAL' || i.type === 'KYC' || i.type === 'COMPLAINT').length;
  const noticesCount = inboxItems.filter((i) => i.type === 'NOTICE').length;

  // Filter list by active tab
  const displayedItems = useMemo(() => {
    if (activeSubTab === 'APPROVALS') {
      return inboxItems.filter((i) => i.type === 'APPROVAL' || i.type === 'KYC' || i.type === 'COMPLAINT');
    }
    if (activeSubTab === 'ANNOUNCEMENTS') {
      return inboxItems.filter((i) => i.type === 'NOTICE');
    }
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

  const handleResolveComplaint = async (item: any) => {
    hapticSuccess();
    const reply = complaintReplyText.trim() || 'Issue resolved by property owner.';
    await respondComplaint(item.raw.id, reply, 'Resolved');
    toast('success', 'Complaint Resolved', 'Status marked as Resolved.');
    setComplaintReplyText('');
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
        toast('success', 'Notice Published', `Broadcast delivered to target ${noticeAudience}.`);
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
    if (item.type === 'NOTICE' || item.type === 'APPROVAL') {
      markAsRead(item.raw.id);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />
      }
    >
      {/* ── Title Header ── */}
      <Row justify="space-between" align="center">
        <Col>
          <Text style={styles.bodyTitle}>Notices</Text>
          <Text style={styles.bodySub}>Updates and actions for your PG</Text>
        </Col>
        
        <TouchableOpacity
          style={styles.newNoticeBtn}
          onPress={() => {
            hapticSelect();
            setShowBroadcastModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="megaphone-outline" size={14} color={WHITE} style={{ marginRight: 6 }} />
          <Text style={styles.newNoticeBtnText}>+ New Notice</Text>
        </TouchableOpacity>
      </Row>

      <Spacer size={16} />

      {/* ── Attention Status Strip ── */}
      {approvalsCount > 0 ? (
        <TouchableOpacity
          style={styles.attentionStrip}
          onPress={() => setActiveSubTab('APPROVALS')}
          activeOpacity={0.85}
        >
          <Row justify="space-between" align="center" style={{ width: '100%' }}>
            <Row gap={8} align="center">
              <Ionicons name="alert-circle-outline" size={18} color="#D97706" />
              <Text style={styles.attentionStripText}>Needs Attention · {approvalsCount} actions pending</Text>
            </Row>
            <Ionicons name="chevron-forward" size={14} color="#D97706" />
          </Row>
        </TouchableOpacity>
      ) : (
        <View style={styles.successStrip}>
          <Ionicons name="checkmark-circle-outline" size={18} color={GREEN} />
          <Text style={styles.successStripText}>✓ All caught up · No pending approvals.</Text>
        </View>
      )}

      <Spacer size={16} />

      {/* ── Navigation Segment Filter Tabs ── */}
      <Row gap={8}>
        <TouchableOpacity
          style={[styles.chipTab, activeSubTab === 'ALL' && styles.chipTabActive]}
          onPress={() => {
            hapticSelect();
            setActiveSubTab('ALL');
          }}
        >
          <Text style={[styles.chipTabText, activeSubTab === 'ALL' && styles.chipTabTextActive]}>
            All {totalInboxCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipTab, activeSubTab === 'APPROVALS' && styles.chipTabActive]}
          onPress={() => {
            hapticSelect();
            setActiveSubTab('APPROVALS');
          }}
        >
          <Text style={[styles.chipTabText, activeSubTab === 'APPROVALS' && styles.chipTabTextActive]}>
            Approvals {approvalsCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipTab, activeSubTab === 'ANNOUNCEMENTS' && styles.chipTabActive]}
          onPress={() => {
            hapticSelect();
            setActiveSubTab('ANNOUNCEMENTS');
          }}
        >
          <Text style={[styles.chipTabText, activeSubTab === 'ANNOUNCEMENTS' && styles.chipTabTextActive]}>
            Notices {noticesCount}
          </Text>
        </TouchableOpacity>
      </Row>

      <Spacer size={12} />

      {/* ── Unified Inbox list ── */}
      {displayedItems.length === 0 ? (
        <View style={styles.emptyInboxBox}>
          <Ionicons name="checkmark-circle-outline" size={32} color={MUTED} />
          <Text style={styles.emptyInboxTitle}>All caught up</Text>
          <Text style={styles.emptyInboxDesc}>
            There are no new announcements or actions right now.
          </Text>
        </View>
      ) : (
        <View style={styles.inboxListContainer}>
          {displayedItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.inboxRow}
              onPress={() => handleOpenItem(item)}
              activeOpacity={0.8}
            >
              <Row justify="space-between" align="center" style={{ width: '100%' }}>
                <Row gap={12} align="center" style={{ flex: 1 }}>
                  {/* Category icon indicator */}
                  <View style={[styles.inboxIconBox, item.priority === 'HIGH' && { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.priority === 'HIGH' ? '#DC2626' : GREEN}
                    />
                  </View>

                  <Col style={{ flex: 1 }}>
                    <Row gap={6} align="center">
                      {!item.isRead && (
                        <View style={styles.unreadDot} />
                      )}
                      <Text
                        style={[
                          styles.inboxCategoryTag,
                          item.type === 'COMPLAINT' && { color: '#DC2626' },
                          item.type === 'APPROVAL' && { color: '#D97706' },
                        ]}
                      >
                        {item.type}
                      </Text>
                    </Row>
                    <Text
                      style={[styles.inboxTitleText, !item.isRead && styles.inboxTitleTextUnread]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.inboxDescText} numberOfLines={1}>
                      {item.desc}
                    </Text>
                  </Col>
                </Row>

                <Col align="flex-end" style={{ marginLeft: 10 }}>
                  <Text style={styles.inboxTimeText}>{formatTimeAgo(item.timestamp)}</Text>
                  <Ionicons name="chevron-forward" size={14} color={MUTED} style={{ marginTop: 6 }} />
                </Col>
              </Row>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Inbox Item Detail Modal ── */}
      {selectedInboxItem && (
        <Modal visible transparent animationType="none" onRequestClose={() => setSelectedInboxItem(null)}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedInboxItem(null)} />
            
            <Animated.View entering={SlideInDown.duration(160)} style={styles.detailSheet}>
              <View style={styles.sheetHandle} />

              <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>{selectedInboxItem.type}</Text>
                </View>
                <Text style={styles.detailDateText}>
                  {new Date(selectedInboxItem.timestamp).toLocaleString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </Row>

              <Text style={styles.detailTitleText}>{selectedInboxItem.title}</Text>
              <Text style={styles.detailDescText}>{selectedInboxItem.desc}</Text>

              <Spacer size={16} />

              {/* Conditional Action Box */}
              {selectedInboxItem.type === 'APPROVAL' && (
                <View style={styles.actionBlockBox}>
                  <Text style={styles.actionBlockLabel}>Requires Owner Approval</Text>
                  <Spacer size={8} />
                  <Row gap={8}>
                    <TouchableOpacity
                      style={styles.actionApproveBtn}
                      onPress={() => handleApproveRequest(selectedInboxItem)}
                    >
                      <Text style={styles.actionApproveText}>Approve Request</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionRejectBtn}
                      onPress={() => handleRejectRequest(selectedInboxItem)}
                    >
                      <Text style={styles.actionRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </Row>
                </View>
              )}

              {selectedInboxItem.type === 'KYC' && (
                <View style={styles.actionBlockBox}>
                  <Text style={styles.actionBlockLabel}>KYC Document Verification Required</Text>
                  <Text style={styles.actionBlockDesc}>
                    Verify {selectedInboxItem.raw.name}'s ID ({selectedInboxItem.raw.idProofType || 'Aadhaar'}).
                  </Text>
                  
                  <Spacer size={10} />
                  
                  {/* Photo Previews */}
                  <Row gap={8} style={{ width: '100%', marginBottom: 12 }}>
                    <Col style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, marginBottom: 4 }}>Selfie Photo</Text>
                      {selectedInboxItem.raw.profilePhotoUri ? (
                        <Image
                          source={{ uri: selectedInboxItem.raw.profilePhotoUri }}
                          style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: BORDER }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person-outline" size={24} color={MUTED} />
                        </View>
                      )}
                    </Col>
                    <Col style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, marginBottom: 4 }}>ID Document</Text>
                      {selectedInboxItem.raw.idProofPhotoUri ? (
                        <Image
                          source={{ uri: selectedInboxItem.raw.idProofPhotoUri }}
                          style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: BORDER }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="card-outline" size={24} color={MUTED} />
                        </View>
                      )}
                    </Col>
                  </Row>

                  <Row gap={8}>
                    <TouchableOpacity
                      style={styles.actionApproveBtn}
                      onPress={() => handleApproveRequest(selectedInboxItem)}
                    >
                      <Text style={styles.actionApproveText}>Verify & Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionRejectBtn}
                      onPress={() => handleRejectRequest(selectedInboxItem)}
                    >
                      <Text style={styles.actionRejectText}>Reject Docs</Text>
                    </TouchableOpacity>
                  </Row>
                </View>
              )}

              {selectedInboxItem.type === 'COMPLAINT' && (
                <View style={styles.actionBlockBox}>
                  <Text style={styles.actionBlockLabel}>Resolve Guest Issue</Text>
                  <Spacer size={6} />
                  <TextInput
                    style={styles.actionInput}
                    placeholder="Enter resolution notes / instructions to chef..."
                    placeholderTextColor={MUTED}
                    value={complaintReplyText}
                    onChangeText={setComplaintReplyText}
                    multiline
                  />
                  <Spacer size={10} />
                  <TouchableOpacity
                    style={[styles.actionApproveBtn, { width: '100%' }]}
                    onPress={() => handleResolveComplaint(selectedInboxItem)}
                  >
                    <Text style={styles.actionApproveText}>Resolve Issue & Close Ticket</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Spacer size={10} />
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setSelectedInboxItem(null)}
              >
                <Text style={styles.sheetCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}

      {/* ── Publish New Notice Dialog ── */}
      {showBroadcastModal && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowBroadcastModal(false)}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBroadcastModal(false)} />
            
            <Animated.View entering={SlideInDown.duration(160)} style={styles.broadcastSheet}>
              <View style={styles.sheetHandle} />

              <Text style={styles.sheetTitle}>Broadcast New Notice</Text>
              <Spacer size={12} />

              <TextInput
                style={styles.noticeInput}
                placeholder="Notice Title (e.g. WiFi Maintenance)"
                placeholderTextColor={MUTED}
                value={noticeTitle}
                onChangeText={setNoticeTitle}
              />
              
              <Spacer size={10} />

              <TextInput
                style={[styles.noticeInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Notice Message / Announcement description..."
                placeholderTextColor={MUTED}
                value={noticeMessage}
                onChangeText={setNoticeMessage}
                multiline
                numberOfLines={3}
              />

              <Spacer size={12} />

              <Text style={styles.inputLabelStyle}>Select Audience</Text>
              <Spacer size={6} />
              <Row gap={6}>
                {(['all', 'guest', 'staff', 'manager'] as const).map((aud) => (
                  <TouchableOpacity
                    key={aud}
                    style={[styles.smallChip, noticeAudience === aud && styles.smallChipActive]}
                    onPress={() => setNoticeAudience(aud)}
                  >
                    <Text style={[styles.smallChipText, noticeAudience === aud && styles.smallChipTextActive]}>
                      {aud === 'all' ? 'All' : aud === 'guest' ? 'Residents' : aud === 'staff' ? 'Staff' : 'Managers'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </Row>

              <Spacer size={20} />

              <Row gap={10}>
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={handlePublishNotice}
                  disabled={isPublishing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.publishBtnText}>
                    {isPublishing ? 'Publishing...' : 'Publish Notice'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.publishCancelBtn}
                  onPress={() => setShowBroadcastModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.publishCancelText}>Cancel</Text>
                </TouchableOpacity>
              </Row>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, backgroundColor: BG },
  bodyTitle: { fontSize: 18, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },

  // New Notice Button
  newNoticeBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newNoticeBtnText: { fontSize: 12, fontWeight: '800', color: WHITE },

  // Attention status strip
  attentionStrip: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  attentionStripText: { fontSize: 12, fontWeight: '700', color: '#B45309', marginLeft: 8 },
  successStrip: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: LIGHT_GREEN,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successStripText: { fontSize: 12, fontWeight: '700', color: GREEN, marginLeft: 8 },

  // Navigation Filter chips
  chipTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipTabActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  chipTabText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  chipTabTextActive: { color: WHITE, fontWeight: '700' },

  // Inbox list
  emptyInboxBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInboxTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL, marginTop: 8 },
  emptyInboxDesc: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 2 },

  inboxListContainer: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  inboxRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
  inboxIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    marginRight: 4,
  },
  inboxCategoryTag: { fontSize: 9, fontWeight: '800', color: GREEN, letterSpacing: 0.5 },
  inboxTitleText: { fontSize: 13, fontWeight: '500', color: CHARCOAL, marginTop: 2 },
  inboxTitleTextUnread: { fontWeight: '700' },
  inboxDescText: { fontSize: 11, color: MUTED, marginTop: 1 },
  inboxTimeText: { fontSize: 9, color: MUTED },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Detail slide-up sheet
  detailSheet: {
    width: '100%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    alignSelf: 'flex-end',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: LIGHT_GREEN,
  },
  detailBadgeText: { fontSize: 9, fontWeight: '800', color: GREEN },
  detailDateText: { fontSize: 10, color: MUTED },
  detailTitleText: { fontSize: 16, fontWeight: '700', color: CHARCOAL, marginTop: 4 },
  detailDescText: { fontSize: 13, color: MUTED, marginTop: 8, lineHeight: 18 },

  // Conditional action box
  actionBlockBox: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
  },
  actionBlockLabel: { fontSize: 11, fontWeight: '800', color: CHARCOAL, letterSpacing: 0.5 },
  actionBlockDesc: { fontSize: 11, color: MUTED, marginTop: 2 },
  actionApproveBtn: {
    flex: 1.5,
    height: 40,
    backgroundColor: GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionApproveText: { fontSize: 12, fontWeight: '800', color: WHITE },
  actionRejectBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: WHITE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRejectText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  actionInput: {
    height: 64,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    color: CHARCOAL,
    textAlignVertical: 'top',
    paddingTop: 6,
  },

  sheetCloseBtn: {
    height: 44,
    backgroundColor: BG,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },

  // Broadcast Notice Modal Sheet
  broadcastSheet: {
    width: '100%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    alignSelf: 'flex-end',
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  noticeInput: {
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: CHARCOAL,
  },
  inputLabelStyle: { fontSize: 11, fontWeight: '700', color: MUTED },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  smallChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  smallChipText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },
  smallChipTextActive: { color: WHITE, fontWeight: '700' },
  publishBtn: {
    flex: 1.5,
    height: 46,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },
  publishCancelBtn: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  publishCancelText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
});
