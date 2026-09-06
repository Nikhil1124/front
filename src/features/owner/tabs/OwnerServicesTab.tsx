import { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Text, Modal, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown, ZoomIn } from 'react-native-reanimated';
import { Row, Col, Spacer, LoadingState, ErrorState, ListRow, toneFor, ChoiceChips, SearchField, AnimatedPress } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { useRepairRequestsQuery } from '@/features/requests/useComplaints';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { useProcurementOrders } from '@/features/procurement/useProcurement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionsQuery, useSetSubscriptionActiveMutation } from '@/features/subscriptions/useSubscriptions';
import { AddPgDailySubscriptionDialog } from '@/components/dialogs/HubDialogs';

import { Colors, Palette, Radii } from '@/theme';
import { AppHeader, HeaderChip } from '@/components/AppHeader';

// ── Design Tokens (Official LUNA Palette) ───────────────────────────────────
const PRIMARY = Colors.primary;       // Deep Ocean Blue
const BG = Colors.canvas;            // Light Ice Canvas
const SURFACE = Colors.surface;      // Pure White
const CHARCOAL = Colors.textPrimary; // Obsidian Navy
const MUTED = Colors.textMuted;      // Ocean Muted
const BORDER = Colors.borderSubtle;  // Ice Subtle Border
const LIGHT_INDIGO = Colors.surfaceElevated; // Soft Ice Cyan Tint 

type ServiceItem = {
  id: string;
  name: string;
  desc: string;
  icon: any;
  type: 'POPULAR' | 'REPAIR' | 'ESSENTIAL' | 'CLEANING';
  cost: number;
  originalCost: number;
  problems: string[];
  includes: string[];
};

const SERVICES: ServiceItem[] = [
  // Popular
  { id: 'plumbing', name: 'Plumbing', desc: 'Tap, pipe, sink & bathroom issues', icon: 'water', type: 'POPULAR', cost: 30, originalCost: 125, problems: ['Leaking tap', 'Blocked sink', 'Flush not working'], includes: ['Technician inspection', 'Basic repair'] },
  { id: 'wifi', name: 'Wi-Fi Repairs', desc: 'Internet, router & connectivity issues', icon: 'wifi', type: 'POPULAR', cost: 30, originalCost: 125, problems: ['No internet', 'Router not turning on', 'Slow speed'], includes: ['Technician inspection', 'Configuration fixing'] },
  { id: 'electrical', name: 'Electrical', desc: 'Lights, switches, sockets & more', icon: 'flash', type: 'POPULAR', cost: 30, originalCost: 125, problems: ['Socket not working', 'Light flickering', 'MCB tripping'], includes: ['Technician inspection', 'Basic repair'] },
  { id: 'atoz', name: 'A to Z Repairs', desc: "Anything broken? We'll fix it.", icon: 'construct', type: 'POPULAR', cost: 30, originalCost: 125, problems: ['General breakage', 'Unidentified issue'], includes: ['Expert diagnosis', 'Custom repair quote'] },
  
  // Repairs & Maintenance
  { id: 'welding', name: 'Welding', desc: 'Gates, grills & metal work', icon: 'sparkles', type: 'REPAIR', cost: 30, originalCost: 125, problems: ['Grill broken', 'Gate hinge off'], includes: ['Inspection', 'Welding equipment'] },
  { id: 'civil', name: 'Civil Repairs', desc: 'Walls, tiles, cracks & minor work', icon: 'business', type: 'REPAIR', cost: 30, originalCost: 125, problems: ['Tile broken', 'Wall crack'], includes: ['Inspection', 'Minor plastering'] },
  { id: 'painting', name: 'Painting', desc: 'Touch-ups & minor painting', icon: 'color-palette', type: 'REPAIR', cost: 30, originalCost: 125, problems: ['Wall peeling', 'Stains on wall'], includes: ['Inspection', 'Painting labor'] },
  { id: 'lock', name: 'Lock & Door', desc: 'Lock repair & door fixes', icon: 'lock-closed', type: 'REPAIR', cost: 30, originalCost: 125, problems: ['Key stuck', 'Lock jammed'], includes: ['Inspection', 'Lock adjustment'] },
  { id: 'window', name: 'Window & Grill', desc: 'Windows, grills & sliding fixes', icon: 'grid', type: 'REPAIR', cost: 30, originalCost: 125, problems: ['Glass broken', 'Sliding jammed'], includes: ['Inspection', 'Track oiling'] },

  // Essentials
  { id: 'ac', name: 'AC Service', desc: 'AC repair & maintenance', icon: 'snow', type: 'ESSENTIAL', cost: 149, originalCost: 250, problems: ['Not cooling', 'Water leaking'], includes: ['Filter cleaning', 'Gas check'] },
  { id: 'geyser', name: 'Geyser Repair', desc: 'Geyser & water heater issues', icon: 'thermometer', type: 'ESSENTIAL', cost: 149, originalCost: 250, problems: ['Not heating', 'Water leaking'], includes: ['Inspection', 'Element check'] },
  { id: 'ro', name: 'RO / Purifier', desc: 'RO repair & maintenance', icon: 'water', type: 'ESSENTIAL', cost: 149, originalCost: 250, problems: ['Water flow slow', 'Bad taste'], includes: ['Inspection', 'Filter wash'] },
  { id: 'washing', name: 'Washing Machine', desc: 'Machine repair & cleaning', icon: 'shirt', type: 'ESSENTIAL', cost: 149, originalCost: 250, problems: ['Not spinning', 'Water not draining'], includes: ['Inspection', 'Motor check'] },
  { id: 'bathroom', name: 'Bathroom', desc: 'Bathroom maintenance', icon: 'cut', type: 'ESSENTIAL', cost: 149, originalCost: 250, problems: ['Drain block', 'Shower head leak'], includes: ['Inspection', 'Unclogging'] },
  { id: 'furniture', name: 'Furniture Repair', desc: 'Bed, chair & furniture fixes', icon: 'hammer', type: 'ESSENTIAL', cost: 149, originalCost: 250, problems: ['Bed squeaking', 'Chair wobble'], includes: ['Inspection', 'Glue/nail fixing'] },
  
  // Cleaning
  { id: 'room_clean', name: 'Room Cleaning', desc: 'Basic room cleaning', icon: 'bed', type: 'CLEANING', cost: 30, originalCost: 125, problems: ['Dusty floor', 'Messy room'], includes: ['Sweeping', 'Mopping'] },
  { id: 'bath_clean', name: 'Bathroom Cleaning', desc: 'Bathroom deep cleaning', icon: 'sparkles', type: 'CLEANING', cost: 30, originalCost: 125, problems: ['Dirty tiles', 'Hard water stains'], includes: ['Acid wash', 'Tile scrubbing'] },
  { id: 'common_clean', name: 'Common Area', desc: 'Common areas cleaning', icon: 'home', type: 'CLEANING', cost: 30, originalCost: 125, problems: ['Dirty hallway', 'Staircase dust'], includes: ['Sweeping', 'Mopping'] },
  { id: 'waste', name: 'Waste Cleaning', desc: 'Garbage & waste management', icon: 'trash', type: 'CLEANING', cost: 30, originalCost: 125, problems: ['Trash full', 'Bad odor'], includes: ['Waste removal', 'Bin washing'] },
  { id: 'deep_clean', name: 'Deep Cleaning', desc: 'Deep cleaning service', icon: 'star', type: 'CLEANING', cost: 30, originalCost: 125, problems: ['Moving in', 'Post-party'], includes: ['Full room wash', 'Bathroom descale'] },
  { id: 'pest', name: 'Pest Control', desc: 'Pest & insect control', icon: 'bug', type: 'CLEANING', cost: 30, originalCost: 125, problems: ['Bed bugs', 'Cockroaches'], includes: ['Chemical spray', 'Gel baiting'] },
];

export function OwnerServicesTab() {
  const { tab } = useLocalSearchParams<{ tab?: 'SERVICES' | 'BOOKINGS' | 'PROCUREMENT' }>();
  const insets = useSafeAreaInsets();
  const [activeSubTab, setActiveSubTab] = useState<'SERVICES' | 'BOOKINGS' | 'PROCUREMENT'>(tab ?? 'SERVICES');

  useEffect(() => {
    if (tab && ['SERVICES', 'BOOKINGS', 'PROCUREMENT'].includes(tab)) {
      setActiveSubTab(tab);
    }
  }, [tab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [showAddSubscription, setShowAddSubscription] = useState(false);

  const activePgId = useAuthStore((s) => s.activePgId);
  const {
    data: repairs = [],
    isLoading: repairsLoading,
    error: repairsError,
    refetch: refetchRepairs } = useRepairRequestsQuery(activePgId ?? undefined);
  const isManagerMode = useIsManagerMode();

  const { data: pendingOrders = [] } = useProcurementOrders({
    pgId: activePgId ?? undefined,
    status: isManagerMode ? undefined : 'pending_owner_approval' });
  const pendingCount = pendingOrders.length;

  const { data: subscriptions = [] } = useSubscriptionsQuery(activePgId ?? undefined);
  const setSubscriptionActive = useSetSubscriptionActiveMutation(activePgId ?? undefined);

  const renderServiceCard = (item: ServiceItem) => (
    <AnimatedPress accessibilityRole="button"
      key={item.id}
      onPress={() => { setSelectedService(item); }}
      style={styles.serviceCard}
    >
      <View style={styles.serviceIconFrame}>
        <Ionicons name={item.icon} size={48} color={CHARCOAL} />
      </View>
      <Text maxFontSizeMultiplier={1.3} style={styles.serviceName}>{item.name}</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.serviceDesc} numberOfLines={2}>{item.desc}</Text>
      <Row align="center" style={styles.priceRow}>
        <Text maxFontSizeMultiplier={1.3} style={styles.priceText}>₹{item.cost}</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.originalPriceText}>₹{item.originalCost}</Text>
      </Row>
    </AnimatedPress>
  );

  const renderSection = (title: string, type: string) => {
    const items = SERVICES.filter(s => s.type === type);
    if (items.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        {/* No "View all" here: the horizontal scroll below already renders every item in
            this section (see `items` above — it's the full filtered list, not a slice), so
            there was never anything more for that button to reveal. */}
        <Text maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, styles.sectionHeaderRow]}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {items.map(s => renderServiceCard(s))}
        </ScrollView>
      </View>
    );
  };

  const renderServices = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {searchQuery.trim().length > 0 ? (
        <View style={styles.sectionContainer}>
          <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Search Results</Text>
          <Spacer size={12} />
          <View style={styles.gridContainer}>
            {SERVICES.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => renderServiceCard(s))}
          </View>
        </View>
      ) : (
        <>
          {renderSection('Most Used', 'POPULAR')}
          {renderSection('Repairs & Maintenance', 'REPAIR')}
          {renderSection('PG Essentials', 'ESSENTIAL')}
          {renderSection('Cleaning & Common Areas', 'CLEANING')}
        </>
      )}

      {/* ── Fallback CTA Banner ── */}
      <View style={styles.fallbackBanner}>
        <Row align="center" style={{ flex: 1 }}>
          <View style={styles.fallbackIconWrap}>
            <Ionicons name="construct" size={28} color={CHARCOAL} />
            <View style={styles.speechBubble}><Text maxFontSizeMultiplier={1.3} style={{fontSize: 8, fontWeight: '900', color: PRIMARY}}>...</Text></View>
          </View>
          <Col style={{ flex: 1, paddingLeft: 12, paddingRight: 8 }}>
            <Text maxFontSizeMultiplier={1.3} style={styles.fallbackTitle}>Can't find what you need?</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.fallbackSub}>Tell us what's wrong and we'll find the right service.</Text>
          </Col>
          <AnimatedPress accessibilityRole="button" style={styles.requestBtn} onPress={() => setShowCustomRequest(true)}>
            <Ionicons name="add" size={16} color={SURFACE} />
            <Text maxFontSizeMultiplier={1.3} style={styles.requestBtnText}>Request a Service</Text>
          </AnimatedPress>
        </Row>
      </View>
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Active & Past Requests</Text>
      <Spacer size={12} />
      {/* "No active repair requests" is only true once the fetch has actually succeeded —
          before these branches it was also what an owner saw while it was still loading, and
          when it had failed outright. */}
      {repairsLoading ? (
        <LoadingState label="Loading requests…" fill={false} />
      ) : repairsError ? (
        <ErrorState
          error={repairsError}
          title="Could not load repair requests"
          onRetry={refetchRepairs}
          fill={false}
        />
      ) : repairs.length === 0 ? (
        <View style={styles.emptyLegacyCard}><Text maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No active repair requests.</Text></View>
      ) : (
        <View>
          {repairs.map((rep, i) => (
            <ListRow
              key={rep.id}
              title={`Request #${rep.id.slice(0, 4)}`}
              meta={rep.category}
              leading={<Ionicons name="construct-outline" size={17} color={Colors.primary} />}
              status={{ label: rep.status, tone: toneFor(rep.status) }}
              first={i === 0}
              last={i === repairs.length - 1}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderProcurement = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Procurement & Supplies</Text>
      <Spacer size={12} />
      <AnimatedPress accessibilityRole="button" style={styles.legacyCard} onPress={() => { router.push('/procurement'); }}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center">
            <Ionicons name="cube-outline" size={24} color={MUTED} />
            <Col>
              <Text maxFontSizeMultiplier={1.3} style={styles.legacyId}>View All Orders</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.legacyCategory}>{pendingCount} pending approvals</Text>
            </Col>
          </Row>
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </Row>
      </AnimatedPress>
      
      {pendingOrders.length > 0 && (
        <>
          <Spacer size={24} />
          <Text maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, { fontSize: 16 }]}>Pending Approvals</Text>
          <Spacer size={12} />
          <View>
            {pendingOrders.map((ord, i) => (
              <ListRow
                key={ord.id}
                title={`Order #${ord.id.slice(0, 4)}`}
                leading={<Ionicons name="cube-outline" size={17} color={Colors.primary} />}
                amount={`₹${ord.totalCost.toLocaleString('en-IN')}`}
                status={{ label: 'Pending', tone: 'warn' }}
                onPress={() => router.push('/procurement')}
                first={i === 0}
                last={i === pendingOrders.length - 1}
              />
            ))}
          </View>
        </>
      )}

      <Spacer size={24} />
      <Row justify="space-between" align="center">
        <Text maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, { fontSize: 16 }]}>Daily Subscriptions</Text>
        <AnimatedPress accessibilityRole="button" onPress={() => setShowAddSubscription(true)}>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '700', color: PRIMARY }}>+ Add</Text>
        </AnimatedPress>
      </Row>
      <Spacer size={12} />
      {subscriptions.length === 0 ? (
        <View style={styles.emptyLegacyCard}><Text maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No standing grocery orders yet.</Text></View>
      ) : (
        <View>
          {subscriptions.map((sub, i) => (
            <ListRow
              key={sub.id}
              title={sub.delivery_note || `${sub.items.length} item(s)`}
              meta={`Delivers ${sub.deliver_at.slice(0, 5)} · ${sub.items.length} item${sub.items.length === 1 ? '' : 's'}`}
              leading={<Ionicons name="repeat-outline" size={17} color={Colors.primary} />}
              status={{ label: sub.is_active ? 'Active' : 'Paused', tone: sub.is_active ? 'ok' : 'neutral' }}
              // The status pill used to be the pause button: nothing distinguished "this is
              // active" from "tap here to deactivate", so reading the list risked changing it.
              onPress={() => Alert.alert(
                sub.delivery_note || 'Standing order',
                sub.is_active ? 'Pause this delivery?' : 'Resume this delivery?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: sub.is_active ? 'Pause' : 'Resume',
                    onPress: () => setSubscriptionActive.mutate({ id: sub.id, active: !sub.is_active }) },
                ],
              )}
              first={i === 0}
              last={i === subscriptions.length - 1}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <AppHeader
        title="Services"
        subtitle="Get your PG problems fixed quickly"
        onBack={() => router.back()}
        actions={
          <HeaderChip icon="notifications" label="Notifications" badge onPress={() => { router.push('/notices'); }} />
        }
      />

      {/* ── Main Content Sheet (White Background with Rounded Top) ── */}
      <View style={styles.mainSheet}>
        {/* Search */}
        <SearchField
          placeholder="Search for a service"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {activeSubTab === 'SERVICES' && renderServices()}
        {activeSubTab === 'BOOKINGS' && renderBookings()}
        {activeSubTab === 'PROCUREMENT' && renderProcurement()}

        {/* ── Sub Navigation Bar ── */}
        <View style={[styles.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('SERVICES'); }}>
            <Ionicons name={activeSubTab === 'SERVICES' ? "grid" : "grid-outline"} size={22} color={activeSubTab === 'SERVICES' ? PRIMARY : MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'SERVICES' && styles.navTabTextActive]}>Services</Text>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('BOOKINGS'); }}>
            <Ionicons name={activeSubTab === 'BOOKINGS' ? "calendar" : "calendar-outline"} size={22} color={activeSubTab === 'BOOKINGS' ? PRIMARY : MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'BOOKINGS' && styles.navTabTextActive]}>Bookings</Text>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('PROCUREMENT'); }}>
            <Ionicons name={activeSubTab === 'PROCUREMENT' ? "cube" : "cube-outline"} size={22} color={activeSubTab === 'PROCUREMENT' ? PRIMARY : MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'PROCUREMENT' && styles.navTabTextActive]}>Supplies</Text>
          </AnimatedPress>
        </View>
      </View>

      {/* Service Detail Modal */}
      {selectedService && <ServiceDetailModal service={selectedService} onDismiss={() => setSelectedService(null)} />}
      {showCustomRequest && <ServiceDetailModal service={SERVICES.find(s => s.id === 'atoz')!} onDismiss={() => setShowCustomRequest(false)} />}
      {showAddSubscription && <AddPgDailySubscriptionDialog onDismiss={() => setShowAddSubscription(false)} />}
    </View>
  );
}

// ── Service Detail Booking Modal ─────────────────────────────────────────────

const TIME_SLOT_OPTIONS = [
  'Today, 10:00 AM', 'Today, 2:00 PM', 'Today, 5:00 PM',
  'Tomorrow, 10:00 AM', 'Tomorrow, 2:00 PM',
];

function ServiceDetailModal({ service, onDismiss }: { service: ServiceItem, onDismiss: () => void }) {
  const [success, setSuccess] = useState(false);
  const bookRepair = usePGowStore((s) => s.bookPgRepairService);
  const [time, setTime] = useState(TIME_SLOT_OPTIONS[1]);

  const handleBook = () => {
    bookRepair(service.name, `Requesting ${service.name}`, time, service.cost);
    setSuccess(true);
    setTimeout(() => {
      onDismiss();
    }, 2500);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={success ? undefined : onDismiss} />
        <Animated.View entering={SlideInDown.springify(200).dampingRatio(0.85)} style={styles.modalSheet}>
          {success ? (
            <Animated.View entering={ZoomIn.duration(250)} style={styles.successView}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={32} color={SURFACE} />
              </View>
              <Text maxFontSizeMultiplier={1.3} style={styles.successTitle}>Request Created</Text>
              <Spacer size={8} />
              <View style={styles.successBox}>
                <Row justify="space-between" style={{marginBottom: 4}}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.successLabel}>Service</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.successVal}>{service.name}</Text>
                </Row>
                <Row justify="space-between" style={{marginBottom: 4}}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.successLabel}>Time</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.successVal}>{time}</Text>
                </Row>
                <Row justify="space-between">
                  <Text maxFontSizeMultiplier={1.3} style={styles.successLabel}>Status</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.successVal}>Assigning Technician</Text>
                </Row>
              </View>
            </Animated.View>
          ) : (
            <>
              <View style={styles.sheetHandle} />
              <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name={service.icon} size={24} color={PRIMARY} />
                </View>
                <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={onDismiss} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={MUTED} />
                </AnimatedPress>
              </Row>

              <Text maxFontSizeMultiplier={1.3} style={styles.modalTitle}>{service.name}</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.modalDesc}>{service.desc}</Text>
              <Spacer size={24} />

              <Text maxFontSizeMultiplier={1.3} style={styles.modalSectionTitle}>Common problems</Text>
              <Spacer size={8} />
              {service.problems.map((prob, i) => (
                <Row key={i} gap={8} align="center" style={{ marginBottom: 6 }}>
                  <Ionicons name="alert-circle-outline" size={14} color={MUTED} />
                  <Text maxFontSizeMultiplier={1.3} style={styles.modalListItem}>{prob}</Text>
                </Row>
              ))}
              
              <Spacer size={16} />

              <Text maxFontSizeMultiplier={1.3} style={styles.modalSectionTitle}>What's included</Text>
              <Spacer size={8} />
              {service.includes.map((inc, i) => (
                <Row key={i} gap={8} align="center" style={{ marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                  <Text maxFontSizeMultiplier={1.3} style={styles.modalListItem}>{inc}</Text>
                </Row>
              ))}

              <Spacer size={24} />

              {/* Five slots shown, not hidden behind an Alert. The chevron here originally
                  had no onPress at all, so every booking went out as "Today, 2:00 PM". */}
              <ChoiceChips
                label="Preferred time"
                options={TIME_SLOT_OPTIONS}
                value={time}
                onChange={setTime}
                testID="service_time"
              />

              <Spacer size={16} />

              <View style={styles.bookingBox}>
                <Row justify="space-between" align="center">
                  <Text maxFontSizeMultiplier={1.3} style={styles.bookingLabel}>Estimated charges</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.bookingCost}>₹{service.cost}</Text>
                </Row>
              </View>

              <Spacer size={24} />
              <AnimatedPress accessibilityRole="button" style={styles.bookBtn} onPress={handleBook}>
                <Text maxFontSizeMultiplier={1.3} style={styles.bookBtnText}>Book Service</Text>
              </AnimatedPress>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },
  
  mainSheet: { flex: 1, backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  

  scroll: { paddingBottom: 100 },
  
  sectionContainer: { marginTop: 24 },
  sectionHeaderRow: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: CHARCOAL },
  
  horizontalScroll: { paddingHorizontal: 20, gap: 12 },
  gridContainer: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  
  serviceCard: { width: 140, backgroundColor: SURFACE, borderRadius: Radii.card, padding: 12, borderWidth: 1, borderColor: BORDER, shadowColor: CHARCOAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  serviceIconFrame: { height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: Radii.card, marginBottom: 12 },
  
  serviceName: { fontSize: 13, fontWeight: '800', color: CHARCOAL },
  serviceDesc: { fontSize: 11, color: MUTED, lineHeight: 14, marginTop: 2, height: 28 },
  priceRow: { marginTop: 8, gap: 6 },
  priceText: { fontSize: 15, fontWeight: '800', color: CHARCOAL },
  originalPriceText: { fontSize: 12, color: MUTED, textDecorationLine: 'line-through' },
  
  fallbackBanner: { flexDirection: 'row', backgroundColor: Palette.TintGreen, borderRadius: Radii.card, padding: 16, marginHorizontal: 20, marginTop: 24, borderWidth: 1, borderColor: '#D1EAE0' },
  fallbackIconWrap: { position: 'relative' },
  speechBubble: { position: 'absolute', top: -4, right: -12, backgroundColor: SURFACE, paddingHorizontal: 4, paddingVertical: 2, borderRadius: Radii.control, borderWidth: 1, borderColor: '#D1EAE0' },
  fallbackTitle: { fontSize: 14, fontWeight: '800', color: CHARCOAL },
  fallbackSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  requestBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.control },
  requestBtnText: { fontSize: 12, fontWeight: '700', color: SURFACE, marginLeft: 4 },
  
  legacyCard: { backgroundColor: SURFACE, borderRadius: Radii.card, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  legacyId: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  legacyCategory: { fontSize: 13, color: MUTED, marginTop: 2 },
  emptyLegacyCard: { backgroundColor: BG, borderRadius: Radii.card, padding: 20, alignItems: 'center' },
  emptyLegacyText: { fontSize: 13, color: MUTED },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10, 18, 13, 0.45)', justifyContent: 'flex-end' },
  modalSheet: { width: '100%', backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: Radii.badge, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20 },
  closeBtn: { width: 32, height: 32, borderRadius: Radii.pill, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  modalIconBox: { width: 56, height: 56, borderRadius: Radii.card, backgroundColor: LIGHT_INDIGO, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: CHARCOAL },
  modalDesc: { fontSize: 14, color: MUTED, marginTop: 4 },
  modalSectionTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  modalListItem: { fontSize: 14, color: CHARCOAL },
  
  bookingBox: { backgroundColor: BG, borderRadius: Radii.card, padding: 16, borderWidth: 1, borderColor: BORDER },
  bookingLabel: { fontSize: 12, color: MUTED, fontWeight: '500' },
  bookingCost: { fontSize: 18, fontWeight: '800', color: CHARCOAL, marginTop: 4 },
  
  bookBtn: { height: 52, backgroundColor: PRIMARY, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { fontSize: 16, fontWeight: '800', color: SURFACE },
  
  successView: { alignItems: 'center', paddingVertical: 40 },
  successCircle: { width: 64, height: 64, borderRadius: Radii.pill, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: CHARCOAL },
  successBox: { width: '100%', backgroundColor: BG, borderRadius: Radii.card, padding: 16, marginTop: 16 },
  successLabel: { fontSize: 13, color: MUTED },
  successVal: { fontSize: 13, fontWeight: '700', color: CHARCOAL },

  bottomNavBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: SURFACE, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navTabText: { fontSize: 10, fontWeight: '600', color: MUTED, marginTop: 4 },
  navTabTextActive: { color: PRIMARY, fontWeight: '800' } });
