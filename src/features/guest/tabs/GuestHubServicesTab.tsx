/**
 * GuestHubServicesTab — Redesigned Services & Marketplace tab.
 * Visual System: Unified Luxury Emerald Palette (#0F5E4A / #173A33 / #F6F1E9 / #B8C4B2).
 */
import { ScrollView, View, StyleSheet, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useLaundryRequestsQuery } from '@/features/requests/useComplaints';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, Card, Col, Row, Spacer, Txt } from '@/components/ui';
export function GuestHubServicesTab() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const {
    data: laundryRequests = [],
    refetch: refetchLaundry,
    isRefetching: laundryRefetching } = useLaundryRequestsQuery(activePgId ?? undefined);

  const myLaundry = laundryRequests.filter((r) => r.guestId === guest?.id);

  return (
    <View style={styles.root}>
      {/* ── 1. LUXURY EMERALD GRADIENT HEADER ── */}
      <AppHeader
        title="Hub Services"
        subtitle="Laundry, Groceries & PG Conveniences"
      />

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // `bounces={false}` also kills the pull-to-refresh gesture on iOS, so the two have to
        // change together — a RefreshControl on a non-bouncing ScrollView never fires.
        refreshControl={
          <RefreshControl refreshing={laundryRefetching} onRefresh={refetchLaundry} tintColor={Colors.primary} />
        }
        overScrollMode="never"
      >
        {/* ── 2. EXPRESS LAUNDRY CARD ── */}
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.sheet}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
          style={styles.laundryCard}
        >
          <Row justify="space-between" align="center">
            <Row gap={12} style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.laundryIconWrap}>
                <Ionicons name="shirt-outline" size={21} color={Colors.primary} />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="700" color={Colors.textPrimary}>EXPRESS PG LAUNDRY</Txt>
                <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                  Wash & Fold • Wash & Iron • Dry Cleaning
                </Txt>
              </Col>
            </Row>

            <AnimatedPress accessibilityRole="button"
              onPress={() => { router.push('/laundry'); }}
              style={styles.bookBtn}
            >
              <Txt size={11} weight="700" color={Colors.textInverse}>Book Pickup</Txt>
            </AnimatedPress>
          </Row>

          {myLaundry.length > 0 && (
            <>
              <Spacer size={14} />
              <View style={{ height: 1, backgroundColor: '#F6F1E9' }} />
              <Spacer size={12} />
              <Txt size={12} weight="700" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                ACTIVE LAUNDRY ORDERS
              </Txt>
              <Spacer size={8} />
              {myLaundry.slice(0, 2).map((req) => (
                <View key={req.id} style={styles.laundryItem}>
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="700" color={Colors.textPrimary}>{req.serviceType} • {req.weightOrCount}</Txt>
                    <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                      Slot: {req.preferredSlot} • {req.paymentStatus}
                    </Txt>
                  </Col>
                  <View style={[styles.statusPill, { backgroundColor: req.status === 'Delivered' ? Palette.TintGreen : Palette.TintAmber }]}>
                    <Txt size={10} weight="700" color={req.status === 'Delivered' ? Colors.primary : Colors.warning}>
                      {req.status.toUpperCase()}
                    </Txt>
                  </View>
                </View>
              ))}
            </>
          )}
        </Card>

        {/* ── 3. HUB SERVICE GRID ── */}
        <Txt size={16} weight="700" color={Colors.textPrimary} style={{ marginTop: 22, marginBottom: 12 }}>
          PG Marketplace & Quick Amenities
        </Txt>
        <Row gap={12} style={{ flexWrap: 'wrap' }}>
          <HubServiceCard
            title="GROCERIES"
            desc="Essentials delivered to room"
            icon="basket"
            buttonText="Order Now"
            onPress={() => router.push('/groceries')}
          />
          <HubServiceCard
            title="MAINTENANCE"
            desc="Book a technician"
            icon="construct"
            buttonText="Log Issue"
            onPress={() => router.push('/book-technician')}
          />
          <HubServiceCard
            title="DEEP CLEANING"
            desc="Room sanitation"
            icon="sparkles"
            available={false}
            buttonText="Notify Me"
            onPress={() => Alert.alert('Not Available Yet', 'Deep cleaning bookings are coming soon.')}
          />
          <HubServiceCard
            title="WI-FI & INTERNET"
            desc="Bandwidth & plans"
            icon="wifi"
            available={false}
            buttonText="Manage"
            onPress={() => Alert.alert('Not Available Yet', 'Wi-Fi plan management is coming soon.')}
          />
        </Row>

        <Spacer size={16} />
        <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
          <Row gap={10} align="center">
            <Ionicons name="flash" size={19} color={Colors.warning} />
            <Col style={{ flex: 1 }}>
              <Txt size={13} weight="700" color={Colors.textPrimary}>PGow Smart Hub Integrated</Txt>
              <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2, lineHeight: 15 }}>
                All services are synchronized directly with your PG landlord's main control panel.
              </Txt>
            </Col>
          </Row>
        </Card>

        <Spacer size={32} />
      </ScrollView>


    </View>
  );
}

/**
 * One marketplace tile.
 *
 * `imageUrl` used to be an Unsplash stock photo per card, fetched from an unrelated CDN on
 * every render — four network round trips for decoration, four broken tiles offline, and
 * generic imagery that showed a stranger's kitchen rather than anything of this PG's. The
 * card takes an `icon` now: on-brand, instant, and it cannot 404.
 *
 * `available` exists because two of these tiles are not built yet. They used to read "Notify
 * Me" and "Manage" — labels that promise an action — and then answer a tap with "coming
 * soon". Saying so on the button is the smaller disappointment, and it stops someone tapping
 * twice to check whether the first one registered.
 */
function HubServiceCard({
  title, desc, icon, buttonText, onPress, available = true }: {
  title: string; desc: string; icon: keyof typeof Ionicons.glyphMap;
  buttonText: string; onPress: () => void; available?: boolean;
}) {
  return (
    <AnimatedPress accessibilityRole="button"
      accessibilityLabel={available ? `${title}. ${buttonText}` : `${title}. Coming soon`}
      accessibilityState={{ disabled: !available }}
      onPress={() => { onPress(); }}
      style={styles.gridCard}
    >
      <Row justify="space-between" align="center">
        <View style={styles.gridIconWrap}>
          <Ionicons name={icon} size={22} color={Colors.primary} />
        </View>
        {available ? (
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        ) : null}
      </Row>
      <Spacer size={10} />
      <Txt size={13} weight="700" color={Colors.textPrimary} numberOfLines={2}>{title}</Txt>
      <Txt size={10} color={Colors.textSecondary} style={{ marginTop: 2, minHeight: 28 }} numberOfLines={2}>
        {desc}
      </Txt>
      <Spacer size={8} />
      <View style={[styles.gridCardBtn, !available && styles.gridCardBtnMuted]}>
        <Txt size={10} weight="700" color={available ? Colors.textInverse : Colors.textMuted}>
          {available ? buttonText : 'Coming soon'}
        </Txt>
      </View>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },

  // Header

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Laundry Card
  laundryCard: {
    marginTop: -14, backgroundColor: Colors.surface,
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  laundryIconWrap: { width: 44, height: 44, borderRadius: Radii.pill, backgroundColor: '#F6F1E9', alignItems: 'center', justifyContent: 'center' },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: Radii.card, paddingHorizontal: 14, paddingVertical: 8 },
  laundryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.control },

  // Grid Card
  gridCard: {
    width: '48%', backgroundColor: Colors.surface, borderRadius: Radii.card,
    borderWidth: 1, borderColor: Colors.borderSubtle, padding: 12,
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  gridIconWrap: { width: 36, height: 36, borderRadius: Radii.pill, backgroundColor: '#F6F1E9', alignItems: 'center', justifyContent: 'center' },
  gridCardBtnMuted: { backgroundColor: Colors.surfaceMuted },
  gridCardBtn: { backgroundColor: Colors.primary, borderRadius: Radii.control, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' } });
