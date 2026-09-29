import { useState, useEffect } from 'react';
import { Image, ScrollView, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PGRepairServiceRequest } from '@/types';
import { useActiveProperty } from '@/features/properties/useProperties';
import { useRepairRequestsQuery, useResolveComplaintMutation } from '@/features/requests/useComplaints';
import { buildInvoice, shortRef } from '@/features/payments/invoice';
import { shareInvoicePdf } from '@/features/payments/invoicePdf';
import { useToast } from '@/hooks/useToast';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { useProcurementOrders } from '@/features/procurement/useProcurement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionsQuery, useSetSubscriptionActiveMutation } from '@/features/subscriptions/useSubscriptions';
import { AddPgDailySubscriptionDialog } from '@/components/dialogs/HubDialogs';
import { BookRepairSheet } from '../components/BookRepairSheet';
import { bySection, useBookServiceMutation, useServiceCatalog, type CatalogService } from '@/features/serviceCatalog/useServiceCatalog';

import { Colors, Palette, Radii } from '@/theme';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { formatINR } from '@/utils/format';
import { AnimatedPress, Btn, ChoiceChips, Col, ErrorState, ListRow, LoadingState, PGowDialog, Row, SearchField, Sheet, Spacer, Txt, toneFor } from '@/components/ui';

// ── Design Tokens (Official LUNA Palette) ───────────────────────────────────
const PRIMARY = Colors.primary;       // Deep Ocean Blue
const BG = Colors.canvas;            // Light Ice Canvas
const SURFACE = Colors.surface;      // Pure White
const CHARCOAL = Colors.textPrimary; // Obsidian Navy
const MUTED = Colors.textMuted;      // Ocean Muted
const BORDER = Colors.borderSubtle;  // Ice Subtle Border

type ServiceItem = CatalogService;

/**
 * The artwork for each service, keyed by id.
 *
 * A static map rather than a field on the service because Metro resolves `require` at build
 * time — a path built from `item.id` at runtime does not bundle.
 *
 * These are Kushal's `assets/Services/Owner_Manager_Services` set. They are used in the detail
 * sheet only, not on the grid tiles, for two reasons: each one has its service name rendered
 * INTO the picture, which at a tile's ~110px would be an unreadable second copy of the label
 * already underneath it, and one that ignores the reader's font-size setting because it is
 * pixels; and they do not share an aspect ratio (378x250 and 250x250 both appear), so a row
 * of tiles cropped to a square would frame them inconsistently. Full sheet width is where the
 * baked label is legible and the ratio does not have to match anything.
 */
const SERVICE_IMAGES: Record<string, number> = {
  plumbing: require('../../../../assets/Services/Owner_Manager_Services/01_Plumbing.png'),
  wifi: require('../../../../assets/Services/Owner_Manager_Services/02_WiFi_Repairs.png'),
  electrical: require('../../../../assets/Services/Owner_Manager_Services/03_Electrical.png'),
  atoz: require('../../../../assets/Services/Owner_Manager_Services/04_A_to_Z_Repairs.png'),
  welding: require('../../../../assets/Services/Owner_Manager_Services/05_Welding.png'),
  civil: require('../../../../assets/Services/Owner_Manager_Services/06_Civil_Repairs.png'),
  painting: require('../../../../assets/Services/Owner_Manager_Services/07_Painting.png'),
  lock: require('../../../../assets/Services/Owner_Manager_Services/08_Lock_and_Door.png'),
  window: require('../../../../assets/Services/Owner_Manager_Services/09_Window_and_Grill.png'),
  ac: require('../../../../assets/Services/Owner_Manager_Services/10_AC_Service.png'),
  geyser: require('../../../../assets/Services/Owner_Manager_Services/11_Geyser_Repair.png'),
  ro: require('../../../../assets/Services/Owner_Manager_Services/12_RO_Purifier.png'),
  washing: require('../../../../assets/Services/Owner_Manager_Services/13_Washing_Machine.png'),
  bathroom: require('../../../../assets/Services/Owner_Manager_Services/14_Bathroom_Maintenance.png'),
  furniture: require('../../../../assets/Services/Owner_Manager_Services/15_Furniture_Repair.png'),
  room_clean: require('../../../../assets/Services/Owner_Manager_Services/16_Room_Cleaning.png'),
  bath_clean: require('../../../../assets/Services/Owner_Manager_Services/17_Bathroom_Cleaning.png'),
  common_clean: require('../../../../assets/Services/Owner_Manager_Services/18_Common_Area_Cleaning.png'),
  waste: require('../../../../assets/Services/Owner_Manager_Services/19_Waste_Cleaning.png'),
  deep_clean: require('../../../../assets/Services/Owner_Manager_Services/20_Deep_Cleaning.png'),
  pest: require('../../../../assets/Services/Owner_Manager_Services/21_Pest_Control.png'),
};

/** A picture for a catalog service: the uploaded one, else the one this app ships for it. */
function serviceArt(item: ServiceItem) {
  if (item.image_url) return { uri: item.image_url };
  return item.builtin_image ? SERVICE_IMAGES[item.builtin_image] : undefined;
}

export function OwnerServicesTab() {
  const { tab } = useLocalSearchParams<{ tab?: 'SERVICES' | 'BOOKINGS' | 'PROCUREMENT' | 'TECHNICIAN' }>();
  const insets = useSafeAreaInsets();
  const [activeSubTab, setActiveSubTab] = useState<'SERVICES' | 'BOOKINGS' | 'PROCUREMENT' | 'TECHNICIAN'>(tab ?? 'SERVICES');
  /** The repair being closed out. Holding the row, not just its id, so the dialog can name
   *  the job and the invoice can be built without a second lookup. */
  const [completing, setCompleting] = useState<PGRepairServiceRequest | null>(null);

  useEffect(() => {
    if (tab && ['SERVICES', 'BOOKINGS', 'PROCUREMENT', 'TECHNICIAN'].includes(tab)) {
      setActiveSubTab(tab);
    }
  }, [tab]);
  const [searchQuery, setSearchQuery] = useState('');
  const catalog = useServiceCatalog();
  const services = catalog.data ?? [];
  // "Can't find what you need?" books the catch-all service, when the catalog has one.
  const anything = services.find(s => s.builtin_image === 'atoz') ?? null;
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [showBookRepairSheet, setShowBookRepairSheet] = useState(false);
  const [togglingSub, setTogglingSub] = useState<{ id: string; label: string; active: boolean } | null>(null);

  const activePgId = useAuthStore((s) => s.activePgId);
  const {
    data: repairs = [],
    isLoading: repairsLoading,
    error: repairsError,
    refetch: refetchRepairs } = useRepairRequestsQuery(activePgId ?? undefined);
  const resolveRepair = useResolveComplaintMutation(activePgId ?? undefined);
  const { activeEntity: owner } = useActiveProperty();
  const toast = useToast();
  const isManagerMode = useIsManagerMode();

  const { data: pendingOrders = [] } = useProcurementOrders({
    pgId: activePgId ?? undefined,
    status: isManagerMode ? undefined : 'pending_owner_approval'
  });
  const pendingCount = pendingOrders.length;

  const { data: subscriptions = [] } = useSubscriptionsQuery(activePgId ?? undefined);
  const setSubscriptionActive = useSetSubscriptionActiveMutation(activePgId ?? undefined);

  /**
   * One service tile.
   *
   * Three things changed here, and all three were the same underlying problem — the card was
   * dressed as a storefront for a catalogue that does not exist:
   *
   *  1. The struck-through "original price" is gone. Fifteen unrelated services (plumbing,
   *     Wi-Fi, welding, painting, room cleaning) all read "₹30, was ₹125" and six more all
   *     read "₹149, was ₹250" — one invented discount, copied across the list. Worse than
   *     decoration: `bookRepair(..., service.cost)` writes that number to the request as its
   *     real `amount`, so a made-up price was being recorded against real work.
   *  2. The remaining number is labelled "Visit fee" rather than shown as a bare price. Each
   *     service's own `includes` says "Technician inspection" — these trades quote after
   *     seeing the job, so presenting a total is the wrong promise to make.
   *  3. The Unsplash stock photo is replaced by the service's own `icon`, which every entry
   *     already carried and nothing used. That removes 21 external image fetches from an
   *     unrelated CDN — each one a network round trip on render, and a broken tile whenever
   *     it 404s or the resident is offline — for something on-brand that cannot fail.
   */
  /** The document for a finished repair. Built from `finalCost` and nothing else — the visit
   *  fee is what booking quoted, and stating it as a total is the promise the catalogue's own
   *  card refuses to make. No charge recorded, no invoice offered. */
  const shareRepairInvoice = (rep: PGRepairServiceRequest) => {
    if (rep.finalCost == null) return;
    shareInvoicePdf(
      buildInvoice({
        paymentId: rep.id,
        amount: rep.finalCost,
        monthYear: new Date(rep.timestamp).toLocaleDateString('en-IN', {
          month: 'short', year: 'numeric',
        }),
        paymentType: 'REPAIR',
        issuedAt: rep.timestamp,
        isVerified: true,
        from: { name: 'PGow Services' },
        to: { name: owner?.pgName || 'Your property', line: owner?.address || undefined },
        lines: [
          { description: rep.issueTitle || rep.category || 'Repair work', amount: rep.finalCost },
        ],
      }),
      [
        ['Request', shortRef(rep.id)],
        ['Technician', rep.assignedTechnicianName || '—'],
        // Printed as a detail, never as the total — the two are different facts.
        ['Visit fee quoted', `₹${rep.estimatedCost}`],
      ],
    ).catch(() => toast('error', 'Could not share', 'The invoice could not be prepared.'));
  };

  const renderServiceCard = (item: ServiceItem) => (
    <AnimatedPress accessibilityRole="button"
      accessibilityLabel={`${item.name}. Visit fee ${formatINR(Number(item.visit_fee))}`}
      key={item.id}
      onPress={() => { setSelectedService(item); }}
      style={styles.serviceCard}
    >
      <View style={styles.serviceIconFrame}>
        {serviceArt(item) ? (
          <Image source={serviceArt(item)!} style={styles.serviceImage} />
        ) : (
          <Ionicons name="construct" size={30} color={PRIMARY} />
        )}
        <View style={styles.addButton}>
          <Ionicons name="add" size={18} color={PRIMARY} />
        </View>
      </View>
      {/* Two lines, not one: "Washing Machine" and "Bathroom Cleaning" both truncated at the
          card's 31% width, and at a large font scale most of them did. */}
      <Txt maxFontSizeMultiplier={1.3} style={styles.serviceName} numberOfLines={2}>{item.name}</Txt>
      <Txt maxFontSizeMultiplier={1.3} style={styles.visitFeeText}>{formatINR(Number(item.visit_fee))} visit fee</Txt>
    </AnimatedPress>
  );

  const renderSection = (title: string, items: ServiceItem[]) => (
    <View key={title} style={styles.sectionContainer}>
      <Txt maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, styles.sectionHeaderRow]}>{title}</Txt>
      <View style={styles.gridContainer}>
        {items.map(s => renderServiceCard(s))}
      </View>
    </View>
  );

  const renderServices = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {searchQuery.trim().length > 0 ? (
        <View style={styles.sectionContainer}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Search Results</Txt>
          <Spacer size={12} />
          <View style={styles.gridContainer}>
            {services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => renderServiceCard(s))}
          </View>
        </View>
      ) : (
        <>
          {catalog.isLoading && !catalog.data ? <LoadingState label="Loading services…" /> : null}
          {catalog.error && !catalog.data ? (
            <ErrorState error={catalog.error} title="Could not load services" onRetry={catalog.refetch} />
          ) : null}
          {bySection(services).map(([title, items]) => renderSection(title, items))}
        </>
      )}

      {/* ── Fallback CTA Banner ── */}
      <View style={styles.fallbackBanner}>
        <Row align="center" style={{ flex: 1 }}>
          <View style={styles.fallbackIconWrap}>
            <Ionicons name="construct" size={28} color={CHARCOAL} />
            <View style={styles.speechBubble}><Txt maxFontSizeMultiplier={1.3} style={{ fontSize: 8, fontWeight: '700', color: PRIMARY }}>...</Txt></View>
          </View>
          <Col style={{ flex: 1, paddingLeft: 12, paddingRight: 8 }}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.fallbackTitle}>Can't find what you need?</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.fallbackSub}>Tell us what's wrong and we'll find the right service.</Txt>
          </Col>
          <AnimatedPress accessibilityRole="button" style={styles.requestBtn} onPress={() => setShowCustomRequest(true)}>
            <Ionicons name="add" size={16} color={SURFACE} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.requestBtnText}>Request a Service</Txt>
          </AnimatedPress>
        </Row>
      </View>
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Active & Past Requests</Txt>
      <Spacer size={12} />
      <View style={styles.emptyLegacyCard}><Txt maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No active bookings.</Txt></View>
    </ScrollView>
  );

  const renderProcurement = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Procurement & Supplies</Txt>
      <Spacer size={12} />
      <AnimatedPress accessibilityRole="button" style={styles.legacyCard} onPress={() => { router.push('/procurement'); }}>
        <Row justify="space-between" align="center" gap={8}>
          <Row gap={12} align="center" style={{ flex: 1, minWidth: 0 }}>
            <Ionicons name="cube-outline" size={24} color={MUTED} />
            <Col style={{ flex: 1, minWidth: 0 }}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.legacyId}>View All Orders</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.legacyCategory}>{pendingCount} pending approvals</Txt>
            </Col>
          </Row>
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </Row>
      </AnimatedPress>

      {pendingOrders.length > 0 && (
        <>
          <Spacer size={24} />
          <Txt maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, { fontSize: 16 }]}>Pending Approvals</Txt>
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
        <Txt maxFontSizeMultiplier={1.3} style={[styles.sectionTitle, { fontSize: 16 }]}>Daily Subscriptions</Txt>
        <AnimatedPress accessibilityRole="button" onPress={() => setShowAddSubscription(true)}>
          <Txt maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '700', color: PRIMARY }}>+ Add</Txt>
        </AnimatedPress>
      </Row>
      <Spacer size={12} />
      {subscriptions.length === 0 ? (
        <View style={styles.emptyLegacyCard}><Txt maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No standing grocery orders yet.</Txt></View>
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
              onPress={() => setTogglingSub({ id: sub.id, label: sub.delivery_note || 'Standing order', active: sub.is_active })}
              first={i === 0}
              last={i === subscriptions.length - 1}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderTechnician = () => (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24, paddingHorizontal: 20 }]} showsVerticalScrollIndicator={false}>
      <Row justify="space-between" align="center">
        <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Technician Services</Txt>
        <AnimatedPress accessibilityRole="button" onPress={() => setShowBookRepairSheet(true)}>
          <Txt maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '700', color: PRIMARY }}>+ Book Repair</Txt>
        </AnimatedPress>
      </Row>
      <Spacer size={12} />
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
        <View style={styles.emptyLegacyCard}><Txt maxFontSizeMultiplier={1.3} style={styles.emptyLegacyText}>No active repairs.</Txt></View>
      ) : (
        <View>
          {repairs.map((rep, i) => {
            const done = rep.finalCost != null;
            return (
              <ListRow
                key={rep.id}
                title={`Request #${rep.id.slice(0, 4)}`}
                meta={
                  done
                    ? `${rep.category} · tap for the invoice`
                    : `${rep.category} · ₹${rep.estimatedCost || 0} visit fee`
                }
                leading={<Ionicons name="construct-outline" size={17} color={Colors.primary} />}
                amount={done ? formatINR(rep.finalCost!) : undefined}
                status={{ label: rep.status, tone: toneFor(rep.status) }}
                onPress={() => (done ? shareRepairInvoice(rep) : setCompleting(rep))}
                first={i === 0}
                last={i === repairs.length - 1}
                testID={`repair_${rep.id}`}
              />
            );
          })}
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
          <HeaderChip icon="notifications" label="Notifications" badge onPress={() => { router.push('/notifications'); }} />
        }
      />

      {/* ── Main Content Area ── */}
      <View style={styles.mainSheet}>
        {/* Search */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <SearchField
            placeholder="Search for a service"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {activeSubTab === 'SERVICES' && renderServices()}
        {activeSubTab === 'BOOKINGS' && renderBookings()}
        {activeSubTab === 'PROCUREMENT' && renderProcurement()}
        {activeSubTab === 'TECHNICIAN' && renderTechnician()}

        {/* ── Sub Navigation Bar ── */}
        <View style={[styles.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('SERVICES'); }}>
            <Ionicons name={activeSubTab === 'SERVICES' ? "grid" : "grid-outline"} size={22} color={activeSubTab === 'SERVICES' ? PRIMARY : MUTED} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'SERVICES' && styles.navTabTextActive]}>Services</Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('BOOKINGS'); }}>
            <Ionicons name={activeSubTab === 'BOOKINGS' ? "calendar" : "calendar-outline"} size={22} color={activeSubTab === 'BOOKINGS' ? PRIMARY : MUTED} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'BOOKINGS' && styles.navTabTextActive]}>Bookings</Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('PROCUREMENT'); }}>
            <Ionicons name={activeSubTab === 'PROCUREMENT' ? "cube" : "cube-outline"} size={22} color={activeSubTab === 'PROCUREMENT' ? PRIMARY : MUTED} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'PROCUREMENT' && styles.navTabTextActive]}>Supplies</Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.navTab} onPress={() => { setActiveSubTab('TECHNICIAN'); }}>
            <Ionicons name={activeSubTab === 'TECHNICIAN' ? "build" : "build-outline"} size={22} color={activeSubTab === 'TECHNICIAN' ? PRIMARY : MUTED} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.navTabText, activeSubTab === 'TECHNICIAN' && styles.navTabTextActive]}>Technician</Txt>
          </AnimatedPress>
        </View>
      </View>

      {/* Service Detail Modal */}
      {selectedService && <ServiceDetailModal service={selectedService} onDismiss={() => setSelectedService(null)} />}
      {showCustomRequest && anything && <ServiceDetailModal service={anything} onDismiss={() => setShowCustomRequest(false)} />}
      {/* Closing out a repair. The charge is captured here rather than on a separate screen
          because it is known at exactly this moment — the technician has finished and said
          what it came to. The server writes it in the same statement as the resolution, so a
          resolved repair and its charge can never disagree. */}
      <PGowDialog
        visible={!!completing}
        title={completing ? `Complete ${completing.issueTitle || 'this repair'}?` : ''}
        message={
          completing
            ? `Booked with a ₹${completing.estimatedCost} visit fee. Enter what the work actually came to — this is the figure the invoice will show.`
            : undefined
        }
        confirmLabel={resolveRepair.isPending ? 'Saving…' : 'Mark complete'}
        busy={resolveRepair.isPending}
        prompt={{
          label: 'Final amount (₹)',
          placeholder: 'e.g. 900',
          required: true,
          requiredMessage: 'Enter what the work cost.',
          helper: 'The visit fee is kept separately — this is the job total.',
        }}
        onConfirm={async (value) => {
          if (!completing) return;
          const finalAmount = Number(String(value).replace(/[^0-9.]/g, ''));
          if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
            toast('error', 'Enter a valid amount', 'The charge must be more than zero.');
            return;
          }
          try {
            await resolveRepair.mutateAsync({ id: completing.id, finalAmount });
            setCompleting(null);
            toast('success', 'Repair completed', 'The invoice is ready on this request.');
          } catch (err) {
            toast('error', 'Could not complete', err instanceof Error ? err.message : 'Please try again.');
          }
        }}
        onCancel={() => setCompleting(null)}
        testID="repair_complete"
      />

      {showAddSubscription && <AddPgDailySubscriptionDialog onDismiss={() => setShowAddSubscription(false)} />}
      <BookRepairSheet visible={showBookRepairSheet} onDismiss={() => setShowBookRepairSheet(false)} />

      <PGowDialog
        visible={togglingSub != null}
        title={togglingSub?.active ? `Pause ${togglingSub.label}?` : `Resume ${togglingSub?.label ?? 'this order'}?`}
        message={togglingSub?.active
          ? 'It stops delivering until you turn it back on. Nothing already ordered is affected.'
          : 'It starts delivering again on its usual schedule.'}
        confirmLabel={togglingSub?.active ? 'Pause' : 'Resume'}
        busy={setSubscriptionActive.isPending}
        onConfirm={() => {
          const sub = togglingSub;
          setTogglingSub(null);
          if (sub) setSubscriptionActive.mutate({ id: sub.id, active: !sub.active });
        }}
        onCancel={() => setTogglingSub(null)}
      />
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
  const { activePgId } = useAuthStore();
  const book = useBookServiceMutation(activePgId ?? undefined);
  const toast = useToast();
  const [time, setTime] = useState(TIME_SLOT_OPTIONS[1]);

  // Success only once the server has it. This used to flip to "Request created" before the
  // request was even sent, so a failed booking still told the owner it went through.
  const handleBook = () => {
    book.mutate(
      { serviceId: service.id, note: `Preferred time: ${time}` },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(onDismiss, 2500);
        },
        onError: (err) =>
          toast('error', 'Not booked', err instanceof Error ? err.message : 'The booking was not saved.'),
      },
    );
  };

  return (
    <Sheet
      visible
      title={success ? 'Request created' : service.name}
      subtitle={success ? 'PGow is assigning a technician.' : service.description}
      accent={success ? Colors.success : PRIMARY}
      icon={success ? 'checkmark-circle' : 'construct'}
      onDismiss={success ? () => { } : onDismiss}
      footer={!success ? (
        <Btn
          onPress={handleBook}
          loading={book.isPending}
          containerColor={PRIMARY}
          textColor={SURFACE}
          borderRadius={Radii.control}
          height={48}
          style={{ width: '100%' }}
        >
          <Txt variant="button" color={SURFACE}>Book service</Txt>
        </Btn>
      ) : undefined}
    >
      {/* The service's own artwork, above everything. Hidden on the success state — by then
          the sheet is a receipt for a booking, not a description of a service. */}
      {!success && serviceArt(service) ? (
        <Image
          source={serviceArt(service)!}
          style={styles.serviceHero}
          resizeMode="contain"
          // The picture repeats the title above it, so a reader hears it twice otherwise.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}

      {success ? (
        <View style={styles.successBox}>
          <Row justify="space-between" style={{ marginBottom: 6 }}>
            <Txt variant="body" color={MUTED}>Service</Txt>
            <Txt variant="body" weight="600" color={CHARCOAL}>{service.name}</Txt>
          </Row>
          <Row justify="space-between" style={{ marginBottom: 6 }}>
            <Txt variant="body" color={MUTED}>Time</Txt>
            <Txt variant="body" weight="600" color={CHARCOAL}>{time}</Txt>
          </Row>
          <Row justify="space-between">
            <Txt variant="body" color={MUTED}>Status</Txt>
            <Txt variant="body" weight="600" color={CHARCOAL}>Assigning technician</Txt>
          </Row>
        </View>
      ) : (
        <>
          <Txt variant="sectionTitle" color={CHARCOAL}>Common problems</Txt>
          <Spacer size={8} />
          {service.problems.map((prob, i) => (
            <Row key={i} gap={8} align="center" style={{ marginBottom: 6 }}>
              <Ionicons name="alert-circle-outline" size={14} color={MUTED} />
              <Txt variant="body" color={CHARCOAL}>{prob}</Txt>
            </Row>
          ))}

          <Spacer size={16} />

          <Txt variant="sectionTitle" color={CHARCOAL}>What's included</Txt>
          <Spacer size={8} />
          {service.includes.map((inc, i) => (
            <Row key={i} gap={8} align="center" style={{ marginBottom: 6 }}>
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
              <Txt variant="body" color={CHARCOAL}>{inc}</Txt>
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
            columns={2}
            testID="service_time"
          />

          <Spacer size={16} />

          <View style={styles.bookingBox}>
            <Row justify="space-between" align="center">
              <Txt variant="meta" color={MUTED}>Estimated charges</Txt>
              <Txt variant="sectionTitle" color={CHARCOAL} tabular>{formatINR(Number(service.visit_fee))}</Txt>
            </Row>
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  mainSheet: { flex: 1, backgroundColor: BG },


  scroll: { paddingBottom: 100 },

  sectionContainer: { marginTop: 24 },
  sectionHeaderRow: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: CHARCOAL },

  horizontalScroll: { paddingHorizontal: 20, gap: 12 },
  gridContainer: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', rowGap: 24, columnGap: '3%' },

  serviceCard: { width: '31%', backgroundColor: 'transparent' },
  serviceIconFrame: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderRadius: Radii.control, marginBottom: 12, zIndex: 1 },
  serviceImage: { width: '90%', height: '90%', resizeMode: 'contain' },

  addButton: { position: 'absolute', bottom: -12, right: 12, width: 28, height: 28, borderRadius: Radii.badge, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', shadowColor: CHARCOAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: BORDER },

  // `contain` on a fixed height, not a fixed aspect ratio: the set mixes 378x250 and 250x250,
  // so a ratio that suited one would letterbox or crop the other.
  serviceHero: {
    width: '100%',
    height: 150,
    borderRadius: Radii.card,
    backgroundColor: Colors.surfaceMuted,
    marginBottom: 14 },
  serviceName: { fontSize: 12, fontWeight: '700', color: CHARCOAL, marginBottom: 2 },
  // Two lines at normal scale, more when the reader's font is larger — a hard 28 clipped the
  // second line's descenders and cut a third line off entirely.
  serviceDesc: { fontSize: 11, color: MUTED, lineHeight: 14, marginTop: 2, minHeight: 28 },
  visitFeeText: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 2 },

  fallbackBanner: { flexDirection: 'row', backgroundColor: Palette.TintGreen, borderRadius: Radii.card, padding: 16, marginHorizontal: 20, marginTop: 24, borderWidth: 1, borderColor: '#D1EAE0' },
  fallbackIconWrap: { position: 'relative' },
  speechBubble: { position: 'absolute', top: -4, right: -12, backgroundColor: SURFACE, paddingHorizontal: 4, paddingVertical: 2, borderRadius: Radii.control, borderWidth: 1, borderColor: '#D1EAE0' },
  fallbackTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  fallbackSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  requestBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.control },
  requestBtnText: { fontSize: 12, fontWeight: '700', color: SURFACE, marginLeft: 4 },

  legacyCard: { backgroundColor: SURFACE, borderRadius: Radii.card, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  legacyId: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  legacyCategory: { fontSize: 13, color: MUTED, marginTop: 2 },
  emptyLegacyCard: { backgroundColor: BG, borderRadius: Radii.card, padding: 20, alignItems: 'center' },
  emptyLegacyText: { fontSize: 13, color: MUTED },

  bookingBox: { backgroundColor: BG, borderRadius: Radii.card, padding: 16, borderWidth: 1, borderColor: BORDER },
  successBox: { width: '100%', backgroundColor: BG, borderRadius: Radii.card, padding: 16, marginTop: 16 },

  bottomNavBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: SURFACE, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navTabText: { fontSize: 10, fontWeight: '600', color: MUTED, marginTop: 4 },
  navTabTextActive: { color: PRIMARY, fontWeight: '700' }
});
