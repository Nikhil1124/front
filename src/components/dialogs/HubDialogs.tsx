/**
 * HubDialogs — AddPgDailySubscriptionDialog + BookRepairDialog
 * Ported to the Cyber Indigo theme.
 */
import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useProcurementCatalog } from '@/features/procurement/useProcurement';
import { useCreateSubscriptionMutation } from '@/features/subscriptions/useSubscriptions';
import { formatINR } from '@/utils/format';
import { AnimatedPress, Btn, Chip, ChoiceChips, Col, Row, Sheet, Spacer, Txt } from '@/components/ui';

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
          <Txt variant="button" color={Colors.textInverse}>Activate daily subscription</Txt>
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

          <Txt variant="meta" weight="600" color={Colors.textMuted}>Delivery Time</Txt>
          <Spacer size={6} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {DELIVERY_SLOTS.map(([label, value]) => (
              <Chip key={value} label={label} selected={deliverAt === value} onPress={() => setDeliverAt(value)} />
            ))}
          </Row>
          <Spacer size={12} />

          <Txt variant="meta" weight="600" color={Colors.textMuted}>Items — from the real Supply catalog</Txt>
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
                        <Txt variant="cardTitle" color={Colors.textPrimary}>{item.itemName}</Txt>
                        <Txt variant="meta" color={Colors.textMuted} tabular>{item.unit} • {formatINR(item.defaultPrice)}</Txt>
                      </Col>
                      <Row gap={8} align="center">
                        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Decrease quantity" accessibilityRole="button" onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}>
                          <Ionicons name="remove" size={14} color={Colors.textPrimary} />
                        </AnimatedPress>
                        <Txt variant="body" weight="600" color={Colors.primaryDark} tabular>{qty}</Txt>
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
            <Txt variant="meta" weight="600" color={Colors.textMuted}>Estimated Daily Cost</Txt>
            <Txt variant="metric" color={Colors.primaryDark} tabular>{formatINR(estimatedDailyCost)}</Txt>
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

  const handleDispatch = () => {
    // No price is quoted here any more. This used to send a flat rate off a hardcoded map
    // (Plumbing 399, Electrical 449, AC 799, everything else 499) that nothing in the product
    // configures and no screen ever displays — it went straight onto the ticket's `amount`,
    // so the owner's repair tickets carried an invented figure while the resident's identical
    // ones (book-technician.tsx) correctly carried none. What a repair costs is known when
    // someone has looked at it, and that is when the amount should be set.
    const finalIssue = issue.trim() || `Request for ${category} service`;
    // Pass custom schedule details inside the request summary if scheduled
    const urgencyLabel = urgency === '15-Min Express' ? '15-Min Express' : `Scheduled for ${schedDate} at ${schedTime}`;
    bookRepair(category, finalIssue, urgencyLabel);
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
            <Txt variant="button" color={Colors.textInverse}>
              {urgency === '15-Min Express' ? 'Request express repair' : 'Request repair'}
            </Txt>
          </AnimatedPress>
        }
      >

              {/* Step 1: What needs repair */}
              <Txt variant="cardTitle" color={Colors.textPrimary}>1. What needs repair?</Txt>
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
                      <Txt
                        variant="button"
                        color={isSelected ? Colors.textInverse : Colors.textPrimary}
                      >
                        {cat}
                      </Txt>
                    </AnimatedPress>
                  );
                })}
              </View>

              <Spacer size={16} />

              {/* Step 2: What's the issue */}
              <Txt variant="cardTitle" color={Colors.textPrimary}>2. What's the issue?</Txt>
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
              <Txt variant="cardTitle" color={Colors.textPrimary}>3. When do you need help?</Txt>
              <Spacer size={8} />
              <Row gap={10}>
                <AnimatedPress accessibilityRole="button"
                  style={[
                    styles.urgencyBtn,
                    urgency === '15-Min Express' && styles.urgencyBtnActive,
                  ]}
                  onPress={() => setUrgency('15-Min Express')}
                >
                  <Txt
                    variant="button"
                    color={urgency === '15-Min Express' ? DIALOG_GREEN : DIALOG_MUTED}
                  >
                    Express · 15 min
                  </Txt>
                </AnimatedPress>
                <AnimatedPress accessibilityRole="button"
                  style={[
                    styles.urgencyBtn,
                    urgency === 'Scheduled Today' && styles.urgencyBtnActive,
                  ]}
                  onPress={() => setUrgency('Scheduled Today')}
                >
                  <Txt
                    variant="button"
                    color={urgency === 'Scheduled Today' ? DIALOG_GREEN : DIALOG_MUTED}
                  >
                    Schedule
                  </Txt>
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
                    columns={3}
                    value={schedDate}
                    onChange={setSchedDate}
                    testID="repair_date"
                  />
                  <Spacer size={12} />
                  <ChoiceChips
                    label="Time"
                    options={TIME_SLOTS}
                    columns={2}
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
                <Txt variant="meta" weight="600" color={DIALOG_GREEN} style={styles.etaText}>
                  {urgency === '15-Min Express'
                    ? 'Technician will be at your PG in approximately 15 minutes.'
                    : 'You can schedule up to 7 days in advance.'}
                </Txt>
              </Row>

              <Spacer size={12} />
              <Row gap={6} justify="center" align="center" style={styles.securityRow}>
                <Ionicons name="lock-closed-outline" size={12} color={DIALOG_MUTED} />
                <Txt variant="meta" color={DIALOG_MUTED}>Your request is secure and confidential</Txt>
              </Row>
      </Sheet>

    </>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E6EFEA' },
  categoryChipSelected: {
    backgroundColor: DIALOG_GREEN,
    borderColor: DIALOG_GREEN },
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
    backgroundColor: Colors.surface },
  urgencyBtnActive: {
    borderColor: DIALOG_GREEN,
    backgroundColor: DIALOG_LIGHT_GREEN,
    borderWidth: 1.5 },
  // ETA strip
  etaStrip: {
    backgroundColor: DIALOG_LIGHT_GREEN,
    borderRadius: Radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10 },
  etaText: { flex: 1 },

  // Submit
  sheetSubmitBtn: {
    height: 52,
    backgroundColor: DIALOG_GREEN,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center' },
  // Security info
  securityRow: { marginTop: 4 },

  // Picker dropdowns

  // Picker popup modals
});
