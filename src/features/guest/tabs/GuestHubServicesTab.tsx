/**
 * GuestHubServicesTab — Redesigned Services & Marketplace tab.
 * Visual System: Unified Luxury Emerald Palette (#0F5E4A / #173A33 / #F6F1E9 / #B8C4B2).
 */
import { useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useLaundryRequestsQuery } from '@/features/requests/useComplaints';
import { GuestLaundryBookingDialog } from '@/components/dialogs/HubDialogs';
import { hapticSelect } from '@/utils/haptics';

export function GuestHubServicesTab() {
  const insets = useSafeAreaInsets();
  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: laundryRequests = [] } = useLaundryRequestsQuery(activePgId ?? undefined);
  const [showLaundryDialog, setShowLaundryDialog] = useState(false);

  const myLaundry = laundryRequests.filter((r) => r.guestId === guest?.id);

  return (
    <View style={styles.root}>
      {/* ── 1. LUXURY EMERALD GRADIENT HEADER ── */}
      <LinearGradient
        colors={['#011C40', '#023859']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.hWave1} />
        <View style={styles.hWave2} />
        <Row justify="space-between" align="center" style={styles.hRow}>
          <Col>
            <Txt size={26} weight="900" color="#FFFFFF">Hub Services</Txt>
            <Txt size={13} weight="500" color="rgba(255,255,255,0.78)" style={{ marginTop: 2 }}>
              Laundry, Groceries & PG Conveniences
            </Txt>
          </Col>
          <View style={styles.badgeWrap}>
            <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
          </View>
        </Row>
      </LinearGradient>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {/* ── 2. EXPRESS LAUNDRY CARD ── */}
        <Card
          containerColor="#FFFFFF"
          borderRadius={20}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
          style={styles.laundryCard}
        >
          <Row justify="space-between" align="center">
            <Row gap={12} style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.laundryIconWrap}>
                <Txt size={22}>🧺</Txt>
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="900" color={Colors.textPrimary}>EXPRESS PG LAUNDRY</Txt>
                <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
                  Wash & Fold • Wash & Iron • Dry Cleaning
                </Txt>
              </Col>
            </Row>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => { hapticSelect(); setShowLaundryDialog(true); }}
              style={styles.bookBtn}
            >
              <Txt size={11} weight="800" color="#FFFFFF">Book Pickup</Txt>
            </TouchableOpacity>
          </Row>

          {myLaundry.length > 0 && (
            <>
              <Spacer size={14} />
              <View style={{ height: 1, backgroundColor: '#F6F1E9' }} />
              <Spacer size={12} />
              <Txt size={12} weight="800" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                ACTIVE LAUNDRY ORDERS
              </Txt>
              <Spacer size={8} />
              {myLaundry.slice(0, 2).map((req) => (
                <View key={req.id} style={styles.laundryItem}>
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color={Colors.textPrimary}>{req.serviceType} • {req.weightOrCount}</Txt>
                    <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
                      Slot: {req.preferredSlot} • {req.paymentStatus}
                    </Txt>
                  </Col>
                  <View style={[styles.statusPill, { backgroundColor: req.status === 'Delivered' ? '#E0F2F0' : '#FEF3C7' }]}>
                    <Txt size={10} weight="800" color={req.status === 'Delivered' ? Colors.primary : '#D97706'}>
                      {req.status.toUpperCase()}
                    </Txt>
                  </View>
                </View>
              ))}
            </>
          )}
        </Card>

        {/* ── 3. HUB SERVICE GRID ── */}
        <Txt size={16} weight="800" color={Colors.textPrimary} style={{ marginTop: 22, marginBottom: 12 }}>
          PG Marketplace & Quick Amenities
        </Txt>
        <Row gap={12} style={{ flexWrap: 'wrap' }}>
          <HubServiceCard
            title="GROCERIES"
            desc="Essentials delivered to room"
            icon="cart-outline"
            statusText="Ready"
            buttonText="Order Now"
            onPress={() => router.push('/groceries')}
          />
          <HubServiceCard
            title="MAINTENANCE"
            desc="Book a technician"
            icon="build-outline"
            statusText="Repairs Due"
            buttonText="Log Issue"
            onPress={() => router.push('/book-technician')}
          />
          <HubServiceCard
            title="DEEP CLEANING"
            desc="Room sanitation"
            icon="sparkles-outline"
            statusText="Available"
            buttonText="Notify Me"
            onPress={() => Alert.alert('Not Available Yet', 'Deep cleaning bookings are coming soon.')}
          />
          <HubServiceCard
            title="WI-FI & INTERNET"
            desc="Bandwidth & plans"
            icon="wifi-outline"
            statusText="Active"
            buttonText="Manage"
            onPress={() => Alert.alert('Not Available Yet', 'Wi-Fi plan management is coming soon.')}
          />
        </Row>

        <Spacer size={16} />
        <Card containerColor="#FFFFFF" borderRadius={18} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
          <Row gap={10} align="center">
            <Txt size={20}>⚡</Txt>
            <Col style={{ flex: 1 }}>
              <Txt size={13} weight="800" color={Colors.textPrimary}>PGow Smart Hub Integrated</Txt>
              <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2, lineHeight: 15 }}>
                All services are synchronized directly with your PG landlord's main control panel.
              </Txt>
            </Col>
          </Row>
        </Card>

        <Spacer size={32} />
      </ScrollView>

      {showLaundryDialog && (
        <GuestLaundryBookingDialog
          guestId={guest?.id ?? ''}
          guestName={guest?.name ?? 'Resident'}
          roomNo={guest?.roomNo ?? '101'}
          onDismiss={() => setShowLaundryDialog(false)}
        />
      )}
    </View>
  );
}

function HubServiceCard({
  title, desc, icon, statusText, buttonText, onPress,
}: {
  title: string; desc: string; icon: keyof typeof Ionicons.glyphMap; statusText: string; buttonText: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => { hapticSelect(); onPress(); }}
      style={styles.gridCard}
    >
      <Row justify="space-between" align="center">
        <View style={styles.gridIconWrap}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.textPrimarySecondary} />
      </Row>
      <Spacer size={10} />
      <Txt size={13} weight="900" color={Colors.textPrimary}>{title}</Txt>
      <Txt size={10} color={Colors.textPrimarySecondary} style={{ marginTop: 2, height: 28 }} numberOfLines={2}>
        {desc}
      </Txt>
      <Spacer size={8} />
      <View style={styles.gridCardBtn}>
        <Txt size={10} weight="800" color="#FFFFFF">{buttonText}</Txt>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  // Header
  header: { overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  hRow: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 },
  hWave1: { position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  hWave2: { position: 'absolute', bottom: 10, right: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
  badgeWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Laundry Card
  laundryCard: {
    marginTop: -14, backgroundColor: '#FFFFFF',
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  laundryIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F6F1E9', alignItems: 'center', justifyContent: 'center' },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  laundryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  // Grid Card
  gridCard: {
    width: '48%', backgroundColor: '#FFFFFF', borderRadius: 18,
    borderWidth: 1, borderColor: Colors.borderSubtle, padding: 12,
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  gridIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F6F1E9', alignItems: 'center', justifyContent: 'center' },
  gridCardBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
});
