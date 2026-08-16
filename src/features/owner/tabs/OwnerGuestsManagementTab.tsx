/**
 * OwnerGuestsManagementTab — port of Kotlin `OwnerGuestsManagementTab`.
 * 2 sub-tabs (Add / Directory) so registering a resident and browsing the
 * roster don't fight for the same long scroll.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { DetailBottomSheet } from '@/components/DetailBottomSheet';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { JoinCodeCard } from '@/components/JoinCodeCard';
import { EditPgPropertyDialog } from '@/components/dialogs/EditPgPropertyDialog';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { formatDateTime } from '@/utils/format';
import type { GuestEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

const SUB_TABS = ['➕ Add Guest', '👥 Directory'];

const KYC_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  VERIFIED: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', label: '✅ Verified' },
  PENDING: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', label: '⏳ KYC Pending' },
  REJECTED: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', label: '❌ Rejected' },
  DEFAULT: { bg: Colors.surfaceMuted, border: Colors.borderSubtle, text: Colors.textMuted, label: '⚠️ No KYC' },
};

export function OwnerGuestsManagementTab() {
  const [subTab, setSubTab] = useState(0);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const guests = usePGowStore((s) => s.currentGuests);
  const createGuestByOwner = usePGowStore((s) => s.createGuestByOwner);
  const updateGuestByOwner = usePGowStore((s) => s.updateGuestByOwner);
  const deleteGuest = usePGowStore((s) => s.deleteGuest);
  const verifyGuestKycByOwner = usePGowStore((s) => s.verifyGuestKycByOwner);

  const confirmDeleteGuest = (g: GuestEntity) => {
    Alert.alert('Remove Resident', `Remove ${g.name} from this property?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteGuest(g.id) },
    ]);
  };

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestRoom, setGuestRoom] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestRent, setGuestRent] = useState('6500');
  const [isCreating, setIsCreating] = useState(false);

  const [editing, setEditing] = useState<GuestEntity | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editRent, setEditRent] = useState('');

  const [reviewing, setReviewing] = useState<GuestEntity | null>(null);
  const [rejecting, setRejecting] = useState<GuestEntity | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  // Detail view for tapping a resident row — surfaces Room Info, KYC photo
  // preview, Payment Status & actions in a single bottom sheet instead of
  // forcing the owner through edit/review modals.
  const [detailGuest, setDetailGuest] = useState<GuestEntity | null>(null);
  const [showEditProperty, setShowEditProperty] = useState(false);
  const activeRole = useAuthStore((s) => s.activeRole);
  const isManager = activeRole === 'manager';

  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const pendingKyc = guests.filter((g) => g.kycStatus === 'PENDING');

  // Which room has people, at a glance — not a bed-by-bed map, just a headcount
  // per room number so the owner can eyeball where a new resident might fit.
  const roomOccupancy = Object.entries(
    guests.reduce<Record<string, number>>((acc, g) => {
      const room = g.roomNo || 'Unassigned';
      acc[room] = (acc[room] ?? 0) + 1;
      return acc;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const result = await createGuestByOwner(guestName, guestEmail, guestPhone, guestRoom, guestPassword, parseFloat(guestRent) || 6500);
      if (result.ok) {
        hapticSuccess();
        toast('success', 'Resident Registered', `${guestName} can now log in.`);
        setGuestName(''); setGuestEmail(''); setGuestPhone(''); setGuestRoom(''); setGuestPassword(''); setGuestRent('6500');
      } else {
        hapticError();
        Alert.alert('Failed', result.error ?? 'Unknown');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const result = await updateGuestByOwner(editing, editName, editEmail, editPhone, editRoom, parseFloat(editRent) || 6500);
    if (result.ok) {
      hapticSuccess();
      toast('success', 'Profile Updated', 'Resident profile & monthly fee updated.');
      setEditing(null);
    } else {
      hapticError();
      Alert.alert('Failed', result.error ?? 'Unknown');
    }
  };

  const handleApprove = async (g: GuestEntity) => {
    await verifyGuestKycByOwner(g.id, true);
    hapticSuccess();
    toast('success', 'KYC Approved', `Notification sent to ${g.name}.`);
    setReviewing(null);
  };

  const handleReject = async () => {
    if (!rejecting) return;
    const reason = rejectionReason.trim() || 'Document or photo unreadable.';
    await verifyGuestKycByOwner(rejecting.id, false, reason);
    hapticError();
    toast('warning', 'KYC Rejected', 'Resident notified. They can re-upload documents.');
    setRejecting(null);
    setRejectionReason('');
  };

  const openEdit = (g: GuestEntity) => {
    hapticSelect();
    setEditing(g);
    setEditName(g.name); setEditEmail(g.email); setEditPhone(g.phone);
    setEditRoom(g.roomNo); setEditRent(String(g.rentAmount));
  };

  const openDetail = (g: GuestEntity) => {
    hapticSelect();
    setDetailGuest(g);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={styles.tabBar}>
        {SUB_TABS.map((label, idx) => {
          const sel = subTab === idx;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => { hapticSelect(); setSubTab(idx); }}
              style={[styles.subTab, { backgroundColor: sel ? Colors.primary : 'transparent' }]}
            >
              <Txt size={11} weight={sel ? '800' : '600'} color={sel ? Colors.textInverse : Colors.textMuted}>
                {label}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>

      {subTab === 0 ? (
        <FormScroll
          contentContainerStyle={{ paddingTop: 14, gap: 14, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
        >
          {/* Above the manual form on purpose: this is the moment the owner is about to
              type a resident in themselves, and therefore the moment the alternative is
              worth seeing. */}
          <JoinCodeCard />

          <Row gap={8} align="center">
            <View style={styles.divider} />
            <Txt size={10} weight="800" color={Colors.textMuted}>OR REGISTER MANUALLY</Txt>
            <View style={styles.divider} />
          </Row>

          <OutlinedTextField label="Guest Full Name *" placeholder="Ramesh Kumar" value={guestName} onChangeText={setGuestName} containerColor={Colors.surfaceMuted} testID="owner_guest_name_input" style={{ marginBottom: 8 }} />
          <OutlinedTextField label="Guest Email ID *" placeholder="ramesh@gmail.com" value={guestEmail} onChangeText={setGuestEmail} keyboardType="email-address" containerColor={Colors.surfaceMuted} testID="owner_guest_email_input" style={{ marginBottom: 8 }} />
          <Row gap={8}>
            <OutlinedTextField label="Room No *" placeholder="101" value={guestRoom} onChangeText={setGuestRoom} containerColor={Colors.surfaceMuted} testID="owner_guest_room_input" style={{ flex: 1 }} />
            <OutlinedTextField label="Phone" placeholder="9876543210" value={guestPhone} onChangeText={setGuestPhone} keyboardType="phone-pad" containerColor={Colors.surfaceMuted} style={{ flex: 1.2 }} />
          </Row>
          <Spacer size={8} />
          <OutlinedTextField label="Monthly Rent Fee (₹) *" placeholder="6500" value={guestRent} onChangeText={setGuestRent} keyboardType="number-pad" containerColor={Colors.surfaceMuted} testID="owner_guest_rent_input" style={{ marginBottom: 8 }} />
          <OutlinedTextField label="Login Passcode / Password *" placeholder="At least 8 characters" value={guestPassword} onChangeText={setGuestPassword} secureTextEntry containerColor={Colors.surfaceMuted} testID="owner_guest_password_input" style={{ marginBottom: 14 }} />
          <Btn onPress={handleCreate} loading={isCreating} disabled={isCreating} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={44} testID="owner_guest_submit_btn">
            <Ionicons name="person-add" size={16} color={Colors.textInverse} />
            <Txt size={13} weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>Register Resident ID & Password</Txt>
          </Btn>
        </FormScroll>
      ) : (
        // Directory roster can run to ~200 residents (refreshAll fetches up to 200) — a real
        // FlatList here instead of `.map()` in a ScrollView so only the visible rows mount.
        <FlatList
          data={guests}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ paddingTop: 14, gap: 14, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
          ListHeaderComponent={
            <View style={{ gap: 14 }}>
              {roomOccupancy.length > 0 && (
                <View>
                  <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
                    ROOM OCCUPANCY
                  </Txt>
                  <View style={styles.roomGrid}>
                    {roomOccupancy.map(([room, count]) => (
                      <View key={room} style={styles.roomChip}>
                        <Txt size={12} weight="800" color={Colors.textPrimary}>Room {room}</Txt>
                        <Txt size={10} color={Colors.textMuted}>{count} resident{count === 1 ? '' : 's'}</Txt>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {pendingKyc.length > 0 && (
                <Card containerColor="#FFFBEB" borderRadius={16} borderWidth={1} borderColor="#FDE68A" padding={[14, 14]}>
                  <Row gap={8} align="center">
                    <Ionicons name="hourglass" size={20} color="#B45309" />
                    <Txt size={13} weight="900" color="#92400E">Pending Resident KYC ({pendingKyc.length})</Txt>
                  </Row>
                  <Spacer size={10} />
                  {pendingKyc.map((g) => (
                    <Card key={g.id} containerColor={Colors.surface} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 12]} style={{ marginBottom: 8 }}>
                      <Row justify="space-between" align="center">
                        <Col style={{ flex: 1 }}>
                          <Txt size={13} weight="800" color={Colors.textPrimary}>{g.name}</Txt>
                          <Txt size={11} color={Colors.textMuted}>Room {g.roomNo} • ID: {g.idProofType}</Txt>
                          {g.idProofNumber ? <Txt size={10} color={Colors.textMuted}>No: {g.idProofNumber}</Txt> : null}
                        </Col>
                        <Btn onPress={() => setReviewing(g)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={8} height={32} contentStyle={{ paddingHorizontal: 10 }}>
                          <Txt size={11} weight="800" color={Colors.primaryDark}>Review Docs</Txt>
                        </Btn>
                      </Row>
                      <Spacer size={8} />
                      <Row gap={8}>
                        <Btn onPress={() => handleApprove(g)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={8} height={34} style={{ flex: 1 }}>
                          <Txt size={11} weight="800" color={Colors.textInverse}>✅ Approve</Txt>
                        </Btn>
                        <Btn onPress={() => setRejecting(g)} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={8} height={34} style={{ flex: 1 }}>
                          <Txt size={11} weight="800" color={Colors.textInverse}>❌ Reject</Txt>
                        </Btn>
                      </Row>
                    </Card>
                  ))}
                </Card>
              )}

              <Row justify="space-between" align="center">
                <Txt size={14} weight="900" color={Colors.textPrimary}>Registered Residents</Txt>
                <View style={styles.countBadge}>
                  <Txt size={11} weight="800" color={Colors.primaryDark}>{guests.length} Guests</Txt>
                </View>
              </Row>

              {!isManager && (
                <TouchableOpacity onPress={() => setShowEditProperty(true)} activeOpacity={0.7}>
                  <Row gap={6} align="center">
                    <Ionicons name="bed-outline" size={14} color={Colors.textMuted} />
                    <Txt size={11} color={Colors.textMuted}>{owner?.totalBeds ?? 0} total beds</Txt>
                    <Txt size={11} weight="800" color={Colors.primary}>Edit ›</Txt>
                  </Row>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No residents registered yet"
              subtitle="Add one on the Add Guest tab or share your lobby Join Code so residents can self-register. Pull down to refresh."
              accent={Colors.primary}
            />
          }
          renderItem={({ item: g }) => {
            const kyc = KYC_STYLE[g.kycStatus] ?? KYC_STYLE.DEFAULT;
            return (
              <AnimatedPress scale={0.985} hapticPattern="light" onPress={() => openDetail(g)}>
                <Card containerColor={Colors.surface} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
                  <Row justify="space-between" align="center">
                    <Row gap={12} style={{ flex: 1 }}>
                      <View style={styles.avatar}>
                        <Txt size={17} weight="900" color={Colors.primaryDark}>{g.name.charAt(0).toUpperCase()}</Txt>
                      </View>
                      <Col style={{ flex: 1 }}>
                        <Txt size={14} weight="800" color={Colors.textPrimary}>{g.name}</Txt>
                        <Txt size={11} color={Colors.textMuted}>Room {g.roomNo} • {g.email}</Txt>
                        <Txt size={11} weight="700" color={Colors.primaryDark}>₹{Math.round(g.rentAmount)}/mo</Txt>
                        <Row gap={6} style={{ marginTop: 4 }}>
                          <View style={[styles.pill, { backgroundColor: kyc.bg, borderColor: kyc.border }]}>
                            <Txt size={9} weight="800" color={kyc.text}>{kyc.label}</Txt>
                          </View>
                          <View style={[styles.pill, { backgroundColor: g.isBillPaid ? '#ECFDF5' : '#FFFBEB', borderColor: g.isBillPaid ? '#A7F3D0' : '#FDE68A' }]}>
                            <Txt size={9} weight="800" color={g.isBillPaid ? '#047857' : '#B45309'}>{g.isBillPaid ? '💵 Paid' : '⏳ Due'}</Txt>
                          </View>
                        </Row>
                      </Col>
                    </Row>
                    <Row gap={2}>
                      <IconBtn onPress={() => openEdit(g)} icon="create-outline" size={19} tint={Colors.primary} testID={`owner_edit_guest_${g.id}`} />
                      <IconBtn onPress={() => confirmDeleteGuest(g)} icon="trash-outline" size={19} tint={Colors.danger} />
                    </Row>
                  </Row>
                </Card>
              </AnimatedPress>
            );
          }}
        />
      )}

      {showEditProperty && owner && (
        <EditPgPropertyDialog pg={owner} onDismiss={() => setShowEditProperty(false)} />
      )}

      {/* Resident Detail Bottom Sheet — surfaces full profile, room info, KYC
          photos, payment status, and quick actions in one place. */}
      <DetailBottomSheet
        visible={detailGuest != null}
        title={detailGuest?.name ?? 'Resident'}
        subtitle={`Room ${detailGuest?.roomNo ?? ''} • ${detailGuest?.email ?? ''}`}
        icon="person-circle"
        accent={Colors.primary}
        onDismiss={() => setDetailGuest(null)}
        footer={
          detailGuest ? (
            <Row gap={8}>
              <Btn onPress={() => { openEdit(detailGuest); setDetailGuest(null); }} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Ionicons name="create" size={16} color={Colors.textInverse} />
                <Txt size={12} weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>Edit</Txt>
              </Btn>
              {detailGuest.kycStatus === 'PENDING' && (
                <Btn onPress={() => { setReviewing(detailGuest); setDetailGuest(null); }} containerColor="#D97706" textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.textInverse} />
                  <Txt size={12} weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>Review KYC</Txt>
                </Btn>
              )}
              <Btn onPress={() => { confirmDeleteGuest(detailGuest); setDetailGuest(null); }} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Ionicons name="trash" size={16} color={Colors.textInverse} />
                <Txt size={12} weight="800" color={Colors.textInverse} style={{ marginLeft: 6 }}>Delete</Txt>
              </Btn>
            </Row>
          ) : null
        }
      >
        {detailGuest && (
          <View>
            <Card containerColor={Colors.surfaceElevated} borderRadius={12} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
              <Row align="center" gap={12}>
                <View style={[styles.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
                  <Txt size={22} weight="900" color={Colors.primaryDark}>{detailGuest.name.charAt(0).toUpperCase()}</Txt>
                </View>
                <Col style={{ flex: 1 }}>
                  <Txt size={16} weight="800" color={Colors.textPrimary}>{detailGuest.name}</Txt>
                  <Txt size={11} color={Colors.textMuted}>Resident ID: {detailGuest.id}</Txt>
                  <Txt size={11} color={Colors.textMuted}>Joined {formatDateTime(detailGuest.registrationDate)}</Txt>
                </Col>
              </Row>
            </Card>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1 }}>ROOM & CONTACT</Txt>
            <Spacer size={6} />
            <View style={styles.detailRow}>
              <Ionicons name="home" size={14} color={Colors.textMuted} />
              <Txt size={12} color={Colors.textPrimary}>Room {detailGuest.roomNo}</Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={14} color={Colors.textMuted} />
              <Txt size={12} color={Colors.textPrimary}>{detailGuest.phone || '—'}</Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="mail" size={14} color={Colors.textMuted} />
              <Txt size={12} color={Colors.textPrimary}>{detailGuest.email}</Txt>
            </View>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1 }}>PAYMENT STATUS</Txt>
            <Spacer size={6} />
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={14} color="#059669" />
              <Txt size={12} color={Colors.textPrimary}>Monthly Rent: ₹{Math.round(detailGuest.rentAmount)}</Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name={detailGuest.isBillPaid ? 'checkmark-circle' : 'alert-circle'} size={14} color={detailGuest.isBillPaid ? '#059669' : '#B45309'} />
              <Txt size={12} color={detailGuest.isBillPaid ? '#059669' : '#B45309'}>
                {detailGuest.isBillPaid ? 'Rent paid this cycle' : 'Rent pending for this cycle'}
              </Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="star" size={14} color="#D97706" />
              <Txt size={12} color={Colors.textPrimary}>Reward points: {detailGuest.rewardPoints}</Txt>
            </View>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1 }}>KYC VERIFICATION</Txt>
            <Spacer size={6} />
            <View style={styles.detailRow}>
              <Ionicons name="shield-checkmark" size={14} color={
                detailGuest.kycStatus === 'VERIFIED' ? '#059669' :
                detailGuest.kycStatus === 'PENDING' ? '#B45309' :
                detailGuest.kycStatus === 'REJECTED' ? Colors.danger : Colors.textMuted
              } />
              <Txt size={12} color={Colors.textPrimary}>Status: {detailGuest.kycStatus}</Txt>
            </View>
            {detailGuest.idProofType ? (
              <View style={styles.detailRow}>
                <Ionicons name="card" size={14} color={Colors.textMuted} />
                <Txt size={12} color={Colors.textPrimary}>ID: {detailGuest.idProofType} {detailGuest.idProofNumber ? `• ${detailGuest.idProofNumber}` : ''}</Txt>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Ionicons name="camera" size={14} color={detailGuest.profilePhotoUri ? '#059669' : Colors.textMuted} />
              <Txt size={12} color={detailGuest.profilePhotoUri ? '#059669' : Colors.textMuted}>
                {detailGuest.profilePhotoUri ? 'Profile photo on file' : 'No profile photo'}
              </Txt>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="document-text" size={14} color={detailGuest.idProofPhotoUri ? '#059669' : Colors.textMuted} />
              <Txt size={12} color={detailGuest.idProofPhotoUri ? '#059669' : Colors.textMuted}>
                {detailGuest.idProofPhotoUri ? 'ID document photo on file' : 'No ID document photo'}
              </Txt>
            </View>
            {detailGuest.kycRejectReason ? (
              <View style={styles.rejectReasonBox}>
                <Ionicons name="warning" size={14} color={Colors.danger} />
                <Txt size={11} color="#B91C1C" style={{ flex: 1 }}>Rejection reason: {detailGuest.kycRejectReason}</Txt>
              </View>
            ) : null}
          </View>
        )}
      </DetailBottomSheet>

      {/* Edit dialog */}
      <Modal visible={editing != null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ width: '92%' }}>
            <Txt size={16} weight="800" color={Colors.textPrimary}>Edit Resident Profile & Monthly Fee</Txt>
            <Spacer size={12} />
            <OutlinedTextField label="Resident Full Name *" value={editName} onChangeText={setEditName} containerColor={Colors.surfaceMuted} testID="edit_guest_name_input" style={{ marginBottom: 8 }} />
            <OutlinedTextField label="Room No *" value={editRoom} onChangeText={setEditRoom} containerColor={Colors.surfaceMuted} testID="edit_guest_room_input" style={{ marginBottom: 8 }} />
            <OutlinedTextField label="Monthly Rent Fee (₹) *" value={editRent} onChangeText={setEditRent} keyboardType="number-pad" containerColor={Colors.surfaceMuted} testID="edit_guest_rent_input" style={{ marginBottom: 8 }} />
            <OutlinedTextField label="Phone Number" value={editPhone} onChangeText={setEditPhone} containerColor={Colors.surfaceMuted} testID="edit_guest_phone_input" style={{ marginBottom: 8 }} />
            <OutlinedTextField label="Email Address *" value={editEmail} onChangeText={setEditEmail} containerColor={Colors.surfaceMuted} testID="edit_guest_email_input" style={{ marginBottom: 8 }} />
            {/* Blank leaves their password alone. Filling it in is a reset: it signs them out
                everywhere and they choose their own on the next login. */}
            <Row gap={8}>
              <Btn onPress={handleUpdate} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt size={13} weight="800" color={Colors.textInverse}>Save Changes</Txt>
              </Btn>
              <OutlinedBtn onPress={() => setEditing(null)} borderColor={Colors.borderSubtle} textColor={Colors.textPrimary} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt size={13} weight="800" color={Colors.textPrimary}>Cancel</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </View>
      </Modal>

      {/* Review KYC dialog */}
      <Modal visible={reviewing != null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '92%' }}>
            <Row justify="space-between" align="center">
              <Txt size={16} weight="800" color={Colors.textPrimary}>Resident KYC Document Review</Txt>
              <IconBtn onPress={() => setReviewing(null)} icon="close" size={20} tint={Colors.textMuted} />
            </Row>
            <Spacer size={12} />
            {reviewing && (
              <Col>
                <Txt size={14} weight="800" color={Colors.textPrimary}>Resident: {reviewing.name} (Room {reviewing.roomNo})</Txt>
                <Txt size={11} color={Colors.textMuted}>Email: {reviewing.email} • Phone: {reviewing.phone}</Txt>
                <Spacer size={16} />
                <Txt size={12} weight="800" color={Colors.primaryDark}>ID Document: {reviewing.idProofType}</Txt>
                <Txt size={13} weight="700" color={Colors.textPrimary}>ID Number: {reviewing.idProofNumber || 'Not provided'}</Txt>
                <Spacer size={12} />
                <Txt size={12} weight="700" color={Colors.textMuted}>Profile Photo / Selfie</Txt>
                <View style={styles.photoBox}>
                  {reviewing.profilePhotoUri ? (
                    <Txt size={12} color={Colors.primaryDark}>📷 Photo on file</Txt>
                  ) : (
                    <Txt size={12} color={Colors.textMuted}>No Selfie Provided</Txt>
                  )}
                </View>
                <Spacer size={12} />
                <Txt size={12} weight="700" color={Colors.textMuted}>Document Front Scan / Photo</Txt>
                <View style={styles.photoBox}>
                  {reviewing.idProofPhotoUri ? (
                    <Txt size={12} color={Colors.primaryDark}>📷 Document on file</Txt>
                  ) : (
                    <Txt size={12} color={Colors.textMuted}>No Document Image Provided</Txt>
                  )}
                </View>
                <Spacer size={20} />
                <Row gap={8}>
                  <Btn onPress={() => handleApprove(reviewing)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                    <Txt size={12} weight="800" color={Colors.textInverse}>Approve KYC</Txt>
                  </Btn>
                  <Btn onPress={() => { setRejecting(reviewing); setReviewing(null); }} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                    <Txt size={12} weight="800" color={Colors.textInverse}>Reject KYC</Txt>
                  </Btn>
                </Row>
              </Col>
            )}
          </Card>
        </View>
      </Modal>

      {/* Reject reason dialog */}
      <Modal visible={rejecting != null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ width: '92%' }}>
            <Txt size={16} weight="800" color={Colors.danger}>Reject KYC for {rejecting?.name}</Txt>
            <Spacer size={12} />
            <Txt size={12} color={Colors.textMuted}>Provide a reason so the resident can re-upload clear documents:</Txt>
            <Spacer size={8} />
            <OutlinedTextField
              label="Rejection Reason"
              placeholder="ID photo blurry or ID number mismatch"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              containerColor={Colors.surfaceMuted}
              testID="owner_kyc_reject_reason_input"
              style={{ marginBottom: 16 }}
            />
            <Row gap={8}>
              <Btn onPress={handleReject} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt size={13} weight="800" color={Colors.textInverse}>Reject & Notify</Txt>
              </Btn>
              <OutlinedBtn onPress={() => setRejecting(null)} borderColor={Colors.borderSubtle} textColor={Colors.textPrimary} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt size={13} weight="800" color={Colors.textPrimary}>Cancel</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: 4,
    gap: 4,
  },
  subTab: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    flex: 1, height: 1, backgroundColor: Colors.borderSubtle,
  },
  countBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, backgroundColor: '#F0FDF9',
    borderWidth: 1, borderColor: '#CCFBF1',
  },
  roomGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  roomChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoBox: {
    height: 150, backgroundColor: Colors.surfaceMuted,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rejectReasonBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginTop: 4,
  },
});
