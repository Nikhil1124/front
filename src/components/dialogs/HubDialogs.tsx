/**
 * HubDialogs — AddPgDailySubscriptionDialog + BookProntoRepairDialog + GuestLaundryBookingDialog
 * Ported to Cyber Mint Light Theme.
 */
import { useState } from 'react';
import { Modal, View, StyleSheet, Alert, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
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
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Card
          containerColor={Colors.surface}
          borderRadius={24}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[20, 20]}
          style={{ width: '92%', zIndex: 2 }}
        >
          <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Row gap={8} align="center">
              <Txt size={18}>🔄</Txt>
              <Txt size={16} weight="900" color={Colors.textPrimary}>Daily Grocery Auto-Order</Txt>
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
            <Txt size={13} weight="800" color={Colors.textInverse}>Activate Daily Subscription</Txt>
          </Btn>
        </Card>
      </View>
    </Modal>
  );
}

// ===== BookProntoRepairDialog =====
const REPAIR_CATEGORIES = ['Plumbing', 'Electrical', 'Carpenter', 'AC Repair', 'RO Servicing', 'Pest Control'];

export function BookProntoRepairDialog({ onDismiss }: { onDismiss: () => void }) {
  const bookRepair = usePGowStore((s) => s.bookPgRepairService);
  const [category, setCategory] = useState('Plumbing');
  const [issue, setIssue] = useState('Main Washroom Tap & Pipe Leakage Fix');
  const [urgency, setUrgency] = useState('15-Min Express');

  const costMap: Record<string, number> = { Plumbing: 399, Electrical: 449, 'AC Repair': 799 };
  const handleDispatch = () => {
    const cost = costMap[category] ?? 499;
    bookRepair(category, issue, urgency, cost);
    Alert.alert('Success', 'Pronto Technician Dispatched!');
    onDismiss();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Card
          containerColor={Colors.surface}
          borderRadius={24}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[20, 20]}
          style={{ width: '92%', zIndex: 2 }}
        >
          <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Row gap={8} align="center">
              <Txt size={18}>🛠️</Txt>
              <Txt size={16} weight="900" color={Colors.textPrimary}>Book Pronto Repair</Txt>
            </Row>
            <IconBtn onPress={onDismiss} icon="close" size={18} tint={Colors.textMuted} />
          </Row>

          <Txt size={11} weight="800" color={Colors.textMuted}>Select Category</Txt>
          <Spacer size={6} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {REPAIR_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                selected={category === cat}
                onPress={() => setCategory(cat)}
              />
            ))}
          </Row>

          <Spacer size={12} />
          <OutlinedTextField
            label="Issue Description"
            value={issue}
            onChangeText={setIssue}
            containerColor={Colors.surfaceMuted}
            style={{ marginBottom: 12 }}
          />

          <Txt size={11} weight="800" color={Colors.textMuted}>Dispatch Urgency</Txt>
          <Spacer size={6} />
          <Row gap={8}>
            {['15-Min Express', 'Scheduled Today'].map((u) => (
              <Btn
                key={u}
                onPress={() => setUrgency(u)}
                containerColor={urgency === u ? Colors.primary : Colors.surfaceMuted}
                textColor={urgency === u ? Colors.textInverse : Colors.textPrimary}
                borderRadius={10}
                height={36}
                style={{ flex: 1 }}
              >
                <Txt size={11} weight="800" color={urgency === u ? Colors.textInverse : Colors.textPrimary}>{u}</Txt>
              </Btn>
            ))}
          </Row>

          <Spacer size={16} />
          <Btn
            onPress={handleDispatch}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={12}
            height={44}
          >
            <Txt size={13} weight="800" color={Colors.textInverse}>⚡ Dispatch Technician Now</Txt>
          </Btn>
        </Card>
      </View>
    </Modal>
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
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Card
          containerColor={Colors.surface}
          borderRadius={24}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[20, 20]}
          style={{ width: '92%', zIndex: 2 }}
        >
          <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
            <Row gap={8} align="center">
              <Txt size={18}>🧺</Txt>
              <Txt size={16} weight="900" color={Colors.textPrimary}>Doorstep Laundry</Txt>
            </Row>
            <IconBtn onPress={onDismiss} icon="close" size={18} tint={Colors.textMuted} />
          </Row>
          <Txt size={11} weight="800" color={Colors.primaryDark}>Room {roomNo} • {guestName}</Txt>
          <Spacer size={12} />

          <Txt size={11} weight="800" color={Colors.textMuted}>Select Service Type</Txt>
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
                    backgroundColor: service === srv ? '#F0FDF9' : Colors.surfaceMuted,
                  },
                ]}
              >
                <Row justify="space-between" align="center">
                  <Txt size={12} weight="800" color={Colors.textPrimary}>{srv}</Txt>
                  <Txt size={11} weight="900" color={Colors.primaryDark}>
                    ₹{rate}{srv.includes('Shoe') ? '/pair' : srv.includes('Dry') ? '/pc' : '/kg'}
                  </Txt>
                </Row>
              </TouchableOpacity>
            ))}
          </View>
          <Spacer size={12} />

          <Txt size={11} weight="800" color={Colors.textMuted}>Quantity / Weight</Txt>
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
                <Txt size={11} weight="800" color={weight === w ? Colors.textInverse : Colors.textPrimary}>{w}</Txt>
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
              <Txt size={10} color={Colors.textMuted}>Estimated Total</Txt>
              <Txt size={18} weight="900" color={Colors.primaryDark}>₹{est}</Txt>
            </Col>
            <Btn
              onPress={handleBook}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={44}
            >
              <Txt size={12} weight="800" color={Colors.textInverse}>Confirm Pickup</Txt>
            </Btn>
          </Row>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laundryOpt: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
});

