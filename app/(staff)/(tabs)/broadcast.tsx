/** Chef dashboard "Broadcast" tab or Delivery History Route */
import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Txt, Btn, Row, Chip, IconBtn, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import type { VisualDishItem } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { Ionicons } from '@expo/vector-icons';
import { useMyTripsQuery } from '@/features/delivery/useDeliveryAgent';

const PRESET_DISHES: VisualDishItem[] = [
  { name: 'Poori', icon: '🫓', category: 'Breakfast', isVeg: true },
  { name: 'Idli', icon: '⚪', category: 'Breakfast', isVeg: true },
  { name: 'Dosa', icon: '🥞', category: 'Breakfast', isVeg: true },
  { name: 'Uttapam', icon: '🍕', category: 'Breakfast', isVeg: true },
  { name: 'Upma', icon: '🥣', category: 'Breakfast', isVeg: true },
  { name: 'Poha', icon: '🥣', category: 'Breakfast', isVeg: true },
  { name: 'Pasta', icon: '🍝', category: 'Breakfast', isVeg: true },
  { name: 'White Rice', icon: '🍚', category: 'Rice & Dal', isVeg: true },
  { name: 'Dal', icon: '🥣', category: 'Rice & Dal', isVeg: true },
  { name: 'Jeera Rice', icon: '🍚', category: 'Rice & Dal', isVeg: true },
  { name: 'Lemon Rice', icon: '🍋', category: 'Rice & Dal', isVeg: true },
  { name: 'Biryani', icon: '🍛', category: 'Rice & Dal', isVeg: false },
  { name: 'Paneer Rice', icon: '🧀', category: 'Rice & Dal', isVeg: true },
  { name: 'Paneer Curry', icon: '🧀', category: 'Curry & Fry', isVeg: true },
  { name: 'Egg Curry', icon: '🥚', category: 'Curry & Fry', isVeg: false },
  { name: 'Egg Rice', icon: '🍳', category: 'Curry & Fry', isVeg: false },
  { name: 'Chicken', icon: '🍗', category: 'Curry & Fry', isVeg: false },
  { name: 'Fry', icon: '🍟', category: 'Curry & Fry', isVeg: true },
  { name: 'Sweet', icon: '🍬', category: 'Sweets', isVeg: true },
];

export default function ChefBroadcastTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryHistoryRoute />;
  return <ChefBroadcastView />;
}

import { useGuestsQuery } from '@/features/guests/useGuests';
import { useMealResponsesQuery } from '@/features/meals/useMeals';

function ChefBroadcastView() {
  const [showManualInput, setShowManualInput] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { activeMeal } = useActiveMeal();
  const { data: mealResponses = [] } = useMealResponsesQuery(activeMeal?.id, activePgId ?? undefined);

  const alarm9 = usePGowStore((s) => s.chefAlarm9amEnabled);
  const alarm1 = usePGowStore((s) => s.chefAlarm1pmEnabled);
  const alarm3 = usePGowStore((s) => s.chefAlarm330pmEnabled);
  const autoFollowup = usePGowStore((s) => s.auto15MinFollowupEnabled);
  const mealTypeSelected = usePGowStore((s) => s.mealTypeSelected);
  const menuItemsInput = usePGowStore((s) => s.menuItemsInput);
  const chefNoteInput = usePGowStore((s) => s.chefNoteInput);
  const selectMealType = usePGowStore((s) => s.selectMealType);
  const triggerChefAlarm = usePGowStore((s) => s.triggerChefAlarm);
  const triggerFollowup = usePGowStore((s) => s.trigger15MinUnresponsiveFollowup);
  const sendMealNotification = usePGowStore((s) => s.sendMealNotification);
  const set = usePGowStore((s) => s.set);

  const reqCount = mealResponses.filter((r) => r.choice === 'eating').length;
  const notReqCount = mealResponses.filter((r) => r.choice === 'skipping').length;
  const noResponse = Math.max(0, guests.length - reqCount - notReqCount);

  const toggleDish = (dish: string) => {
    setSelectedDishes((cur) => cur.includes(dish) ? cur.filter((d) => d !== dish) : [...cur, dish]);
  };

  const filteredDishes = selectedCat === 'All' ? PRESET_DISHES : PRESET_DISHES.filter((d) => d.category === selectedCat);

  const handleBroadcast = async () => {
    if (selectedDishes.length > 0) {
      set('menuItemsInput', selectedDishes.join(', '));
    }
    if (!menuItemsInput.trim() && selectedDishes.length === 0) {
      hapticError();
      Alert.alert('Validation', 'Please enter food items first!');
      return;
    }
    const r = await sendMealNotification();
    if (r.ok) {
      hapticSuccess();
      Alert.alert('Success', '🔔 Menu & Food Push Alert Broadcasted to Residents!');
      setSelectedDishes([]);
    } else {
      hapticError();
      Alert.alert('Failed', r.error ?? 'Unknown');
    }
  };

  return (
    <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
      <ChefGroceriesShortcut />

      <Row gap={6} align="center">
        <Txt size={18} weight="800" color={Colors.textPrimary}>Plan &amp; Broadcast Food Alert</Txt>
        <InfoTip text="Tap dishes to build menu plate. Registered residents will receive instant push notifications." />
      </Row>

      <Spacer size={14} />
      <Txt size={13} weight="800" color={Colors.textPrimary}>Meal Type *</Txt>
      <Row gap={8} style={{ marginTop: 6, justifyContent: 'space-around' }}>
        {['Breakfast', 'Lunch', 'Dinner'].map((m) => (
          <Chip key={m} label={m} selected={mealTypeSelected === m} onPress={() => selectMealType(m)} selectedColor={Colors.primary} size={11} />
        ))}
      </Row>

      <Spacer size={14} />
      {/* Selected plate */}
      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={selectedDishes.length > 0 ? Colors.primary : Colors.borderSubtle} padding={[14, 14]}>
        <Row justify="space-between" align="center">
          <Row gap={8} align="center"><Txt size={18}>🍽️</Txt><Txt size={14} weight="900" color={Colors.textPrimary}>Selected Today's Menu Plate</Txt></Row>
          {selectedDishes.length > 0 && (
            <TouchableOpacity onPress={() => { setSelectedDishes([]); set('menuItemsInput', ''); }}>
              <Txt size={11} weight="700" color={Colors.danger}>🗑️ Clear All</Txt>
            </TouchableOpacity>
          )}
        </Row>
        <Spacer size={8} />
        {selectedDishes.length === 0 ? (
          <Txt size={12} weight="700" color={Colors.primaryDark}>👈 Tap the food items below to select menu (No typing needed!)</Txt>
        ) : (
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {selectedDishes.map((d) => (
              <TouchableOpacity key={d} onPress={() => toggleDish(d)} style={styles.selectedDishPill}>
                <Txt size={12} weight="800" color={Colors.primaryDark}>{d}</Txt>
                <Txt size={10} weight="900" color={Colors.danger}>✕</Txt>
              </TouchableOpacity>
            ))}
          </FormScroll>
        )}
      </Card>

      <Spacer size={16} />
      <Txt size={12} weight="900" color={Colors.primaryDark}>👉 TAP DISHES TO ADD TO TODAY'S MENU:</Txt>
      <Spacer size={6} />
      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {['All', 'Breakfast', 'Rice & Dal', 'Curry & Fry', 'Sweets'].map((c) => (
          <Chip key={c} label={c} selected={selectedCat === c} onPress={() => setSelectedCat(c)} selectedColor={Colors.primary} size={11} />
        ))}
      </FormScroll>
      <Spacer size={10} />

      {/* Horizontal shelf, not a tall vertical grid — browsing ~19 dishes
          sideways keeps this from eating the whole screen's scroll. */}
      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {filteredDishes.map((dish) => {
          const isSel = selectedDishes.includes(dish.name);
          return (
            <TouchableOpacity key={dish.name} onPress={() => toggleDish(dish.name)} style={[styles.dishShelfCard, { backgroundColor: isSel ? '#E6FAF5' : Colors.surface, borderColor: isSel ? Colors.primary : Colors.borderSubtle, borderWidth: isSel ? 1.5 : 1 }]}>
              <View style={[styles.dishIcon, { backgroundColor: isSel ? '#CCFBF1' : Colors.surfaceMuted }]}><Txt size={20}>{dish.icon}</Txt></View>
              <Txt size={12} weight="800" color={Colors.textPrimary} numberOfLines={1}>{dish.name}</Txt>
              <Row gap={4} align="center"><View style={[styles.vegDot, { backgroundColor: dish.isVeg ? '#10B981' : '#EF4444' }]} /><Txt size={9} weight="700" color={Colors.textMuted}>{dish.isVeg ? 'Veg' : 'Non-Veg'}</Txt></Row>
              <View style={[styles.dishSelBtn, { backgroundColor: isSel ? Colors.primary : Colors.surfaceMuted }]}><Txt size={10} weight="800" color={isSel ? '#FFFFFF' : Colors.primary}>{isSel ? '✅ Added' : '➕ Add'}</Txt></View>
            </TouchableOpacity>
          );
        })}
      </FormScroll>

      <Spacer size={14} />
      <TouchableOpacity onPress={() => setShowManualInput(!showManualInput)}>
        <Txt size={11} weight="700" color={Colors.textSecondary}>{showManualInput ? '▼ Hide Manual Custom Typing' : '▶ Optional: Type Custom Items Manually'}</Txt>
      </TouchableOpacity>
      {showManualInput && (
        <OutlinedTextField label="Food Items (Menu) *" placeholder="Masala Dosa, Sambar, Chutney" value={menuItemsInput} onChangeText={(v) => set('menuItemsInput', v)} focusedBorderColor={Colors.primary} multiline numberOfLines={3} style={{ marginTop: 6 }} />
      )}

      <Spacer size={12} />
      <OutlinedTextField label="Note / Instructions from Chef" placeholder="Please confirm RSVP before 11:30 AM" value={chefNoteInput} onChangeText={(v) => set('chefNoteInput', v)} focusedBorderColor={Colors.primary} />

      <Spacer size={16} />
      {/* Automation settings — configured once, rarely touched, so it stays
          collapsed by default instead of pushing the actual menu-building
          task further down the scroll every single time. */}
      <TouchableOpacity onPress={() => setShowAutomation(!showAutomation)} activeOpacity={0.7}>
        <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
          <Row justify="space-between" align="center">
            <Row gap={8} align="center">
              <Txt size={18}>⚙️</Txt>
              <View>
                <Txt size={13} weight="900" color={Colors.textPrimary}>Automation Settings</Txt>
                <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>3 daily alarms • follow-up {autoFollowup ? 'ON' : 'OFF'}</Txt>
              </View>
            </Row>
            <Txt size={16} color={Colors.textMuted}>{showAutomation ? '▲' : '▼'}</Txt>
          </Row>
        </Card>
      </TouchableOpacity>

      {showAutomation && (
        <>
          <Spacer size={10} />
          {/* One consistent list — same row pattern for every automation,
              instead of two differently-styled cards with duplicate
              on/off text and a wall of explainer copy. */}
          <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[6, 6]}>
            {([
              { key: 'chefAlarm9amEnabled', time: '9:00 AM', label: 'Remind to post lunch', enabled: alarm9 },
              { key: 'chefAlarm1pmEnabled', time: '1:00 PM', label: 'Remind to post dinner', enabled: alarm1 },
              { key: 'chefAlarm330pmEnabled', time: '3:30 PM', label: "Remind tomorrow's breakfast", enabled: alarm3 },
            ] as const).map((a) => (
              <View key={a.time} style={styles.automationRow}>
                <Row gap={8} style={{ flex: 1 }} align="center">
                  <Txt size={18}>⏰</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt size={12} weight="800" color={Colors.textPrimary}>{a.time}</Txt>
                    <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{a.label}</Txt>
                  </View>
                </Row>
                <Row gap={10} align="center">
                  <IconBtn onPress={() => triggerChefAlarm(a.time)} icon="notifications-outline" size={16} tint={Colors.primary} containerColor={Colors.surfaceElevated} />
                  <TouchableOpacity onPress={() => set(a.key, !a.enabled)} style={[styles.switchTrack, { backgroundColor: a.enabled ? Colors.primary : '#CBD5E1', justifyContent: a.enabled ? 'flex-end' : 'flex-start' }]}>
                    <View style={styles.switchThumb} />
                  </TouchableOpacity>
                </Row>
              </View>
            ))}

            <View style={styles.automationDivider} />

            <View style={styles.automationRow}>
              <Row gap={8} style={{ flex: 1 }} align="center">
                <Txt size={18}>🚨</Txt>
                <View style={{ flex: 1 }}>
                  <Row gap={4} align="center">
                    <Txt size={12} weight="800" color={Colors.textPrimary}>15-Min Follow-up</Txt>
                    <InfoTip text="Every 15 minutes, residents who haven't responded to the active meal get an automatic reminder. Responded residents stop receiving them." />
                  </Row>
                  <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{noResponse} not responded</Txt>
                </View>
              </Row>
              <TouchableOpacity onPress={() => set('auto15MinFollowupEnabled', !autoFollowup)} style={[styles.switchTrack, { backgroundColor: autoFollowup ? Colors.primary : '#CBD5E1', justifyContent: autoFollowup ? 'flex-end' : 'flex-start' }]}>
                <View style={styles.switchThumb} />
              </TouchableOpacity>
            </View>
            {noResponse > 0 && (
              <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
                <Btn onPress={() => triggerFollowup()} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={36}>
                  <Txt size={11} weight="800" color="#FFFFFF">📢 Send Follow-up Now ({noResponse})</Txt>
                </Btn>
              </View>
            )}
          </Card>
        </>
      )}

      <Spacer size={20} />
      <Btn onPress={handleBroadcast} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={12} height={50}>
        <Txt size={14} weight="900" color="#FFFFFF">Broadcast Menu &amp; Send Food Alerts to Guests 🚀</Txt>
      </Btn>
    </FormScroll>
  );
}

function DeliveryHistoryRoute() {
  const { data: trips = [], isLoading } = useMyTripsQuery();

  // Every completed/failed stop across every trip, newest first — the history is per
  // delivery, not per trip, matching what the dashboard's "route" shows during the day.
  const history = trips
    .flatMap((t) => t.stops)
    .filter((s) => s.status === 'delivered' || s.status === 'failed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  return (
    <View style={styles.root}>
      <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
        <Txt size={18} weight="900" color={Colors.primaryDark}>Delivery History</Txt>
        <Spacer size={6} />
        {isLoading ? (
          <Txt size={12} color={Colors.textMuted} align="center">Loading…</Txt>
        ) : history.length === 0 ? (
          <Txt size={12} color={Colors.textMuted} align="center">No completed deliveries yet.</Txt>
        ) : history.map(item => {
          const delivered = item.status === 'delivered';
          return (
            <Card key={item.id} containerColor={Colors.surface} borderRadius={Radii.xl} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
              <Row justify="space-between" align="center">
                <Row gap={12} align="center">
                  <View style={styles.historyThumbBox}>
                    {delivered ? (
                      <Ionicons name="image-outline" size={20} color={Colors.primary} />
                    ) : (
                      <Ionicons name="close-circle-outline" size={20} color={Colors.danger} />
                    )}
                  </View>
                  <View>
                    <Txt size={14} weight="900" color={Colors.textPrimary}>{item.pg_name}</Txt>
                    <Txt size={12} color={Colors.textMuted}>
                      {item.completed_at ? new Date(item.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'} · {item.item_count} Items
                    </Txt>
                  </View>
                </Row>
                <View style={[styles.statusPill, { backgroundColor: delivered ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Txt size={11} weight="800" color={delivered ? '#15803D' : '#DC2626'}>{delivered ? 'Delivered' : 'Failed'}</Txt>
                </View>
              </Row>
            </Card>
          );
        })}
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  selectedDishPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6 },
  dishShelfCard: { width: 120, borderRadius: 14, padding: 10, alignItems: 'center', gap: 6 },
  dishIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  dishSelBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  automationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  automationDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 2 },
  switchTrack: { width: 44, height: 24, borderRadius: 12, padding: 2, flexDirection: 'row' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  historyThumbBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
