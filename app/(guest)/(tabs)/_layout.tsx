/**
 * Guest/Resident tabs shell — the chrome shared by every tab: the header (avatar, greeting,
 * rent-status pill, notification bell, logout) and the pill dock at the bottom. Tab-specific
 * state (e.g. the Home tab's KYC upload dialog) lives in that tab's own route file.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { TabHeader } from '@/components/TabHeader';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSuccess } from '@/utils/haptics';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';

import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore } from '@/store/authStore';

export default function GuestTabsLayout() {
  const [showNotif, setShowNotif] = useState(false);
  const [showProfilePhotoDialog, setShowProfilePhotoDialog] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const logout = usePGowStore((s) => s.logout);
  const updateProfilePhoto = usePGowStore((s) => s.updateGuestProfilePhoto);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const paid = guest?.isBillPaid ?? false;
  const { dockStyle, contentPaddingBottom } = useDock();

  return (
    <Tabs style={styles.root}>
      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        {/* ── Header — own surface, separate from the scrollable body below ── */}
        <TabHeader
          leading={
            <AnimatedPress scale={0.9} hapticPattern="light" onPress={() => setShowProfilePhotoDialog(true)}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  {guest?.profilePhotoUri ? (
                    <Txt variant="caption">📷</Txt>
                  ) : (
                    <Ionicons name="person" size={28} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.cameraBadge}><Ionicons name="camera" size={10} color={Colors.primaryDark} /></View>
              </View>
            </AnimatedPress>
          }
          actions={
            <>
              <AnimatedPress scale={0.85} hapticPattern="light" onPress={() => setShowNotif(true)}>
                <View style={styles.bellBtn}>
                  <Ionicons name="notifications" size={18} color={Colors.primary} />
                  {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
              </AnimatedPress>
              <AnimatedPress scale={0.85} hapticPattern="medium" onPress={() => { hapticSuccess(); logout(); }}>
                <View style={styles.bellBtn}>
                  <Ionicons name="exit" size={18} color={Colors.danger} />
                </View>
              </AnimatedPress>
            </>
          }
        >
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Row gap={6} align="center">
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <Txt size={18} weight="800" color={Colors.primaryDark} numberOfLines={1}>Hello, {guest?.name ?? 'Guest'}</Txt>
            </Row>
            <Txt size={11} weight="600" color={Colors.textMuted} style={{ marginTop: 1 }}>
              Room {guest?.roomNo ?? 'N/A'} • Premium Resident
            </Txt>
            <View style={[styles.billPill, { backgroundColor: paid ? '#ECFDF5' : '#FFFBEB', borderWidth: 1, borderColor: paid ? '#A7F3D0' : '#FDE68A' }]}>
              <Ionicons name={paid ? 'checkmark-circle' : 'information-circle'} size={11} color={paid ? '#059669' : '#B45309'} />
              <Txt size={10} weight="800" color={paid ? '#047857' : '#B45309'} style={{ marginLeft: 4 }}>
                {paid ? 'Rent Paid' : 'Rent Pending'}
              </Txt>
            </View>
          </Col>
        </TabHeader>

        {/* ── Active tab content ─────────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <TabSlot />
        </View>
      </View>

      {/* Sticky bottom dock — see Dock/useDock in HeadlessDockTabButton.tsx */}
      <Dock style={dockStyle}>
        <TabTrigger name="home" href="/home" asChild>
          <HeadlessDockTabButton icon="home" label="Home" />
        </TabTrigger>
        <TabTrigger name="meals" href="/meals" asChild>
          <HeadlessDockTabButton icon="restaurant" label="Meals" />
        </TabTrigger>
        <TabTrigger name="guest-payments" href="/guest-payments" asChild>
          <HeadlessDockTabButton icon="card" label="Payments" />
        </TabTrigger>
        <TabTrigger name="support" href="/support" asChild>
          <HeadlessDockTabButton icon="chatbubble-ellipses" label="Support" />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <HeadlessDockTabButton icon="ribbon" label="Profile" />
        </TabTrigger>
      </Dock>

      {showNotif && <RoleNotificationsCenterSheet roleTitle="RESIDENT" onDismiss={() => setShowNotif(false)} />}

      {/* Profile photo dialog */}
      <Modal visible={showProfilePhotoDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '92%' }}>
            <Row align="center" gap={8}>
              <Ionicons name="camera" size={22} color={Colors.primary} />
              <Txt size={18} weight="800" color={Colors.textPrimary}>Personalize Profile Photo</Txt>
            </Row>
            <Spacer size={18} />
            <Col align="center">
              <View style={styles.photoPreview}>
                {guest?.profilePhotoUri ? <Txt>📷</Txt> : <Ionicons name="person" size={50} color={Colors.textMuted} />}
              </View>
              <Txt size={12} color={Colors.textMuted}>{guest?.profilePhotoUri ? 'Current Profile Photo' : 'No profile photo set yet'}</Txt>
            </Col>
            <Spacer size={18} />
            <Btn onPress={() => { updateProfilePhoto(`sample:selfie_preset_${Math.floor(Math.random() * 5) + 1}`); Alert.alert('Success', 'Sample selfie selected!'); setShowProfilePhotoDialog(false); }} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={44} testID="take_camera_photo_btn">
              <Ionicons name="camera" size={18} color={Colors.textInverse} /><Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>Take Photo (Camera)</Txt>
            </Btn>
            <Spacer size={8} />
            <OutlinedBtn onPress={() => { updateProfilePhoto(`sample:selfie_preset_${Math.floor(Math.random() * 5) + 1}`); Alert.alert('Success', 'Sample photo loaded!'); setShowProfilePhotoDialog(false); }} borderColor={Colors.primary} textColor={Colors.primary} borderRadius={12} height={44} testID="choose_gallery_photo_btn">
              <Ionicons name="images" size={18} color={Colors.primary} /><Txt size={13} weight="700" color={Colors.primary} style={{ marginLeft: 8 }}>Choose from Gallery</Txt>
            </OutlinedBtn>
            <Spacer size={12} /><View style={{ height: 1, backgroundColor: Colors.borderMuted }} /><Spacer size={12} />
            <Txt size={12} weight="700" color={Colors.textPrimary}>Or select a Preset Avatar:</Txt>
            <Spacer size={8} />
            <Row gap={8} justify="space-between">
              {[1, 2, 3, 4, 5].map((i) => (
                <AnimatedPress key={i} scale={0.9} onPress={() => { updateProfilePhoto(`sample:avatar_preset_${i}`); Alert.alert('Success', `Avatar ${i} selected!`); setShowProfilePhotoDialog(false); }} style={styles.presetAvatar}>
                  <Ionicons name="happy" size={24} color={Colors.primary} />
                </AnimatedPress>
              ))}
            </Row>
            {guest?.profilePhotoUri ? (
              <>
                <Spacer size={12} />
                <AnimatedPress scale={0.95} onPress={() => { updateProfilePhoto(''); Alert.alert('Removed', 'Profile photo removed'); setShowProfilePhotoDialog(false); }}>
                  <Txt size={12} weight="700" color={Colors.danger}>Remove Photo</Txt>
                </AnimatedPress>
              </>
            ) : null}
            <Spacer size={12} />
            <Row gap={8}>
              <Btn onPress={() => { setShowProfilePhotoDialog(false); router.push('/profile'); }} containerColor={Colors.primaryDark} textColor={Colors.textInverse} borderRadius={10} height={36} contentStyle={{ paddingHorizontal: 12 }}>
                <Ionicons name="ribbon" size={14} color={Colors.textInverse} /><Txt size={12} weight="700" color={Colors.textInverse} style={{ marginLeft: 4 }}>Profile & KYC</Txt>
              </Btn>
              <AnimatedPress scale={0.95} onPress={() => setShowProfilePhotoDialog(false)} style={{ padding: 8 }}><Txt size={12} color={Colors.textMuted}>Close</Txt></AnimatedPress>
            </Row>
          </Card>
        </View>
      </Modal>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  avatarWrap: { position: 'relative' },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  billPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    marginTop: 4, alignSelf: 'flex-start',
  },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center' },
  photoPreview: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 3, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  presetAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
});
