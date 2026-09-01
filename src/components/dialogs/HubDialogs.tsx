/**
 * HubDialogs — AddPgDailySubscriptionDialog + BookRepairDialog + GuestLaundryBookingDialog
 * Ported to the Cyber Indigo theme.
 */
import { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, dialogEntering, dialogExiting, Motion } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

// ===== AddPgDailySubscriptionDialog =====
export function AddPgDailySubscriptionDialog({ onDismiss }: { onDismiss: () => void }) {
  const addSub = usePGowStore((s) => s.addPgDailyGrocerySubscription);
  const [title, setTitle] = useState('Morning Mess Essentials');
  const [items, setItems] = useState('10L Full Cream Milk, 50 Eggs, 10 Breads');
  const [time, setTime] = useState('06:30 AM');
  const [costStr, setCostStr] = useState('1250');

  const handleSave = () => {
    const cost = parseFloat(costStr) || 1000;
    addSub(title, items, time, cost);
    Alert.alert('Success', 'Daily Auto-Subscription Activated!');
    onDismiss();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'padding' : undefined}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={{ width: '92%', zIndex: 2 }}>
          <Card
            containerColor={Colors.surface}
            borderRadius={24}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[20, 20]}
            style={{ width: '100%' }}
          >
          <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Row gap={8} align="center">
              <Txt size={18}>🔄</Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary}>Daily Grocery Auto-Order</Txt>
            </Row>
            <IconBtn onPress={onDismiss} icon="close" size={18} tint={Colors.textMuted} />
          </Row>

          <OutlinedTextField
            label="Subscription Title"
            value={title}
            onChangeText={setTitle}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 8 }}
          />
          <OutlinedTextField
            label="Daily Grocery Items List"
            value={items}
            onChangeText={setItems}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 8 }}
          />
          <OutlinedTextField
            label="Delivery Time Slot (e.g. 06:30 AM)"
            value={time}
            onChangeText={setTime}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 8 }}
          />
          <OutlinedTextField
            label="Est. Daily Cost (₹)"
            value={costStr}
            onChangeText={setCostStr}
            keyboardType="number-pad"
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 16 }}
          />

          <Btn
            onPress={handleSave}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={12}
            height={44}
          >
            <Txt variant="body" weight="800" color={Colors.textInverse}>Activate Daily Subscription</Txt>
          </Btn>
        </Card>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
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
const DIALOG_BG = Colors.canvas;
const DIALOG_CHARCOAL = Colors.textPrimary;
const DIALOG_MUTED = Colors.textMuted;
const DIALOG_BORDER = Colors.borderSubtle;
const DIALOG_WHITE = Colors.surface;
const DIALOG_LIGHT_GREEN = Colors.surfaceElevated;

export function BookRepairDialog({ onDismiss }: { onDismiss: () => void }) {
  const bookRepair = usePGowStore((s) => s.bookPgRepairService);
  const [category, setCategory] = useState('Plumbing');
  const [issue, setIssue] = useState('');
  const [urgency, setUrgency] = useState('15-Min Express'); // Maps to backend '15-Min Express' or 'Scheduled Today'

  // Scheduled date/time picker state
  const [schedDate, setSchedDate] = useState('19 Aug 2026');
  const [schedTime, setSchedTime] = useState('11:30 AM - 12:00 PM');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
      <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'padding' : undefined}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
            
            <View
              style={styles.sheetCard}
            >
              {/* Handlebar */}
              <View style={styles.handlebar} />

              {/* Header */}
              <Row justify="space-between" align="center" style={{ marginBottom: 20 }}>
                <Row gap={12} align="center">
                  <View style={styles.headerIconCircle}>
                    <Ionicons name="construct-outline" size={20} color={DIALOG_GREEN} />
                  </View>
                  <Col>
                    <Text style={styles.sheetTitle}>Book a Repair</Text>
                    <Text style={styles.sheetSubtitle}>Tell us what needs fixing</Text>
                  </Col>
                </Row>
                <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={DIALOG_MUTED} />
                </TouchableOpacity>
              </Row>

              {/* Step 1: What needs repair */}
              <Text style={styles.stepTitle}>1. What needs repair?</Text>
              <Spacer size={8} />
              <View style={styles.chipsRow}>
                {REPAIR_CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Spacer size={16} />

              {/* Step 2: What's the issue */}
              <Text style={styles.stepTitle}>2. What's the issue?</Text>
              <Spacer size={8} />
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={styles.textArea}
                  value={issue}
                  onChangeText={(v) => {
                    if (v.length <= 250) setIssue(v);
                  }}
                  placeholder="Describe the problem briefly..."
                  placeholderTextColor={DIALOG_MUTED}
                  multiline
                  numberOfLines={4}
                  maxLength={250}
                  textAlignVertical="top"
                />
                <Text style={styles.charCounter}>{issue.length}/250</Text>
              </View>

              <Spacer size={16} />

              {/* Step 3: When do you need help */}
              <Text style={styles.stepTitle}>3. When do you need help?</Text>
              <Spacer size={8} />
              <Row gap={10}>
                <TouchableOpacity
                  style={[
                    styles.urgencyBtn,
                    urgency === '15-Min Express' && styles.urgencyBtnActive,
                  ]}
                  onPress={() => setUrgency('15-Min Express')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.urgencyBtnText,
                      urgency === '15-Min Express' && styles.urgencyBtnTextActive,
                    ]}
                  >
                    Express · 15 min
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.urgencyBtn,
                    urgency === 'Scheduled Today' && styles.urgencyBtnActive,
                  ]}
                  onPress={() => setUrgency('Scheduled Today')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.urgencyBtnText,
                      urgency === 'Scheduled Today' && styles.urgencyBtnTextActive,
                    ]}
                  >
                    Schedule
                  </Text>
                </TouchableOpacity>
              </Row>

              {/* Conditional Date & Time Selectors */}
              {urgency === 'Scheduled Today' && (
                <>
                  <Spacer size={12} />
                  <Row gap={10}>
                    {/* Date Selector */}
                    <TouchableOpacity
                      style={styles.pickerDropdown}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pickerLabel}>Date</Text>
                      <Row justify="space-between" align="center" style={{ flex: 1 }}>
                        <Row gap={6} align="center">
                          <Ionicons name="calendar-outline" size={15} color={DIALOG_GREEN} />
                          <Text style={styles.pickerValue}>{schedDate}</Text>
                        </Row>
                        <Ionicons name="chevron-down" size={14} color={DIALOG_MUTED} />
                      </Row>
                    </TouchableOpacity>

                    {/* Time Selector */}
                    <TouchableOpacity
                      style={styles.pickerDropdown}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pickerLabel}>Time</Text>
                      <Row justify="space-between" align="center" style={{ flex: 1 }}>
                        <Row gap={6} align="center">
                          <Ionicons name="time-outline" size={15} color={DIALOG_GREEN} />
                          <Text style={styles.pickerValue}>{schedTime}</Text>
                        </Row>
                        <Ionicons name="chevron-down" size={14} color={DIALOG_MUTED} />
                      </Row>
                    </TouchableOpacity>
                  </Row>
                </>
              )}

              <Spacer size={12} />

              {/* Warning / ETA strip */}
              <Row gap={8} align="center" style={styles.etaStrip}>
                <Ionicons name={urgency === '15-Min Express' ? 'time-outline' : 'calendar-clear-outline'} size={16} color={DIALOG_GREEN} />
                <Text style={styles.etaText}>
                  {urgency === '15-Min Express'
                    ? 'Technician will be at your PG in approximately 15 minutes.'
                    : 'You can schedule up to 7 days in advance.'}
                </Text>
              </Row>

              <Spacer size={20} />

              {/* CTA Button */}
              <TouchableOpacity
                style={styles.sheetSubmitBtn}
                onPress={handleDispatch}
                activeOpacity={0.85}
              >
                <Text style={styles.sheetSubmitBtnText}>
                  {urgency === '15-Min Express' ? 'Request Express Repair' : 'Request Repair'}
                </Text>
              </TouchableOpacity>

              <Spacer size={12} />
              
              {/* Security Disclaimer */}
              <Row gap={6} justify="center" align="center" style={styles.securityRow}>
                <Ionicons name="lock-closed-outline" size={12} color={DIALOG_MUTED} />
                <Text style={styles.securityText}>Your request is secure and confidential</Text>
              </Row>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Dropdown Popup Modal */}
      {showDatePicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.pickerPopupBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDatePicker(false)} />
            <View style={styles.pickerPopupCard}>
              <Text style={styles.pickerPopupTitle}>Select Date</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10, maxHeight: 220 }}>
                {getNext7Days().map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.pickerPopupOption, schedDate === d && styles.pickerPopupOptionActive]}
                    onPress={() => { setSchedDate(d); setShowDatePicker(false); }}
                  >
                    <Text style={[styles.pickerPopupOptionText, schedDate === d && styles.pickerPopupOptionTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Time Dropdown Popup Modal */}
      {showTimePicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
          <View style={styles.pickerPopupBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTimePicker(false)} />
            <View style={styles.pickerPopupCard}>
              <Text style={styles.pickerPopupTitle}>Select Time Slot</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10, maxHeight: 220 }}>
                {TIME_SLOTS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pickerPopupOption, schedTime === t && styles.pickerPopupOptionActive]}
                    onPress={() => { setSchedTime(t); setShowTimePicker(false); }}
                  >
                    <Text style={[styles.pickerPopupOptionText, schedTime === t && styles.pickerPopupOptionTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ===== GuestLaundryBookingDialog =====
const LAUNDRY_RATES: Record<string, number> = {
  'Wash & Fold': 39, 'Wash & Iron': 59, 'Dry Cleaning': 149, 'Shoe Care': 199,
};

export function GuestLaundryBookingDialog({ guestId, guestName, roomNo, onDismiss }: { guestId: string; guestName: string; roomNo: string; onDismiss: () => void }) {
  const bookLaundry = usePGowStore((s) => s.bookGuestLaundryService);
  const [service, setService] = useState('Wash & Fold');
  const [weight, setWeight] = useState('5 kg');
  const [pickupPref] = useState('Room Doorstep Pickup');
  const [slot, setSlot] = useState('Morning (8 AM - 10 AM)');
  const [notes, setNotes] = useState('');
  const [payMode, setPayMode] = useState('Added to Room Bill');

  const multiplier = weight.includes('10') ? 2 : weight.includes('15') ? 3 : 1;
  const est = (LAUNDRY_RATES[service] ?? 40) * multiplier;

  const handleBook = () => {
    bookLaundry(guestId, guestName, roomNo, service, weight, pickupPref, slot, notes, est, payMode);
    Alert.alert('Success', 'Laundry Pickup Scheduled Successfully!');
    onDismiss();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'padding' : undefined}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={{ width: '92%', zIndex: 2 }}>
          <Card
            containerColor={Colors.surface}
            borderRadius={24}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[20, 20]}
            style={{ width: '100%' }}
          >
          <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
            <Row gap={8} align="center">
              <Txt size={18}>🧺</Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary}>Doorstep Laundry</Txt>
            </Row>
            <IconBtn onPress={onDismiss} icon="close" size={18} tint={Colors.textMuted} />
          </Row>
          <Txt variant="caption" weight="800" color={Colors.primaryDark}>Room {roomNo} • {guestName}</Txt>
          <Spacer size={12} />

          <Txt variant="caption" weight="800" color={Colors.textMuted}>Select Service Type</Txt>
          <Spacer size={6} />
          <View style={{ gap: 6 }}>
            {Object.entries(LAUNDRY_RATES).map(([srv, rate]) => (
              <TouchableOpacity
                key={srv}
                onPress={() => setService(srv)}
                style={[
                  styles.laundryOpt,
                  {
                    borderColor: service === srv ? Colors.primary : Colors.borderSubtle,
                    backgroundColor: service === srv ? DIALOG_LIGHT_GREEN : Colors.surfaceMuted,
                  },
                ]}
              >
                <Row justify="space-between" align="center">
                  <Txt variant="caption" weight="800" color={Colors.textPrimary}>{srv}</Txt>
                  <Txt size={11} weight="900" color={Colors.primaryDark}>
                    ₹{rate}{srv.includes('Shoe') ? '/pair' : srv.includes('Dry') ? '/pc' : '/kg'}
                  </Txt>
                </Row>
              </TouchableOpacity>
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
                borderRadius={8}
                height={34}
                style={{ flex: 1 }}
              >
                <Txt variant="caption" weight="800" color={weight === w ? Colors.textInverse : Colors.textPrimary}>{w}</Txt>
              </Btn>
            ))}
          </Row>
          <Spacer size={12} />

          <OutlinedTextField
            label="Special Instructions (Optional)"
            placeholder="Wash shirts separately"
            value={notes}
            onChangeText={setNotes}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 12 }}
          />

          <Row justify="space-between" align="center">
            <Col>
              <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>Estimated Total</Txt>
              <Txt variant="sectionTitle" weight="900" color={Colors.primaryDark}>₹{est}</Txt>
            </Col>
            <Btn
              onPress={handleBook}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={44}
            >
              <Txt variant="caption" weight="800" color={Colors.textInverse}>Confirm Pickup</Txt>
            </Btn>
          </Row>
        </Card>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.55)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  laundryOpt: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },

  // Bottom Sheet
  sheetCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  handlebar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E6EFEA',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: DIALOG_LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#17201A' },
  sheetSubtitle: { fontSize: 13, color: '#66736B', marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontSize: 14, fontWeight: '700', color: '#17201A' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EFEA',
  },
  categoryChipSelected: {
    backgroundColor: DIALOG_GREEN,
    borderColor: DIALOG_GREEN,
  },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#17201A' },
  categoryChipTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  // Textarea
  textAreaContainer: {
    borderWidth: 1,
    borderColor: '#E6EFEA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  textArea: { fontSize: 14, color: '#17201A', height: 74, paddingVertical: 0 },
  charCounter: { fontSize: 11, color: '#66736B', textAlign: 'right' },

  // Urgency selector
  urgencyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  urgencyBtnActive: {
    borderColor: DIALOG_GREEN,
    backgroundColor: DIALOG_LIGHT_GREEN,
    borderWidth: 1.5,
  },
  urgencyBtnText: { fontSize: 13, fontWeight: '600', color: '#66736B' },
  urgencyBtnTextActive: { color: DIALOG_GREEN, fontWeight: '800' },

  // ETA strip
  etaStrip: {
    backgroundColor: DIALOG_LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  etaText: { fontSize: 12, color: DIALOG_GREEN, fontWeight: '600', flex: 1, lineHeight: 16 },

  // Submit
  sheetSubmitBtn: {
    height: 52,
    backgroundColor: DIALOG_GREEN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSubmitBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  // Security info
  securityRow: { marginTop: 4 },
  securityText: { fontSize: 11, color: '#66736B', marginLeft: 4 },

  // Picker dropdowns
  pickerDropdown: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EFEA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#66736B',
    marginBottom: 2,
  },
  pickerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17201A',
  },

  // Picker popup modals
  pickerPopupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerPopupCard: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EFEA',
    padding: 18,
  },
  pickerPopupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17201A',
    marginBottom: 8,
  },
  pickerPopupOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAF7',
  },
  pickerPopupOptionActive: {
    backgroundColor: DIALOG_LIGHT_GREEN,
  },
  pickerPopupOptionText: {
    fontSize: 13,
    color: '#17201A',
    fontWeight: '500',
  },
  pickerPopupOptionTextActive: {
    color: DIALOG_GREEN,
    fontWeight: '700',
  },
});

