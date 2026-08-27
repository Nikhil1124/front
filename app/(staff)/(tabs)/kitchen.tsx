/** Chef dashboard "Kitchen" tab or Delivery Agent Profile */
import { useEffect, useState } from 'react';
import { Alert, View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, Btn, Row, Spacer, Col } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { Ionicons } from '@expo/vector-icons';

const ANNOUNCEMENTS = [
  'Special Dessert today! 🍨',
  'Serving started! Come get hot portions! 🍽️',
  'Delay of 10 mins due to prep ⏰',
  'Limited portions available. Hurry! 🏃‍♂️',
  'Chai is ready in the dining area! ☕',
];

export default function ChefKitchenTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryProfileRoute />;
  return <ChefKitchenView />;
}

function ChefKitchenView() {
  const [prepState, setPrepState] = useState('PREPPING');
  const [chefBroadcast, setChefBroadcast] = useState('');
  const sendRoleNotification = usePGowStore((s) => s.sendRoleNotification);
  const { activeMeal } = useActiveMeal();

  useEffect(() => {
    setPrepState('PREPPING');
  }, [activeMeal?.id]);

  const broadcastToResidents = async (title: string, body: string) => {
    const ok = await sendRoleNotification('RESIDENT', title, body, 'ANNOUNCEMENT', 'HIGH');
    if (!ok) Alert.alert('Not sent', 'The broadcast did not go out. Check your connection and try again.');
    return ok;
  };

  const sendCustomAnnouncement = async () => {
    if (!chefBroadcast.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please enter or select a message to send.');
      return;
    }
    const ok = await broadcastToResidents('🍳 Kitchen Update', chefBroadcast.trim());
    if (!ok) return;
    hapticSuccess();
    setChefBroadcast('');
    Alert.alert('Success', '🔔 Announcement sent to all residents!');
  };

  return (
    <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
      <ChefGroceriesShortcut />

      <Txt size={15} weight="900" color={Colors.textPrimary}>Kitchen Preparation Status</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <Row gap={8}>
          {['PREPPING 🥕', 'COOKING 🔥', 'READY 🍽️'].map((s) => {
            const sel = prepState === s.split(' ')[0];
            return (
              <Btn key={s} onPress={() => setPrepState(s.split(' ')[0])} containerColor={sel ? Colors.primary : Colors.surfaceMuted} textColor={sel ? '#FFFFFF' : Colors.textSecondary} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt size={11} weight="800" color={sel ? '#FFFFFF' : Colors.textSecondary}>{s}</Txt>
              </Btn>
            );
          })}
        </Row>
        {prepState === 'READY' && (
          <>
            <Spacer size={14} />
            <Btn onPress={async () => { if (await broadcastToResidents('🍽️ Meal is Served', 'Meal is ready! Please come collect your hot portions!')) Alert.alert('Success', '🔔 Alert dispatched to all residents!'); }} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={44}>
              <Txt size={12} weight="800" color="#FFFFFF">Broadcast 'Meal is Served' to Residents 📢</Txt>
            </Btn>
          </>
        )}
      </Card>

      <Spacer size={18} />
      <Txt size={15} weight="900" color={Colors.textPrimary}>Broadcast Custom Message to Residents</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <OutlinedTextField placeholder="Type custom kitchen update..." value={chefBroadcast} onChangeText={setChefBroadcast} focusedBorderColor={Colors.primary} multiline numberOfLines={3} style={{ marginBottom: 10 }} />
        <Txt size={10} weight="700" color={Colors.textMuted}>Tap to quick-populate template:</Txt>
        <Spacer size={6} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ANNOUNCEMENTS.map((msg) => (
            <Btn key={msg} onPress={() => setChefBroadcast(msg)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={8} height={30} contentStyle={{ paddingHorizontal: 10 }}>
              <Txt size={10} weight="800" color={Colors.primaryDark}>{msg}</Txt>
            </Btn>
          ))}
        </FormScroll>
        <Spacer size={14} />
        <Btn onPress={sendCustomAnnouncement} disabled={!chefBroadcast.trim()} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={42}>
          <Txt size={12} weight="800" color="#FFFFFF">Send Announcement to Residents 🚀</Txt>
        </Btn>
      </Card>
    </FormScroll>
  );
}

import { useMyTripsQuery } from '@/features/staff/useTrips';

function DeliveryProfileRoute() {
  const staff = usePGowStore((s) => s.loggedInStaff);
  const logout = usePGowStore((s) => s.logout);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { data: realTrips = [] } = useMyTripsQuery();
  
  const activeTrip = realTrips.find(t => t.status === 'active' || t.status === 'planned') ?? realTrips[0];
  const vehicle = activeTrip?.vehicle_label ?? 'KA-01-AB-1234 (Scooter)';

  return (
    <View style={styles.root}>
      <FormScroll bottomPadding={120} contentContainerStyle={{ padding: 18, gap: 16 }}>
        <Col align="center" style={{ marginTop: 20 }}>
          <View style={styles.avatarBox}>
            <Txt size={32}>👨‍✈️</Txt>
          </View>
          <Spacer size={12} />
          <Txt size={22} weight="900" color={Colors.primaryDark}>{staff?.name ?? 'Name unavailable'}</Txt>
          <Txt size={14} weight="700" color={Colors.primary}>Delivery Agent</Txt>
          <Spacer size={4} />
          <Txt size={12} color={Colors.textMuted}>Employee ID: DA-{staff?.id ? staff.id.slice(0, 4) : '1001'}</Txt>
        </Col>

        <Spacer size={20} />
        <View style={styles.sectionHeader}>
          <Txt size={13} weight="900" color={Colors.textSecondary}>STATUS & CONTACT</Txt>
        </View>
        <Card containerColor={Colors.surface} borderRadius={Radii.xl} borderWidth={1} borderColor={Colors.borderSubtle}>
          <Row justify="space-between" align="center" style={styles.profileRow}>
            <Row gap={12} align="center">
              <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="radio-button-on" size={18} color={Colors.success} /></View>
              <Txt size={14} weight="800" color={Colors.textPrimary}>Availability</Txt>
            </Row>
            <Txt size={14} weight="800" color={Colors.success}>Available</Txt>
          </Row>
          <View style={styles.divider} />
          <Row justify="space-between" align="center" style={styles.profileRow}>
            <Row gap={12} align="center">
              <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="call" size={18} color={Colors.textPrimary} /></View>
              <Txt size={14} weight="800" color={Colors.textPrimary}>Phone</Txt>
            </Row>
            <Txt size={14} weight="700" color={Colors.textMuted}>{staff?.phone ?? '+91 98765 43210'}</Txt>
          </Row>
          <View style={styles.divider} />
          <Row justify="space-between" align="center" style={styles.profileRow}>
            <Row gap={12} align="center">
              <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="bicycle" size={18} color={Colors.textPrimary} /></View>
              <Txt size={14} weight="800" color={Colors.textPrimary}>Vehicle</Txt>
            </Row>
            <Txt size={14} weight="700" color={Colors.textMuted}>{vehicle}</Txt>
          </Row>
        </Card>

        <Spacer size={16} />
        <Btn onPress={() => setShowLogoutConfirm(true)} containerColor={Colors.danger} textColor="#FFF" borderRadius={Radii.lg} height={50}>
          <Ionicons name="exit" size={20} color="#FFF" />
          <Txt size={14} weight="900" style={{ marginLeft: 8 }}>Sign Out</Txt>
        </Btn>
      </FormScroll>

      <Modal transparent visible={showLogoutConfirm} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
            <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="log-out" size={24} color={Colors.danger} />
              </View>
              <TouchableOpacity onPress={() => setShowLogoutConfirm(false)} activeOpacity={0.8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </Row>
            <Txt size={20} weight="900" color={Colors.primaryDark}>Sign Out?</Txt>
            <Spacer size={8} />
            <Txt size={14} color={Colors.textMuted} style={{ lineHeight: 20 }}>
              Are you sure you want to sign out of your account?
            </Txt>
            <Spacer size={24} />
            <Row gap={12}>
              <TouchableOpacity onPress={() => setShowLogoutConfirm(false)} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={15} weight="800" color={Colors.textPrimary}>Cancel</Txt>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowLogoutConfirm(false); logout(); router.replace('/'); }} activeOpacity={0.8} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={15} weight="800" color="#FFF">Sign Out</Txt>
              </TouchableOpacity>
            </Row>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  avatarBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  profileRow: { padding: 16 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },
  iconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
