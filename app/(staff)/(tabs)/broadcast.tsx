/** Chef dashboard "Broadcast" tab or Delivery History Route */
import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Card, Txt, Btn, Row, Chip, IconBtn, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/EmptyState';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import type { VisualDishItem } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { Ionicons } from '@expo/vector-icons';
import { useGuestsQuery } from '@/features/guests/useGuests';
import { useMealResponsesQuery } from '@/features/meals/useMeals';
import { useMyTripsQuery } from '@/features/staff/useTrips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRESET_DISHES: VisualDishItem[] = [
  { name: 'Poori', icon: '🫓', category: 'Breakfast', isVeg: true, rating: '4.6', image_url: require('../../../assets/food/poori.png') },
  { name: 'Idli', icon: '⚪', category: 'Breakfast', isVeg: true, rating: '4.7', image_url: require('../../../assets/food/idli.png') },
  { name: 'Dosa', icon: '🥞', category: 'Breakfast', isVeg: true, rating: '4.5', image_url: require('../../../assets/food/dosa.png') },
  { name: 'Uttapam', icon: '🍕', category: 'Breakfast', isVeg: true, rating: '4.4', image_url: require('../../../assets/food/uttapam.png') },
  { name: 'Upma', icon: '🥣', category: 'Breakfast', isVeg: true, rating: '4.4', image_url: require('../../../assets/food/upma.png') },
  { name: 'Poha', icon: '🥣', category: 'Breakfast', isVeg: true, rating: '4.3', image_url: require('../../../assets/food/poha.png') },
  { name: 'Pasta', icon: '🍝', category: 'Breakfast', isVeg: true, rating: '4.5', image_url: require('../../../assets/food/pasta.png') },
  { name: 'White Rice', icon: '🍚', category: 'Rice & Dal', isVeg: true, rating: '4.6', image_url: require('../../../assets/food/whiterice.png') },
  { name: 'Dal', icon: '🥣', category: 'Rice & Dal', isVeg: true, rating: '4.7', image_url: require('../../../assets/food/dal.png') },
  { name: 'Jeera Rice', icon: '🍚', category: 'Rice & Dal', isVeg: true, rating: '4.5', image_url: require('../../../assets/food/whiterice.png') },
  { name: 'Lemon Rice', icon: '🍋', category: 'Rice & Dal', isVeg: true, rating: '4.5', image_url: require('../../../assets/food/whiterice.png') },
  { name: 'Biryani', icon: '🍛', category: 'Rice & Dal', isVeg: false, rating: '4.8', image_url: require('../../../assets/food/biryani.png') },
  { name: 'Paneer Rice', icon: '🧀', category: 'Rice & Dal', isVeg: true, rating: '4.6', image_url: require('../../../assets/food/biryani.png') },
  { name: 'Paneer Curry', icon: '🧀', category: 'Curry & Fry', isVeg: true, rating: '4.7', image_url: require('../../../assets/food/paneer.png') },
  { name: 'Egg Curry', icon: '🥚', category: 'Curry & Fry', isVeg: false, rating: '4.6', image_url: require('../../../assets/food/chicken.png') },
  { name: 'Egg Rice', icon: '🍳', category: 'Curry & Fry', isVeg: false, rating: '4.4', image_url: require('../../../assets/food/biryani.png') },
  { name: 'Chicken', icon: '🍗', category: 'Curry & Fry', isVeg: false, rating: '4.8', image_url: require('../../../assets/food/chicken.png') },
  { name: 'Fry', icon: '🍟', category: 'Curry & Fry', isVeg: true, rating: '4.5', image_url: require('../../../assets/food/paneer.png') },
  { name: 'Sweet', icon: '🍬', category: 'Sweets', isVeg: true, rating: '4.8', image_url: require('../../../assets/food/sweet.png') },
];

export default function ChefBroadcastTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryHistoryRoute />;
  return <ChefBroadcastView />;
}

function ChefBroadcastView() {
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: Colors.canvas }}>
      {/* Personalized Header */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center">
            <View style={styles.avatar}>
              <Ionicons name="restaurant" size={24} color={Colors.primary} />
            </View>
            <View>
              <Row gap={4} align="center">
                <Txt size={18} weight="900" color={Colors.textPrimary}>Hi Chef Ramesh</Txt>
                <Txt size={18}>👋</Txt>
              </Row>
              <Txt size={12} color={Colors.textSecondary}>Plan today's menu & keep everyone happy</Txt>
            </View>
          </Row>
          <Row gap={8} align="center">
            <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              <View style={styles.headerUnreadDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => { hapticSuccess(); usePGowStore.getState().logout(); }}>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </Row>
        </Row>
      </View>

      <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
        <ChefGroceriesShortcut />

        <Spacer size={4} />
        <Row justify="space-between" align="center">
          <Row gap={6} align="center">
            <Txt size={18} weight="900" color={Colors.textPrimary}>Plan &amp; Broadcast Food Alert</Txt>
            <InfoTip text="Tap dishes to build menu plate. Registered residents will receive instant push notifications." />
          </Row>
          <TouchableOpacity activeOpacity={0.7} style={styles.howItWorksBtn}>
            <Ionicons name="play-circle-outline" size={14} color={Colors.primary} />
            <Txt size={11} weight="700" color={Colors.primary}>How it works?</Txt>
          </TouchableOpacity>
        </Row>

        <Spacer size={8} />
        <Txt size={13} weight="800" color={Colors.textPrimary}>Meal Type</Txt>
        <Row gap={8} style={{ marginTop: 6 }}>
          {[
            { id: 'Breakfast', icon: 'partly-sunny' },
            { id: 'Lunch', icon: 'sunny' },
            { id: 'Dinner', icon: 'moon' }
          ].map((m) => {
            const isSel = mealTypeSelected === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => selectMealType(m.id)}
                style={[
                  styles.mealPill,
                  isSel ? styles.mealPillActive : styles.mealPillInactive
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name={m.icon as any} size={16} color={isSel ? '#FFFFFF' : Colors.textSecondary} />
                <Txt size={13} weight="700" color={isSel ? '#FFFFFF' : Colors.textPrimary}>{m.id}</Txt>
              </TouchableOpacity>
            );
          })}
        </Row>

      <Spacer size={14} />
      {/* Selected plate */}
      <Spacer size={14} />
      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 16]}>
        <Row justify="space-between" align="center">
          <Row gap={14} align="center">
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceMuted, overflow: 'hidden' }}>
              {selectedDishes.length > 0 ? (
                <Image source={PRESET_DISHES.find(d => d.name === selectedDishes[0])?.image_url} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Txt size={24}>🍽️</Txt></View>
              )}
            </View>
            <View>
              <Txt size={15} weight="900" color={Colors.textPrimary}>Today's Selected Menu</Txt>
              <Spacer size={2} />
              <Txt size={13} color={Colors.textMuted}>{selectedDishes.length > 0 ? `${selectedDishes.length} items selected for ${mealTypeSelected}` : `Tap dishes below to build menu`}</Txt>
            </View>
          </Row>
          <TouchableOpacity onPress={() => { setSelectedDishes([]); set('menuItemsInput', ''); }}>
            <Row align="center" gap={2}>
              <Txt size={12} weight="800" color={Colors.primaryDark}>View Menu</Txt>
              <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
            </Row>
          </TouchableOpacity>
        </Row>
      </Card>

      <Spacer size={16} />
      <Row justify="space-between" align="center">
        <Txt size={14} weight="900" color={Colors.textPrimary}>👋 Tap dishes to add to today's menu</Txt>
        <TouchableOpacity activeOpacity={0.7}>
          <Row align="center" gap={2}>
            <Txt size={12} weight="800" color={Colors.primary}>See all</Txt>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </Row>
        </TouchableOpacity>
      </Row>
      <Spacer size={10} />
      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {['All', '🍞 Breakfast', '🍚 Rice & Dal', '🌶 Curry & Fry', '🍬 Sweets', '🥤 Beverages'].map((c) => {
          const rawCat = c.replace(/^[^\s]+\s/, ''); // strip emoji for matching logic if needed, but 'All' stays 'All'
          const label = c;
          const matchCat = c === 'All' ? 'All' : rawCat;
          const isSel = selectedCat === matchCat;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => setSelectedCat(matchCat)}
              style={[
                styles.categoryChip,
                isSel ? styles.categoryChipActive : styles.categoryChipInactive
              ]}
              activeOpacity={0.8}
            >
              <Txt size={12} weight="700" color={isSel ? '#FFFFFF' : Colors.textPrimary}>{label}</Txt>
            </TouchableOpacity>
          );
        })}
      </FormScroll>
      <Spacer size={12} />

      {/* Horizontal shelf of modern food cards */}
      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {filteredDishes.map((dish) => {
          const isSel = selectedDishes.includes(dish.name);
          return (
            <TouchableOpacity 
              key={dish.name} 
              onPress={() => toggleDish(dish.name)} 
              activeOpacity={0.9}
              style={[styles.foodCard, isSel && styles.foodCardSelected]}
            >
              <View style={styles.foodImageContainer}>
                {dish.image_url ? (
                  <Image source={dish.image_url} style={styles.foodImage} />
                ) : (
                  <View style={[styles.foodImage, { backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }]}>
                    <Txt size={32}>{dish.icon}</Txt>
                  </View>
                )}
                
                {/* Add/Check Button */}
                <View style={[styles.foodAddBtn, isSel && styles.foodAddBtnSelected]}>
                  {isSel ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                  )}
                </View>
              </View>

              <View style={styles.foodCardBody}>
                <Txt size={14} weight="800" color={Colors.textPrimary} numberOfLines={1}>{dish.name}</Txt>
                
                <Row justify="space-between" align="center" style={{ marginTop: 4 }}>
                  <Row gap={4} align="center">
                    <View style={[styles.vegDotSmall, { backgroundColor: dish.isVeg ? '#10B981' : '#EF4444' }]} />
                    <Txt size={10} weight="700" color={Colors.textMuted}>{dish.isVeg ? 'Veg' : 'Non-Veg'}</Txt>
                  </Row>
                  
                  {dish.rating && (
                    <Row gap={2} align="center" style={styles.ratingBadge}>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <Txt size={10} weight="800" color={Colors.textPrimary}>{dish.rating}</Txt>
                    </Row>
                  )}
                </Row>
              </View>
            </TouchableOpacity>
          );
        })}
      </FormScroll>

      <Spacer size={14} />
      {/* Add Custom Item */}
      <TouchableOpacity 
        onPress={() => setShowManualInput(!showManualInput)}
        activeOpacity={0.7}
        style={styles.addCustomBtn}
      >
        <Ionicons name={showManualInput ? "remove" : "add"} size={16} color={Colors.primaryDark} />
        <Txt size={14} weight="800" color={Colors.primaryDark}>{showManualInput ? 'Close Custom Item' : 'Add Custom Item'}</Txt>
      </TouchableOpacity>
      {showManualInput && (
        <View style={{ marginTop: 8 }}>
          <OutlinedTextField label="Food Items (Menu) *" placeholder="Masala Dosa, Sambar, Chutney" value={menuItemsInput} onChangeText={(v) => set('menuItemsInput', v)} focusedBorderColor={Colors.primary} multiline numberOfLines={3} />
        </View>
      )}

      <Spacer size={16} />
      <Spacer size={16} />
      {/* Notes */}
      <View>
        <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <Txt size={13} weight="800" color={Colors.textPrimary}>Note / Instructions <Txt color={Colors.textMuted} weight="600">(Visible to guests)</Txt></Txt>
          <View style={{ backgroundColor: Colors.primaryGlow, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pencil" size={18} color={Colors.primaryDark} />
          </View>
        </Row>
        <OutlinedTextField placeholder="Please confirm RSVP before 11:30 AM" value={chefNoteInput} onChangeText={(v) => set('chefNoteInput', v)} focusedBorderColor={Colors.primary} />
      </View>

      <Spacer size={16} />
      {/* Automation settings */}
      <TouchableOpacity onPress={() => setShowAutomation(!showAutomation)} activeOpacity={0.7}>
        <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 16]}>
          <Row justify="space-between" align="center">
            <Row gap={12} align="center">
              <View style={styles.automationIconBadge}>
                <Ionicons name="settings" size={20} color={Colors.primaryDark} />
              </View>
              <View>
                <Txt size={14} weight="900" color={Colors.textPrimary}>Automation Settings</Txt>
                <Spacer size={2} />
                <Txt variant="labelSmall" weight="600" color={Colors.textMuted}>3 daily alarms • Follow-up {autoFollowup ? 'ON' : 'OFF'}</Txt>
              </View>
            </Row>
            <TouchableOpacity onPress={() => setShowAutomation(!showAutomation)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryGlow, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}>
               <Txt size={12} weight="800" color={Colors.primaryDark}>Manage</Txt>
               <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
            </TouchableOpacity>
          </Row>
        </Card>
      </TouchableOpacity>

      {showAutomation && (
        <>
          <Spacer size={10} />
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

      <Row align="center" gap={6} style={{ marginTop: 14, justifyContent: 'center' }}>
        <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
        <Txt size={13} weight="700" color={Colors.textSecondary}>{mealTypeSelected} will be broadcast at <Txt color={Colors.primaryDark} weight="900">7:30 AM</Txt></Txt>
      </Row>

      <Spacer size={20} />
      <Btn onPress={handleBroadcast} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={16} height={56} style={styles.broadcastBtn}>
        <Txt size={14} weight="900" color="#FFFFFF">Broadcast Menu & Send Food Alerts to Guests 🚀</Txt>
      </Btn>
    </FormScroll>
    </View>
  );
}

function DeliveryHistoryRoute() {
  const { data: realTrips = [], refetch, isLoading: tripsLoading, error: tripsError } = useMyTripsQuery();

  const completedStops = realTrips.flatMap(t =>
    t.stops
      .filter(s => s.status === 'completed' || s.status === 'delivered' || s.status === 'failed')
      .map(s => ({
        id: s.id,
        pgName: s.pg_name,
        date: s.completed_at ? new Date(s.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
        time: s.completed_at ? new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        orders: s.item_count,
        status: s.status === 'failed' ? 'Failed' : 'Delivered',
      }))
  );

  // Was `: MOCK_HISTORY` — four invented delivery records shown to an agent who had none.
  const history = completedStops;

  return (
    <View style={styles.root}>
      <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
        <Txt size={18} weight="900" color={Colors.primaryDark}>Delivery History</Txt>
        <Spacer size={6} />
        {tripsLoading || tripsError || history.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No deliveries yet"
            subtitle="Completed and failed stops from your trips will be listed here."
            accent={Colors.primary}
            loading={tripsLoading}
            error={tripsError}
            onRetry={refetch}
          />
        ) : null}
        {history.map(item => (
          <Card key={item.id} containerColor={Colors.surface} borderRadius={Radii.xl} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row justify="space-between" align="center">
              <Row gap={12} align="center">
                <View style={styles.historyThumbBox}>
                  {item.status === 'Delivered' ? (
                    <Ionicons name="image-outline" size={20} color={Colors.primary} />
                  ) : (
                    <Ionicons name="close-circle-outline" size={20} color={Colors.danger} />
                  )}
                </View>
                <View>
                  <Txt size={14} weight="900" color={Colors.textPrimary}>{item.pgName}</Txt>
                  <Txt size={12} color={Colors.textMuted}>{item.date} · {item.orders} Orders</Txt>
                </View>
              </Row>
              <View style={[styles.statusPill, { backgroundColor: item.status === 'Delivered' ? '#F0FDF4' : '#FEF2F2' }]}>
                <Txt size={11} weight="800" color={item.status === 'Delivered' ? Colors.success : Colors.danger}>{item.status}</Txt>
              </View>
            </Row>
          </Card>
        ))}
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  selectedDishPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6 },
  automationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  automationDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 2 },
  switchTrack: { width: 44, height: 24, borderRadius: 12, padding: 2, flexDirection: 'row' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  historyThumbBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  headerContainer: {
    paddingHorizontal: 18,
    paddingTop: 16, // Assuming safe area is handled by Tabs wrapper or add inset if needed
    paddingBottom: 16,
    backgroundColor: '#EEF2FF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    position: 'relative',
  },
  headerUnreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  howItWorksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.primaryGlow,
  },
  mealPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
  },
  mealPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mealPillInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.borderSubtle,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.borderSubtle,
  },
  foodCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  foodCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.surfaceElevated,
  },
  foodImageContainer: {
    width: '100%',
    height: 110,
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  foodAddBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  foodAddBtnSelected: {
    backgroundColor: '#10B981',
  },
  foodCardBody: {
    padding: 10,
  },
  vegDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ratingBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  automationIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.primaryGlow,
  },
  broadcastBtn: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  }
});
