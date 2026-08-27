/**
 * Guest/Resident tabs shell — the chrome shared by every tab: the header (avatar, greeting,
 * rent-status pill, notification bell, logout) and the pill dock at the bottom. Tab-specific
 * state (e.g. the Home tab's KYC upload dialog) lives in that tab's own route file.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { TabHeader } from '@/components/TabHeader';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSuccess } from '@/utils/haptics';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore } from '@/store/authStore';

export default function GuestTabsLayout() {
  const [showProfilePhotoDialog, setShowProfilePhotoDialog] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const user = useAuthStore((s) => s.user);
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const logout = usePGowStore((s) => s.logout);
  const updateProfilePhoto = usePGowStore((s) => s.updateGuestProfilePhoto);

  /**
   * `updateGuestProfilePhoto` does a real avatar upload (presigned PUT then PATCH /v1/me),
   * but these buttons used to hand it a literal `sample:selfie_preset_3` string and pop
   * "Success". Nothing was ever uploaded. Same stub pattern as the KYC dialog had.
   */
  const pickPhoto = async (from: 'camera' | 'library') => {
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        from === 'camera' ? 'Camera permission required' : 'Photo permission required',
        `Allow ${from === 'camera' ? 'camera' : 'photo library'} access in your device settings to continue.`,
      );
      return;
    }
    const result = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    updateProfilePhoto(uri);
    setShowProfilePhotoDialog(false);
  };

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const { dockStyle, contentPaddingBottom } = useDock();

  // Prefer the guest entity's room, fall back to the membership's `room_no` from /v1/me —
  // that resolves first on a cold start, so the header shows a real room instead of "N/A"
  // until the rest lands.
  const membershipRoomNo = activePgId
    ? user?.memberships.find((m) => m.pg_id === activePgId)?.room_no ?? null
    : null;
  const roomNo = guest?.roomNo || membershipRoomNo || 'N/A';

  return (
    <Tabs style={styles.root}>
      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        {/* ── Header — own surface, separate from the scrollable body below ── */}
        <TabHeader
          leading={
            <AnimatedPress scale={0.9} hapticPattern="light" accessibilityLabel="Change profile photo"
              onPress={() => setShowProfilePhotoDialog(true)}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  {guest?.profilePhotoUri ? (
                    <Image source={{ uri: guest.profilePhotoUri }} style={styles.avatarImg} />
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
              <AnimatedPress scale={0.85} hapticPattern="light" accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                onPress={() => router.push({ pathname: '/notifications', params: { role: 'RESIDENT' } })}>
                <View style={styles.bellBtn}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
                  {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
              </AnimatedPress>
              <AnimatedPress scale={0.85} hapticPattern="medium" accessibilityLabel="Log out"
                onPress={() => { hapticSuccess(); logout(); }}>
                <View style={styles.bellBtn}>
                  <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                </View>
              </AnimatedPress>
            </>
          }
        >
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Row gap={6} align="center">
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <Txt size={20} weight="700" color={Colors.textPrimary} numberOfLines={1}>Hello, {guest?.name ?? 'Guest'}</Txt>
            </Row>
            {/* The rent pill used to sit here as a third stacked line, wedged between the
                greeting and two icon buttons — and it was the one thing in this header a
                resident might want to ACT on, with nothing to tap. It now lives on the Home
                tab beside the KYC banner, same shape, and opens Payments.

                `roomNo` rather than `guest?.roomNo ?? 'N/A'`: the membership from /v1/me
                carries room_no and resolves first, so the room shows immediately instead of
                reading "N/A" until the guest entity lands. */}
            <Txt size={12} weight="500" color={Colors.textMuted} style={{ marginTop: 1 }}>
              Room {roomNo} • Premium Resident
            </Txt>
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
        <TabTrigger name="profile" href="/profile" asChild>
          <HeadlessDockTabButton icon="ribbon" label="Profile" />
        </TabTrigger>
      </Dock>

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
                {guest?.profilePhotoUri
                  ? <Image source={{ uri: guest.profilePhotoUri }} style={styles.photoPreviewImg} />
                  : <Ionicons name="person" size={50} color={Colors.textMuted} />}
              </View>
              <Txt size={12} color={Colors.textMuted}>{guest?.profilePhotoUri ? 'Current Profile Photo' : 'No profile photo set yet'}</Txt>
            </Col>
            <Spacer size={18} />
            <Btn onPress={() => pickPhoto('camera')} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={12} height={44} testID="take_camera_photo_btn">
              <Ionicons name="camera" size={18} color={Colors.textInverse} /><Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>Take Photo (Camera)</Txt>
            </Btn>
            <Spacer size={8} />
            <OutlinedBtn onPress={() => pickPhoto('library')} borderColor={Colors.primary} textColor={Colors.primary} borderRadius={12} height={44} testID="choose_gallery_photo_btn">
              <Ionicons name="images" size={18} color={Colors.primary} /><Txt size={13} weight="700" color={Colors.primary} style={{ marginLeft: 8 }}>Choose from Gallery</Txt>
            </OutlinedBtn>
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
  bellBtn: {
    width: 38, height: 38, borderRadius: 19,
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
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  photoPreviewImg: { width: 84, height: 84, borderRadius: 42 },
});
