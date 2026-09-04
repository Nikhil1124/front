import { useState, useMemo, useEffect } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Text, TextInput, Modal, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown, ZoomIn } from 'react-native-reanimated';
import { Row, Col, Spacer } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { useRepairRequestsQuery } from '@/features/requests/useComplaints';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { useProcurementOrders } from '@/features/procurement/useProcurement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionsQuery, useSetSubscriptionActiveMutation } from '@/features/subscriptions/useSubscriptions';
import { AddPgDailySubscriptionDialog } from '@/components/dialogs/HubDialogs';

import { Colors } from '@/theme';

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
  const { data: repairs = [] } = useRepairRequestsQuery(activePgId ?? undefined);
  const isManagerMode = useIsManagerMode();

  const { data: pendingOrders = [] } = useProcurementOrders({
    pgId: activePgId ?? undefined,
    status: isManagerMode ? undefined : 'pending_owner_approval',
  });
  const pendingCount = pendingOrders.length;

  const { data: subscriptions = [] } = useSubscriptionsQuery(activePgId ?? undefined);
  const setSubscriptionActive = useSetSubscriptionActiveMutation(activePgId ?? undefined);

  const renderServiceCard = (item: ServiceItem) => (
    <TouchableOpacity accessibilityRole="button"
      key={item.id}
      activeOpacity={0.8}
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
    </TouchableOpacity>
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
          <TouchableOpacity accessibilityRole="button" style={styles.requestBtn} activeOpacity={0.8} onPress={() => setShowCustomRequest(true)}>
            <Ionicons name="add" size={16} color={SURFACE} />
            <Text maxFontSizeMultiplier={1.3} style={styles.requestBtnText}>Request a Service</Text>
          </TouchableOpacity>
        </Row>
      </View>
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Active & Past Requests</Text>
      <Spacer size={12} />
      {repairs.length === 0 ? (
        <View style={styles.emptyLegacyCard}><Text maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No active repair requests.</Text></View>
      ) : (
        <Col gap={10}>
          {repairs.map((rep) => (
            <View key={rep.id} style={styles.legacyCard}>
              <Row justify="space-between" align="center">
                <Col>
                  <Text maxFontSizeMultiplier={1.3} style={styles.legacyId}>Request #{rep.id.slice(0, 4)}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.legacyCategory}>{rep.category}</Text>
                </Col>
                <View style={styles.legacyPill}><Text maxFontSizeMultiplier={1.3} style={styles.legacyPillText}>{rep.status}</Text></View>
              </Row>
            </View>
          ))}
        </Col>
      )}
    </ScrollView>
  );

  const renderProcurement = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Procurement & Supplies</Text>
      <Spacer size={12} />
      <TouchableOpacity accessibilityRole="button" style={styles.legacyCard} onPress={() => { router.push('/procurement'); }} activeOpacity={0.8}>
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
      </TouchableOpacity>
      
      {pendingOrders.length > 0 && (
        <>
          <Spacer size={24} />
          <Text maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, { fontSize: 16 }]}>Pending Approvals</Text>
          <Spacer size={12} />
          <Col gap={10}>
            {pendingOrders.map((ord) => (
              <View key={ord.id} style={styles.legacyCard}>
                <Row justify="space-between" align="center">
                  <Col>
                    <Text maxFontSizeMultiplier={1.3} style={styles.legacyId}>Order #{ord.id.slice(0, 4)}</Text>
                    <Text maxFontSizeMultiplier={1.3} style={styles.legacyCategory}>₹{ord.totalCost.toLocaleString('en-IN')}</Text>
                  </Col>
                  <View style={[styles.legacyPill, { backgroundColor: '#FEF3C7' }]}><Text maxFontSizeMultiplier={1.3} style={[styles.legacyPillText, { color: '#D97706' }]}>Pending</Text></View>
                </Row>
              </View>
            ))}
          </Col>
        </>
      )}

      <Spacer size={24} />
      <Row justify="space-between" align="center">
        <Text maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, { fontSize: 16 }]}>Daily Subscriptions</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => setShowAddSubscription(true)} activeOpacity={0.8}>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '700', color: PRIMARY }}>+ Add</Text>
        </TouchableOpacity>
      </Row>
      <Spacer size={12} />
      {subscriptions.length === 0 ? (
        <View style={styles.emptyLegacyCard}><Text maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No standing grocery orders yet.</Text></View>
      ) : (
        <Col gap={10}>
          {subscriptions.map((sub) => (
            <View key={sub.id} style={styles.legacyCard}>
              <Row justify="space-between" align="center">
                <Col style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.legacyId}>{sub.delivery_note || `${sub.items.length} item(s)`}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.legacyCategory}>Delivers {sub.deliver_at.slice(0, 5)} • {sub.items.length} item{sub.items.length === 1 ? '' : 's'}</Text>
                </Col>
                <TouchableOpacity accessibilityRole="button"
                  onPress={() => setSubscriptionActive.mutate({ id: sub.id, active: !sub.is_active })}
                  disabled={setSubscriptionActive.isPending}
                  style={[styles.legacyPill, { backgroundColor: sub.is_active ? '#D1FAE5' : '#F3F4F6' }]}
                >
                  <Text maxFontSizeMultiplier={1.3} style={[styles.legacyPillText, { color: sub.is_active ? '#047857' : MUTED }]}>
                    {sub.is_active ? 'Active' : 'Paused'}
                  </Text>
                </TouchableOpacity>
              </Row>
            </View>
          ))}
        </Col>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      {/* ── Page Header (Solid Primary Background) ── */}
      <View style={[styles.headerArea, { paddingTop: insets.top + 16 }]}>
        <Row justify="space-between" align="flex-start">
          <Col>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={{ marginBottom: 16 }}>
              <Ionicons name="arrow-back" size={24} color={SURFACE} />
            </TouchableOpacity>
            <Text maxFontSizeMultiplier={1.3} style={styles.pageTitle}>Services</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.pageSub}>Get your PG problems fixed quickly</Text>
          </Col>
          <Row gap={12} align="center" style={{ marginTop: 40 }}>
            <View style={styles.headerAvatarBtn}>
              <Ionicons name="person" size={20} color={PRIMARY} />
            </View>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Notifications" accessibilityRole="button" 
              style={[styles.headerIconBtn, { backgroundColor: 'transparent' }]}
              activeOpacity={0.7}
              onPress={() => { router.push('/notices'); }}
            >
              <Ionicons name="notifications" size={24} color={SURFACE} />
              <View style={styles.headerNotifDot} />
            </TouchableOpacity>
          </Row>
        </Row>
      </View>

      {/* ── Main Content Sheet (White Background with Rounded Top) ── */}
      <View style={styles.mainSheet}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={MUTED} />
          <TextInput maxFontSizeMultiplier={1.3} accessibilityLabel="Search for a service"
            style={styles.searchInput}
            placeholder="Search for a service"
            placeholderTextColor={MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {activeSubTab === 'SERVICES' && renderServices()}
        {activeSubTab === 'BOOKINGS' && renderBookings()}
        {activeSubTab === 'PROCUREMENT' && renderProcurement()}

        {/* ── Sub Navigation Bar ── */}
        <View style={[styles.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('SERVICES'); }} activeOpacity={0.7}>
            <Ionicons name={activeSubTab === 'SERVICES' ? "grid" : "grid-outline"} size={22} color={activeSubTab === 'SERVICES' ? PRIMARY : MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'SERVICES' && styles.navTabTextActive]}>Services</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('BOOKINGS'); }} activeOpacity={0.7}>
            <Ionicons name={activeSubTab === 'BOOKINGS' ? "calendar" : "calendar-outline"} size={22} color={activeSubTab === 'BOOKINGS' ? PRIMARY : MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'BOOKINGS' && styles.navTabTextActive]}>Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('PROCUREMENT'); }} activeOpacity={0.7}>
            <Ionicons name={activeSubTab === 'PROCUREMENT' ? "cube" : "cube-outline"} size={22} color={activeSubTab === 'PROCUREMENT' ? PRIMARY : MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'PROCUREMENT' && styles.navTabTextActive]}>Supplies</Text>
          </TouchableOpacity>
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

  // The chevron next to the time had no onPress at all — every booking silently went out
  // as "Today, 2:00 PM" regardless of what the owner actually wanted, with no way to change
  // it despite the UI implying it was tappable. Alert.alert's button list is the same
  // pick-one-of-a-few pattern already used elsewhere in this app (see KycUploadDialog's
  // choosePhoto), so this stays consistent rather than building a second picker component.
  const pickTime = () => {
    Alert.alert(
      'Preferred time',
      undefined,
      [
        ...TIME_SLOT_OPTIONS.map((slot) => ({ text: slot, onPress: () => setTime(slot) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

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
        <Animated.View entering={SlideInDown.duration(200)} style={styles.modalSheet}>
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
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={onDismiss} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={MUTED} />
                </TouchableOpacity>
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
                  <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />
                  <Text maxFontSizeMultiplier={1.3} style={styles.modalListItem}>{inc}</Text>
                </Row>
              ))}

              <Spacer size={24} />

              <View style={styles.bookingBox}>
                <Row justify="space-between" align="center">
                  <Col>
                    <Text maxFontSizeMultiplier={1.3} style={styles.bookingLabel}>Estimated charges</Text>
                    <Text maxFontSizeMultiplier={1.3} style={styles.bookingCost}>₹{service.cost}</Text>
                  </Col>
                  <View style={{ width: 1, height: 30, backgroundColor: BORDER }} />
                  <Col>
                    <Text maxFontSizeMultiplier={1.3} style={styles.bookingLabel}>Preferred time</Text>
                    <TouchableOpacity accessibilityRole="button" style={styles.timeSelectBtn} activeOpacity={0.7} onPress={pickTime}>
                      <Text maxFontSizeMultiplier={1.3} style={styles.bookingTime}>{time}</Text>
                      <Ionicons name="chevron-down" size={14} color={PRIMARY} />
                    </TouchableOpacity>
                  </Col>
                </Row>
              </View>

              <Spacer size={24} />
              <TouchableOpacity accessibilityRole="button" style={styles.bookBtn} activeOpacity={0.85} onPress={handleBook}>
                <Text maxFontSizeMultiplier={1.3} style={styles.bookBtnText}>Book Service</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PRIMARY },
  
  headerArea: { paddingHorizontal: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: SURFACE },
  pageSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  headerAvatarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerNotifDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: PRIMARY },
  
  mainSheet: { flex: 1, backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, height: 50, borderRadius: 12, paddingHorizontal: 16, marginHorizontal: 20, marginTop: 20, shadowColor: CHARCOAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: '#F3F4F6' },
  searchInput: { flex: 1, fontSize: 15, color: CHARCOAL, marginLeft: 10 },

  scroll: { paddingBottom: 100 },
  
  sectionContainer: { marginTop: 24 },
  sectionHeaderRow: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: CHARCOAL },
  
  horizontalScroll: { paddingHorizontal: 20, gap: 12 },
  gridContainer: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  
  serviceCard: { width: 140, backgroundColor: SURFACE, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: BORDER, shadowColor: CHARCOAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  serviceIconFrame: { height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12 },
  
  serviceName: { fontSize: 13, fontWeight: '800', color: CHARCOAL },
  serviceDesc: { fontSize: 11, color: MUTED, lineHeight: 14, marginTop: 2, height: 28 },
  priceRow: { marginTop: 8, gap: 6 },
  priceText: { fontSize: 15, fontWeight: '800', color: CHARCOAL },
  originalPriceText: { fontSize: 12, color: MUTED, textDecorationLine: 'line-through' },
  
  fallbackBanner: { flexDirection: 'row', backgroundColor: '#EEF8F1', borderRadius: 16, padding: 16, marginHorizontal: 20, marginTop: 24, borderWidth: 1, borderColor: '#D1EAE0' },
  fallbackIconWrap: { position: 'relative' },
  speechBubble: { position: 'absolute', top: -4, right: -12, backgroundColor: SURFACE, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#D1EAE0' },
  fallbackTitle: { fontSize: 14, fontWeight: '800', color: CHARCOAL },
  fallbackSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  requestBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  requestBtnText: { fontSize: 12, fontWeight: '700', color: SURFACE, marginLeft: 4 },
  
  legacyArea: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 24, paddingHorizontal: 20 },
  legacyCard: { backgroundColor: SURFACE, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  legacyId: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  legacyCategory: { fontSize: 13, color: MUTED, marginTop: 2 },
  legacyPill: { backgroundColor: LIGHT_INDIGO, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  legacyPillText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  emptyLegacyCard: { backgroundColor: BG, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyLegacyText: { fontSize: 13, color: MUTED },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10, 18, 13, 0.45)', justifyContent: 'flex-end' },
  modalSheet: { width: '100%', backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  modalIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: LIGHT_INDIGO, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: CHARCOAL },
  modalDesc: { fontSize: 14, color: MUTED, marginTop: 4 },
  modalSectionTitle: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  modalListItem: { fontSize: 14, color: CHARCOAL },
  
  bookingBox: { backgroundColor: BG, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER },
  bookingLabel: { fontSize: 12, color: MUTED, fontWeight: '500' },
  bookingCost: { fontSize: 18, fontWeight: '800', color: CHARCOAL, marginTop: 4 },
  timeSelectBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  bookingTime: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  
  bookBtn: { height: 52, backgroundColor: PRIMARY, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { fontSize: 16, fontWeight: '800', color: SURFACE },
  
  successView: { alignItems: 'center', paddingVertical: 40 },
  successCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#166534', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: CHARCOAL },
  successBox: { width: '100%', backgroundColor: BG, borderRadius: 12, padding: 16, marginTop: 16 },
  successLabel: { fontSize: 13, color: MUTED },
  successVal: { fontSize: 13, fontWeight: '700', color: CHARCOAL },

  bottomNavBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: SURFACE, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navTabText: { fontSize: 10, fontWeight: '600', color: MUTED, marginTop: 4 },
  navTabTextActive: { color: PRIMARY, fontWeight: '800' },
});
