/**
 * OwnerAnnouncementsTab — Owner-only Announcements & Manager Approvals Hub
 *
 * Cyber Mint Light Theme:
 *   - Manager Approvals Queue: Shows pending approvals requested by managers (procurement, salary, repairs).
 *   - Announcement Broadcaster: Publish notices to All, Residents, Staff, or Managers.
 *   - Active Broadcasts Feed: Live announcements history with audience tags.
 */
import { useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, Linking, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Chip, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { RoleNotificationBroadcastDialog } from '@/components/dialogs/RoleNotificationBroadcastDialog';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatTimeAgo } from '@/utils/format';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';

export function OwnerAnnouncementsTab() {
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  const deleteNotif = usePGowStore((s) => s.deleteRoleNotification);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'APPROVALS' | 'ANNOUNCEMENTS'>('ALL');

  // Filter manager approvals (procurement, expenses, high priority manager requests)
  const managerApprovals = roleNotifs.filter(
    (n) =>
      (n.category || '').toUpperCase().includes('EXPENSE') ||
      (n.category || '').toUpperCase().includes('FINANCE') ||
      (n.title || '').toLowerCase().includes('approval') ||
      (n.title || '').toLowerCase().includes('procurement') ||
      (n.title || '').toLowerCase().includes('salary'),
  );

  // Filter general announcements broadcasted
  const announcements = roleNotifs.filter(
    (n) =>
      (n.category || '').toUpperCase().includes('ANNOUNCEMENT') ||
      (n.category || '').toUpperCase().includes('BROADCAST') ||
      !(
        (n.category || '').toUpperCase().includes('EXPENSE') ||
        (n.category || '').toUpperCase().includes('FINANCE')
      ),
  );

  const displayedList =
    activeSubTab === 'APPROVALS'
      ? managerApprovals
      : activeSubTab === 'ANNOUNCEMENTS'
        ? announcements
        : roleNotifs;

  const handleApprove = (notifId: string, title: string) => {
    hapticSuccess();
    deleteNotif(notifId);
    toast('success', 'Request Approved', `Manager approval for "${title}" has been approved.`);
  };

  const handleReject = (notifId: string, title: string) => {
    hapticSelect();
    Alert.alert('Reject Request', `Are you sure you want to reject "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          deleteNotif(notifId);
          toast('info', 'Request Rejected', `Request "${title}" marked as rejected.`);
        },
      },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      {/* Header */}
      <Row justify="space-between" align="center">
        <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary}>Announcements & Approvals</Txt>
        <Btn
          onPress={() => { hapticSelect(); setShowBroadcastModal(true); }}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={12}
          height={36}
          contentStyle={{ paddingHorizontal: 12 }}
        >
          <Ionicons name="megaphone" size={14} color={Colors.textInverse} />
          <Txt variant="caption" weight="800" color={Colors.textInverse} style={{ marginLeft: 4 }}>+ New Notice</Txt>
        </Btn>
      </Row>

      {/* Hero Approvals Summary Card */}
      <Card
        containerColor={managerApprovals.length > 0 ? '#FFFBEB' : Colors.surface}
        borderRadius={18}
        borderWidth={1}
        borderColor={managerApprovals.length > 0 ? '#F59E0B' : Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row justify="space-between" align="center">
          <Row gap={8} align="center">
            <View style={[styles.iconCircle, { backgroundColor: managerApprovals.length > 0 ? '#FEF3C7' : '#F0FDF9' }]}>
              <Ionicons
                name={managerApprovals.length > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={20}
                color={managerApprovals.length > 0 ? '#D97706' : Colors.primary}
              />
            </View>
            <Col>
              <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>
                {managerApprovals.length} Pending Manager Approval{managerApprovals.length === 1 ? '' : 's'}
              </Txt>
              <Txt variant="caption" color={Colors.textMuted}>
                {managerApprovals.length > 0
                  ? 'Manager submitted supply/salary requests requiring your review'
                  : 'All manager requests are reviewed and up to date'}
              </Txt>
            </Col>
          </Row>
        </Row>
      </Card>

      {/* Sub-Tabs: All / Manager Approvals / General Notices */}
      <Row gap={8}>
        <Chip
          label={`All Updates (${roleNotifs.length})`}
          selected={activeSubTab === 'ALL'}
          onPress={() => { hapticSelect(); setActiveSubTab('ALL'); }}
        />
        <Chip
          label={`⚡ Approvals (${managerApprovals.length})`}
          selected={activeSubTab === 'APPROVALS'}
          onPress={() => { hapticSelect(); setActiveSubTab('APPROVALS'); }}
        />
        <Chip
          label={`📢 Notices (${announcements.length})`}
          selected={activeSubTab === 'ANNOUNCEMENTS'}
          onPress={() => { hapticSelect(); setActiveSubTab('ANNOUNCEMENTS'); }}
        />
      </Row>

      {/* Approvals & Announcements List */}
      {displayedList.length === 0 ? (
        <Card containerColor={Colors.surface} borderRadius={16} padding={[28, 20]} style={{ alignItems: 'center' }}>
          <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
          <Txt variant="body" weight="700" color={Colors.textMuted} style={{ marginTop: 8 }}>
            No notices or approvals in this category
          </Txt>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {displayedList.map((item) => {
            const isApproval =
              (item.category || '').toUpperCase().includes('EXPENSE') ||
              (item.category || '').toUpperCase().includes('FINANCE') ||
              (item.title || '').toLowerCase().includes('approval') ||
              (item.title || '').toLowerCase().includes('procurement') ||
              (item.title || '').toLowerCase().includes('salary');

            return (
              <Card
                key={item.id}
                containerColor={isApproval ? '#F0FDF4' : Colors.surface}
                borderRadius={16}
                borderWidth={1}
                borderColor={isApproval ? '#86EFAC' : Colors.borderSubtle}
                padding={[14, 14]}
              >
                <Row justify="space-between" align="center">
                  <Row gap={6} align="center">
                    <View style={[styles.dot, { backgroundColor: isApproval ? '#16A34A' : Colors.primary }]} />
                    <Txt variant="labelSmall" weight="900" color={isApproval ? '#166534' : Colors.primaryDark}>
                      {isApproval ? 'MANAGER APPROVAL REQUEST' : (item.category || 'ANNOUNCEMENT').replace(/_/g, ' ')}
                    </Txt>
                  </Row>
                  <Row gap={6} align="center">
                    <Txt size={9} color={Colors.textMuted}>{formatTimeAgo(item.timestamp)}</Txt>
                    <IconBtn onPress={() => deleteNotif(item.id)} icon="close" size={12} tint={Colors.textMuted} padding={2} />
                  </Row>
                </Row>

                <Spacer size={6} />
                <Txt variant="body" weight="800" color={Colors.textPrimary}>{item.title}</Txt>
                <Spacer size={3} />
                <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 16 }}>{item.message}</Txt>

                {isApproval && (
                  <View style={styles.managerActionBox}>
                    <Row justify="space-between" align="center">
                      <Row gap={6} align="center">
                        <Ionicons name="person-circle" size={16} color={Colors.primary} />
                        <Txt variant="caption" weight="700" color={Colors.textPrimary}>
                          Manager: {owner?.managerName || 'Assigned Manager'}
                        </Txt>
                      </Row>
                      {owner?.managerPhone && (
                        <IconBtn
                          onPress={() => Linking.openURL(`tel:${owner.managerPhone.replace(/\s+/g, '')}`)}
                          icon="call"
                          size={14}
                          tint={Colors.primary}
                        />
                      )}
                    </Row>
                    <Spacer size={8} />
                    <Row gap={8}>
                      <Btn
                        onPress={() => handleApprove(item.id, item.title)}
                        containerColor={Colors.primary}
                        textColor={Colors.textInverse}
                        borderRadius={8}
                        height={32}
                        style={{ flex: 1 }}
                      >
                        <Txt variant="caption" weight="800" color={Colors.textInverse}>Approve ✓</Txt>
                      </Btn>
                      <OutlinedBtn
                        onPress={() => handleReject(item.id, item.title)}
                        borderColor="#FCA5A5"
                        textColor="#B91C1C"
                        borderRadius={8}
                        height={32}
                        style={{ flex: 1 }}
                      >
                        <Txt variant="caption" weight="800" color="#B91C1C">Reject / Notes</Txt>
                      </OutlinedBtn>
                    </Row>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <RoleNotificationBroadcastDialog onDismiss={() => setShowBroadcastModal(false)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  managerActionBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 10,
    marginTop: 10,
  },
});
