/**
 * HubDialogs — AddPgDailySubscriptionDialog + BookRepairDialog + GuestLaundryBookingDialog
 * Ported to the Cyber Indigo theme.
 */
import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Text } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Txt, Btn, Row, Col, Spacer, Chip, ChoiceChips, AnimatedPress, Sheet } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useProcurementCatalog } from '@/features/procurement/useProcurement';
import { useCreateSubscriptionMutation } from '@/features/subscriptions/useSubscriptions';

// ===== AddPgDailySubscriptionDialog =====
const DELIVERY_SLOTS: Array<[string, string]> = [
  ['06:00 AM', '06:00:00'],
  ['06:30 AM', '06:30:00'],
  ['07:00 AM', '07:00:00'],
  ['07:30 AM', '07:30:00'],
  ['08:00 AM', '08:00:00'],
];

export function AddPgDailySubscriptionDialog({ onDismiss }: { onDismiss: () => void }) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: catalog = [], isLoading: catalogLoading } = useProcurementCatalog();
  const createSubscription = useCreateSubscriptionMutation();

  const [note, setNote] = useState('Morning Mess Essentials');
  const [search, setSearch] = useState('');
  const [deliverAt, setDeliverAt] = useState(DELIVERY_SLOTS[1][1]);
  const [cart, setCart] = useState<Record<string, number>>({});

  const filteredCatalog = catalog.filter((it) =>
    search.trim() === '' || it.itemName.toLowerCase().includes(search.trim().toLowerCase())
  );
  const cartItemCount = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const estimatedDailyCost = Object.entries(cart).reduce((sum, [id, qty]) => {
    const it = catalog.find((c) => c.id === id);
    return sum + (it ? it.defaultPrice * qty : 0);
  }, 0);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!activePgId || cartItemCount === 0) return;
    try {
      await createSubscription.mutateAsync({
        pg_id: activePgId,
        deliver_at: deliverAt,
        payment_method: 'credit',
        delivery_note: note.trim(),
        items: Object.entries(cart).map(([item_id, quantity]) => ({ item_id, quantity })) });
      Alert.alert('Success', 'Daily Auto-Subscription Activated!');
      onDismiss();
    } catch (err: any) {
      Alert.alert('Could not activate', err?.message ?? 'Please try again.');
    }
  };

  return (
    <Sheet
      visible
      title="Daily grocery auto-order"
      icon="refresh"
      onDismiss={onDismiss}
      footer={
        <Btn
          onPress={handleSave}
          loading={createSubscription.isPending}
          disabled={createSubscription.isPending || cartItemCount === 0}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={Radii.card}
          height={44}
        >
          <Txt variant="body" weight="800" color={Colors.textInverse}>Activate daily subscription</Txt>
        </Btn>
      }
    >

          <OutlinedTextField
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 12 }}
          />

          <Txt variant="caption" weight="800" color={Colors.textMuted}>Delivery Time</Txt>
          <Spacer size={6} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {DELIVERY_SLOTS.map(([label, value]) => (
              <Chip key={value} label={label} selected={deliverAt === value} onPress={() => setDeliverAt(value)} />
            ))}
          </Row>
          <Spacer size={12} />

          <Txt variant="caption" weight="800" color={Colors.textMuted}>Items — from the real Supply catalog</Txt>
          <Spacer size={6} />
          <OutlinedTextField
            placeholder="Search items…"
            value={search}
            onChangeText={setSearch}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 8 }}
          />

          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {catalogLoading ? (
              <Txt variant="caption" color={Colors.textMuted} align="center">Loading catalog…</Txt>
            ) : filteredCatalog.length === 0 ? (
              <Txt variant="caption" color={Colors.textMuted} align="center">No items found.</Txt>
            ) : (
              <View style={{ gap: 6 }}>
                {filteredCatalog.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  return (
                    <Row key={item.id} justify="space-between" align="center" style={styles.catalogRow}>
                      <Col style={{ flex: 1 }}>
                        <Txt size={13} weight="800" color={Colors.textPrimary}>{item.itemName}</Txt>
                        <Txt size={11} color={Colors.textMuted}>{item.unit} • ₹{item.defaultPrice}</Txt>
                      </Col>
                      <Row gap={8} align="center">
                        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Decrease quantity" accessibilityRole="button" onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}>
                          <Ionicons name="remove" size={14} color={Colors.textPrimary} />
                        </AnimatedPress>
                        <Txt size={13} weight="900" color={Colors.primaryDark}>{qty}</Txt>
                        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" onPress={() => updateQty(item.id, 1)} style={[styles.qtyBtn, { backgroundColor: Colors.primary }]}>
                          <Ionicons name="add" size={14} color={Colors.textInverse} />
                        </AnimatedPress>
                      </Row>
                    </Row>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <Spacer size={14} />
          <Row justify="space-between" align="center">
            <Txt variant="caption" weight="800" color={Colors.textMuted}>Estimated Daily Cost</Txt>
            <Txt variant="sectionTitle" weight="900" color={Colors.primaryDark}>₹{estimatedDailyCost.toLocaleString('en-IN')}</Txt>
          </Row>
    </Sheet>
  );
}

// ===== BookRepairDialog =====
const REPAIR_CATEGORIES = ['Plumbing', 'Electrical', 'Carpenter', 'AC Repair', 'RO Servicing', 'Pest Control'];

const TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 11:30 AM',
  '11:30 AM - 12:00 PM',
  '12:00 PM - 01:30 PM',
  '02:00 PM - 03:30 PM',
  '04:00 PM - 05:30 PM',
  '06:00 PM - 07:30 PM'
];

function getNext7Days(): string[] {
  const list: string[] = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    list.push(`${day} ${month} ${year}`);
  }
  return list;
}

const DIALOG_GREEN = Colors.primary;
const DIALOG_MUTED = Colors.textMuted;
const DIALOG_LIGHT_GREEN = Colors.surfaceElevated;

export function BookRepairDialog({ onDismiss }: { onDismiss: () => void }) {
  // Bottom sheet inside a Modal: nothing above it pads the gesture bar, and the hardcoded
  // 34px it used to carry was a guess at the home indicator that under-clears gesture nav.
  const bookRepair = usePGowStore((s) => s.bookPgRepairService);
  const [category, setCategory] = useState('Plumbing');
  const [issue, setIssue] = useState('');
  const [urgency, setUrgency] = useState('15-Min Express'); // Maps to backend '15-Min Express' or 'Scheduled Today'

  // Scheduled date/time picker state — defaults to today so an untouched picker never
  // silently books a stale, already-past date (it used to be hardcoded to a fixed string).
  const next7Days = useMemo(() => getNext7Days(), []);
  const [schedDate, setSchedDate] = useState(() => getNext7Days()[0]);
  const [schedTime, setSchedTime] = useState('11:30 AM - 12:00 PM');

  const costMap: Record<string, number> = { Plumbing: 399, Electrical: 449, 'AC Repair': 799 };
  
  const handleDispatch = () => {
    const cost = costMap[category] ?? 499;
    const finalIssue = issue.trim() || `Request for ${category} service`;
    // Pass custom schedule details inside the request summary if scheduled
    const urgencyLabel = urgency === '15-Min Express' ? '15-Min Express' : `Scheduled for ${schedDate} at ${schedTime}`;
    bookRepair(category, finalIssue, urgencyLabel, cost);
    Alert.alert('Success', 'Technician Dispatched!');
    onDismiss();
  };

  return (
    <>
      <Sheet
        visible
        title="Book a repair"
        subtitle="Tell us what needs fixing"
        icon="construct-outline"
        accent={DIALOG_GREEN}
        onDismiss={onDismiss}
        footer={
          <AnimatedPress accessibilityRole="button" style={styles.sheetSubmitBtn} onPress={handleDispatch}>
            <Text maxFontSizeMultiplier={1.3} style={styles.sheetSubmitBtnText}>
              {urgency === '15-Min Express' ? 'Request express repair' : 'Request repair'}
            </Text>
          </AnimatedPress>
        }
      >

              {/* Step 1: What needs repair */}
              <Text maxFontSizeMultiplier={1.3} style={styles.stepTitle}>1. What needs repair?</Text>
              <Spacer size={8} />
              <View style={styles.chipsRow}>
                {REPAIR_CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text maxFontSizeMultiplier={1.3} style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                        {cat}
                      </Text>
                    </AnimatedPress>
                  );
                })}
              </View>

              <Spacer size={16} />

              {/* Step 2: What's the issue */}
              <Text maxFontSizeMultiplier={1.3} style={styles.stepTitle}>2. What's the issue?</Text>
              <Spacer size={8} />
              <OutlinedTextField
                value={issue}
                onChangeText={(v) => {
                  if (v.length <= 250) setIssue(v);
                }}
                placeholder="Describe the problem briefly"
                multiline
                numberOfLines={4}
                maxLength={250}
                helper={`${issue.length}/250`}
              />

              <Spacer size={16} />

              {/* Step 3: When do you need help */}
              <Text maxFontSizeMultiplier={1.3} style={styles.stepTitle}>3. When do you need help?</Text>
              <Spacer size={8} />
              <Row gap={10}>
                <AnimatedPress accessibilityRole="button"
                  style={[
                    styles.urgencyBtn,
                    urgency === '15-Min Express' && styles.urgencyBtnActive,
                  ]}
                  onPress={() => setUrgency('15-Min Express')}
                >
                  <Text maxFontSizeMultiplier={1.3}
                    style={[
                      styles.urgencyBtnText,
                      urgency === '15-Min Express' && styles.urgencyBtnTextActive,
                    ]}
                  >
                    Express · 15 min
                  </Text>
                </AnimatedPress>
                <AnimatedPress accessibilityRole="button"
                  style={[
                    styles.urgencyBtn,
                    urgency === 'Scheduled Today' && styles.urgencyBtnActive,
                  ]}
                  onPress={() => setUrgency('Scheduled Today')}
                >
                  <Text maxFontSizeMultiplier={1.3}
                    style={[
                      styles.urgencyBtnText,
                      urgency === 'Scheduled Today' && styles.urgencyBtnTextActive,
                    ]}
                  >
                    Schedule
                  </Text>
                </AnimatedPress>
              </Row>

              {/* Conditional Date & Time Selectors */}
              {urgency === 'Scheduled Today' && (
                <>
                  <Spacer size={12} />
                  {/* Seven days and seven slots, shown inline. They were two modals over a
                      modal — a dropdown popup opening on top of the dialog you were already
                      filling in, which on Android stacks two dimmed backdrops. */}
                  <ChoiceChips
                    label="Date"
                    options={next7Days}
                    value={schedDate}
                    onChange={setSchedDate}
                    testID="repair_date"
                  />
                  <Spacer size={12} />
                  <ChoiceChips
                    label="Time"
                    options={TIME_SLOTS}
                    value={schedTime}
                    onChange={setSchedTime}
                    render={(t) => t.replace(/:00 /g, '').replace(' - ', '–')}
                    testID="repair_time"
                  />
                </>
              )}

              <Spacer size={12} />

              {/* Warning / ETA strip */}
              <Row gap={8} align="center" style={styles.etaStrip}>
                <Ionicons name={urgency === '15-Min Express' ? 'time-outline' : 'calendar-clear-outline'} size={16} color={DIALOG_GREEN} />
                <Text maxFontSizeMultiplier={1.3} style={styles.etaText}>
                  {urgency === '15-Min Express'
                    ? 'Technician will be at your PG in approximately 15 minutes.'
                    : 'You can schedule up to 7 days in advance.'}
                </Text>
              </Row>

              <Spacer size={12} />
              <Row gap={6} justify="center" align="center" style={styles.securityRow}>
                <Ionicons name="lock-closed-outline" size={12} color={DIALOG_MUTED} />
                <Text maxFontSizeMultiplier={1.3} style={styles.securityText}>Your request is secure and confidential</Text>
              </Row>
      </Sheet>

    </>
  );
}

// ===== GuestLaundryBookingDialog =====
const LAUNDRY_SLOTS = ['Morning (8–10 AM)', 'Afternoon (1–3 PM)', 'Evening (6–8 PM)'];
const LAUNDRY_PAY_MODES = ['Added to Room Bill', 'UPI', 'Cash on Pickup'];

const LAUNDRY_RATES: Record<string, number> = {
  'Wash & Fold': 39, 'Wash & Iron': 59, 'Dry Cleaning': 149, 'Shoe Care': 199 };

export function GuestLaundryBookingDialog({ guestId, guestName, roomNo, onDismiss }: { guestId: string; guestName: string; roomNo: string; onDismiss: () => void }) {
  const bookLaundry = usePGowStore((s) => s.bookGuestLaundryService);
  const [service, setService] = useState('Wash & Fold');
  const [weight, setWeight] = useState('5 kg');
  const [pickupPref] = useState('Room Doorstep Pickup');
  const [slot, setSlot] = useState(LAUNDRY_SLOTS[0]);
  const [notes, setNotes] = useState('');
  const [payMode, setPayMode] = useState(LAUNDRY_PAY_MODES[0]);

  const multiplier = weight.includes('10') ? 2 : weight.includes('15') ? 3 : 1;
  const est = (LAUNDRY_RATES[service] ?? 40) * multiplier;

  const handleBook = () => {
    bookLaundry(guestId, guestName, roomNo, service, weight, pickupPref, slot, notes, est, payMode);
    Alert.alert('Success', 'Laundry Pickup Scheduled Successfully!');
    onDismiss();
  };

  return (
    <Sheet
      visible
      title="Doorstep laundry"
      subtitle={`Room ${roomNo} · ${guestName}`}
      icon="shirt-outline"
      onDismiss={onDismiss}
      footer={
        <Row justify="space-between" align="center">
          <Col>
            <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>Estimated total</Txt>
            <Txt variant="sectionTitle" weight="900" color={Colors.primaryDark}>₹{est}</Txt>
          </Col>
          <Btn
            onPress={handleBook}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.card}
            height={44}
          >
            <Txt variant="caption" weight="800" color={Colors.textInverse}>Confirm pickup</Txt>
          </Btn>
        </Row>
      }
    >

          <Txt variant="caption" weight="800" color={Colors.textMuted}>Select Service Type</Txt>
          <Spacer size={6} />
          <View style={{ gap: 6 }}>
            {Object.entries(LAUNDRY_RATES).map(([srv, rate]) => (
              <AnimatedPress accessibilityRole="button"
                key={srv}
                onPress={() => setService(srv)}
                style={[
                  styles.laundryOpt,
                  {
                    borderColor: service === srv ? Colors.primary : Colors.borderSubtle,
                    backgroundColor: service === srv ? DIALOG_LIGHT_GREEN : Colors.surfaceMuted },
                ]}
              >
                <Row justify="space-between" align="center">
                  <Txt variant="caption" weight="800" color={Colors.textPrimary}>{srv}</Txt>
                  <Txt size={11} weight="900" color={Colors.primaryDark}>
                    ₹{rate}{srv.includes('Shoe') ? '/pair' : srv.includes('Dry') ? '/pc' : '/kg'}
                  </Txt>
                </Row>
              </AnimatedPress>
            ))}
          </View>
          <Spacer size={12} />

          <Txt variant="caption" weight="800" color={Colors.textMuted}>Quantity / Weight</Txt>
          <Row gap={8} style={{ marginTop: 6 }}>
            {['5 kg', '10 kg', '15 kg'].map((w) => (
              <Btn
                key={w}
                onPress={() => setWeight(w)}
                containerColor={weight === w ? Colors.primary : Colors.surfaceMuted}
                textColor={weight === w ? Colors.textInverse : Colors.textPrimary}
                borderRadius={Radii.control}
                height={34}
                style={{ flex: 1 }}
              >
                <Txt variant="caption" weight="800" color={weight === w ? Colors.textInverse : Colors.textPrimary}>{w}</Txt>
              </Btn>
            ))}
          </Row>
          <Spacer size={12} />

          {/* Both of these were fixed values in state with no control attached: every booking
              went out as a morning pickup billed to the room, whatever the resident wanted. */}
          <ChoiceChips
            label="Pickup slot"
            options={LAUNDRY_SLOTS}
            value={slot}
            onChange={setSlot}
            testID="laundry_slot"
          />
          <Spacer size={12} />
          <ChoiceChips
            label="Pay by"
            options={LAUNDRY_PAY_MODES}
            value={payMode}
            onChange={setPayMode}
            testID="laundry_pay_mode"
          />
          <Spacer size={12} />

          <OutlinedTextField
            label="Special Instructions (Optional)"
            placeholder="Wash shirts separately"
            value={notes}
            onChangeText={setNotes}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 12 }}
          />

    </Sheet>
  );
}

const styles = StyleSheet.create({
  laundryOpt: {
    borderRadius: Radii.card,
    borderWidth: 1,
    padding: 10 },
  catalogRow: {
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceMuted,
    padding: 10 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center' },

  // Bottom Sheet
  stepTitle: { fontSize: 14, fontWeight: '700', color: '#17201A' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radii.control,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EFEA' },
  categoryChipSelected: {
    backgroundColor: DIALOG_GREEN,
    borderColor: DIALOG_GREEN },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#17201A' },
  categoryChipTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  // Textarea

  // Urgency selector
  urgencyBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: '#E6EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF' },
  urgencyBtnActive: {
    borderColor: DIALOG_GREEN,
    backgroundColor: DIALOG_LIGHT_GREEN,
    borderWidth: 1.5 },
  urgencyBtnText: { fontSize: 13, fontWeight: '600', color: '#66736B' },
  urgencyBtnTextActive: { color: DIALOG_GREEN, fontWeight: '800' },

  // ETA strip
  etaStrip: {
    backgroundColor: DIALOG_LIGHT_GREEN,
    borderRadius: Radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10 },
  etaText: { fontSize: 12, color: DIALOG_GREEN, fontWeight: '600', flex: 1, lineHeight: 16 },

  // Submit
  sheetSubmitBtn: {
    height: 52,
    backgroundColor: DIALOG_GREEN,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center' },
  sheetSubmitBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  // Security info
  securityRow: { marginTop: 4 },
  securityText: { fontSize: 11, color: '#66736B', marginLeft: 4 },

  // Picker dropdowns

  // Picker popup modals
});

