/** Chef dashboard "Broadcast" tab or Delivery History Route */
import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, Btn, Row, Chip, IconBtn, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/EmptyState';
import type { VisualDishItem } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { Ionicons } from '@expo/vector-icons';
import { useGuestsQuery } from '@/features/guests/useGuests';
import {
  useMealResponsesQuery,
  useMealsQuery,
  useCreateMealMutation,
  useUpdateMealMutation,
  useBroadcastMealMutation,
} from '@/features/meals/useMeals';
import { useMyTripsQuery } from '@/features/staff/useTrips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { NotificationHelper } from '@/data/notificationHelper';
import { parseTime, todayLocalISO } from '@/utils/format';
import type { MealNotificationEntity } from '@/types';

// Fixed identifiers so (re)scheduling — a toggle flip, a tab remount, a fresh app launch —
// replaces the existing OS-level schedule instead of stacking a duplicate reminder.
const CHEF_ALARM_ROWS = [
  { key: 'chefAlarm9amEnabled' as const, id: 'pgow-chef-alarm-9am', time: '9:00 AM', hour: 9, minute: 0, label: 'Remind to post lunch' },
  { key: 'chefAlarm1pmEnabled' as const, id: 'pgow-chef-alarm-1pm', time: '1:00 PM', hour: 13, minute: 0, label: 'Remind to post dinner' },
  { key: 'chefAlarm330pmEnabled' as const, id: 'pgow-chef-alarm-330pm', time: '3:30 PM', hour: 15, minute: 30, label: "Remind tomorrow's breakfast" },
];
const FOLLOWUP_REMINDER_ID = 'pgow-chef-followup-reminder';
const FOLLOWUP_INTERVAL_SECONDS = 15 * 60;
const FOLLOWUP_REMINDER_TITLE = '🚨 15-Min RSVP Check';
const FOLLOWUP_REMINDER_BODY = "Check who hasn't responded to the active meal, and tap Send Follow-up Now if it's worth another nudge.";

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
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  const activePgId = useAuthStore((s) => s.activePgId);
  const staff = usePGowStore((s) => s.loggedInStaff);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { activeMeal } = useActiveMeal();
  const { data: allMeals = [] } = useMealsQuery(activePgId ?? undefined);
  // Editing an old meal from a prior day is asking for trouble (a stale service_at, a
  // menu nobody eating today cares about) — today's own meals are the only sane edit set.
  const todaysMeals = allMeals.filter((m) => todayLocalISO(new Date(m.timestamp)) === todayLocalISO());
  const { data: mealResponses = [] } = useMealResponsesQuery(activeMeal?.id, activePgId ?? undefined);
  // This tab hides the shared staff layout header (see app/(staff)/(tabs)/_layout.tsx —
  // "Hide on the broadcast (Menu) tab to allow for a custom personal header") and builds its
  // own instead, so it needs its own copy of the bell/unread-count/sheet the shared header
  // already provides everywhere else, rather than a bell that looks real but does nothing.
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  const alarm9 = usePGowStore((s) => s.chefAlarm9amEnabled);
  const alarm1 = usePGowStore((s) => s.chefAlarm1pmEnabled);
  const alarm3 = usePGowStore((s) => s.chefAlarm330pmEnabled);
  const autoFollowup = usePGowStore((s) => s.auto15MinFollowupEnabled);
  const mealTypeSelected = usePGowStore((s) => s.mealTypeSelected);
  const mealDietaryTypeSelected = usePGowStore((s) => s.mealDietaryTypeSelected);
  const menuItemsInput = usePGowStore((s) => s.menuItemsInput);
  const chefNoteInput = usePGowStore((s) => s.chefNoteInput);
  const serviceTimeInput = usePGowStore((s) => s.serviceTimeInput);
  const formatServiceTime12h = usePGowStore((s) => s.formatServiceTime12h);
  const getAlertTriggerTime = usePGowStore((s) => s.getAlertTriggerTime);
  const selectMealType = usePGowStore((s) => s.selectMealType);
  const triggerChefAlarm = usePGowStore((s) => s.triggerChefAlarm);
  const triggerFollowup = usePGowStore((s) => s.trigger15MinUnresponsiveFollowup);
  const createMealMutation = useCreateMealMutation(activePgId ?? undefined);
  const updateMealMutation = useUpdateMealMutation(activePgId ?? undefined);
  const broadcastMealMutation = useBroadcastMealMutation(activePgId ?? undefined);
  const set = usePGowStore((s) => s.set);
  const scheduleChefAlarm = usePGowStore((s) => s.scheduleChefAlarm);

  // Re-arms whichever reminders are already toggled on — scheduling is idempotent (fixed
  // identifiers), so this is safe to run on every mount, including the remount this tab gets
  // every time the chef switches tabs and back (app/(staff)/(tabs)/_layout.tsx keys its
  // content view on pathname).
  useEffect(() => {
    CHEF_ALARM_ROWS.forEach((row) => {
      if (usePGowStore.getState()[row.key]) {
        scheduleChefAlarm(row.id, row.time, row.hour, row.minute);
      }
    });
    if (usePGowStore.getState().auto15MinFollowupEnabled) {
      NotificationHelper.scheduleRepeatingReminder(FOLLOWUP_REMINDER_ID, FOLLOWUP_INTERVAL_SECONDS, FOLLOWUP_REMINDER_TITLE, FOLLOWUP_REMINDER_BODY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleChefAlarmRow = async (row: (typeof CHEF_ALARM_ROWS)[number], enabled: boolean) => {
    if (enabled) {
      await NotificationHelper.cancelScheduled(row.id);
      set(row.key, false);
    } else {
      await scheduleChefAlarm(row.id, row.time, row.hour, row.minute);
      set(row.key, true);
    }
  };

  const toggleFollowupReminder = async (enabled: boolean) => {
    if (enabled) {
      await NotificationHelper.cancelScheduled(FOLLOWUP_REMINDER_ID);
      set('auto15MinFollowupEnabled', false);
    } else {
      await NotificationHelper.scheduleRepeatingReminder(FOLLOWUP_REMINDER_ID, FOLLOWUP_INTERVAL_SECONDS, FOLLOWUP_REMINDER_TITLE, FOLLOWUP_REMINDER_BODY);
      set('auto15MinFollowupEnabled', true);
    }
  };

  const reqCount = mealResponses.filter((r) => r.choice === 'eating').length;
  const notReqCount = mealResponses.filter((r) => r.choice === 'skipping').length;
  const noResponse = Math.max(0, guests.length - reqCount - notReqCount);

  const toggleDish = (dish: string) => {
    setSelectedDishes((cur) => {
      const next = cur.includes(dish) ? cur.filter((d) => d !== dish) : [...cur, dish];
      // Suggests veg/non-veg from what's actually on the plate — the chef can still
      // override with the chips below, e.g. to mark a veg-only selection "Pure Veg".
      if (next.length > 0) {
        const hasNonVeg = next.some((name) => PRESET_DISHES.find((d) => d.name === name)?.isVeg === false);
        set('mealDietaryTypeSelected', hasNonVeg ? 'non_veg' : 'veg');
      }
      return next;
    });
  };

  const filteredDishes = selectedCat === 'All' ? PRESET_DISHES : PRESET_DISHES.filter((d) => d.category === selectedCat);

  const startEditingMeal = (meal: MealNotificationEntity) => {
    setEditingMealId(meal.id);
    setSelectedDishes([]);
    // The meal's own text rarely matches a preset dish name exactly — the free-text field is
    // what can actually show it back, so open that rather than leaving the chef staring at an
    // empty dish grid for a menu that already has words in it.
    setShowManualInput(true);
    set('mealTypeSelected', meal.mealType);
    set('mealDietaryTypeSelected', meal.dietaryType ?? 'veg');
    set('menuItemsInput', meal.menuItems);
    set('chefNoteInput', meal.chefNote ?? '');
    set('serviceTimeInput', meal.serviceTime);
  };

  const cancelEditingMeal = () => {
    setEditingMealId(null);
    setSelectedDishes([]);
    set('menuItemsInput', '');
    set('chefNoteInput', '');
  };

  const handleSubmit = async () => {
    if (selectedDishes.length > 0) {
      set('menuItemsInput', selectedDishes.join(', '));
    }
    const menuItems = selectedDishes.length > 0 ? selectedDishes.join(', ') : menuItemsInput;
    if (!menuItems.trim()) {
      Alert.alert('Validation', 'Please enter food items first!');
      return;
    }
    if (!activePgId) {
      Alert.alert('Failed', 'No active property.');
      return;
    }
    // "HH:mm" is today's service time in this phone's timezone; the API wants an instant.
    const { hour, minute } = parseTime(serviceTimeInput);
    const serviceAt = new Date();
    serviceAt.setHours(hour, minute, 0, 0);

    try {
      let meal;
      if (editingMealId) {
        meal = await updateMealMutation.mutateAsync({
          mealId: editingMealId,
          params: {
            menu_items: menuItems.trim(),
            chef_note: chefNoteInput.trim() || undefined,
            service_at: serviceAt.toISOString(),
          },
        });
        // Residents who already RSVP'd deserve to hear about a real change — but
        // re-announcing would read as a brand new meal and reset what "already broadcast"
        // means to them. `menu_update` is the server's own middle ground: a fresh push,
        // same RSVP untouched. A meal nobody has seen yet (still a draft) has no RSVPs to
        // preserve and no audience to notify.
        if (meal.is_broadcast) {
          await broadcastMealMutation.mutateAsync({ mealId: editingMealId, params: { kind: 'menu_update' } });
        }
      } else {
        const mealType = mealTypeSelected.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
        meal = await createMealMutation.mutateAsync({
          meal_type: ['breakfast', 'lunch', 'dinner'].includes(mealType) ? mealType : 'lunch',
          menu_items: menuItems.trim(),
          dietary_type: mealDietaryTypeSelected,
          chef_note: chefNoteInput.trim() || undefined,
          service_at: serviceAt.toISOString(),
        });
        // Creating a meal writes a draft; the broadcast is what residents actually receive.
        await broadcastMealMutation.mutateAsync({ mealId: meal.id, params: { kind: 'announce' } });
      }

      usePGowStore.getState().patch({
        menuItemsInput: '', chefNoteInput: '', mealDietaryTypeSelected: 'veg',
        activeAlert: editingMealId
          ? {
              title: '✏️ Meal Updated',
              description: `${mealTypeSelected} at ${formatServiceTime12h(serviceTimeInput)}\nMenu: ${meal.menu_items}`,
              type: 'MEAL', notificationId: meal.id, timestamp: Date.now(),
            }
          : {
              title: '🍴 New Meal Broadcasted!',
              description: `${mealTypeSelected} at ${formatServiceTime12h(serviceTimeInput)}\nMenu: ${meal.menu_items}\nScheduled RSVP alert: ${getAlertTriggerTime(serviceTimeInput)}`,
              type: 'MEAL', notificationId: meal.id, timestamp: Date.now(),
            },
      });
      Alert.alert('Success', editingMealId ? '✏️ Menu updated — residents already RSVP’d were told about the change.' : '🔔 Menu & Food Push Alert Broadcasted to Residents!');
      setSelectedDishes([]);
      setEditingMealId(null);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown');
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
                <Txt size={18} weight="900" color={Colors.textPrimary}>Hi Chef {staff?.name?.split(' ')[0] ?? 'there'}</Txt>
                <Txt size={18}>👋</Txt>
              </Row>
              <Txt size={12} color={Colors.textSecondary}>Plan today's menu & keep everyone happy</Txt>
            </View>
          </Row>
          <Row gap={8} align="center">
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Notifications" accessibilityRole="button"
              style={styles.headerBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              {unreadCount > 0 && <View style={styles.headerUnreadDot} />}
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Log out" accessibilityRole="button" style={styles.headerBtn} activeOpacity={0.7} onPress={() => { usePGowStore.getState().logout(); }}>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </Row>
        </Row>
      </View>

      <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
        <ChefGroceriesShortcut />

        <Spacer size={4} />
        {/* "How it works?" used to sit here with no onPress — dead, and redundant with the
            InfoTip right below anyway, which already explains the mechanic. */}
        <Row gap={6} align="center">
          <Txt size={18} weight="900" color={Colors.textPrimary}>Plan &amp; Broadcast Food Alert</Txt>
          <InfoTip text="Tap dishes to build menu plate. Registered residents will receive instant push notifications." />
        </Row>

        {editingMealId ? (
          <View style={styles.editingBanner}>
            <Row gap={8} align="center" style={{ flex: 1 }}>
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Txt size={12} weight="700" color={Colors.primaryDark} style={{ flex: 1 }}>
                Editing today's {mealTypeSelected.toLowerCase()} — Save Changes updates this meal instead of posting a new one.
              </Txt>
            </Row>
            <TouchableOpacity accessibilityRole="button" onPress={cancelEditingMeal} activeOpacity={0.7}>
              <Txt size={12} weight="800" color={Colors.textSecondary}>Cancel</Txt>
            </TouchableOpacity>
          </View>
        ) : todaysMeals.length > 0 ? (
          <>
            <Spacer size={10} />
            <Txt size={12} weight="800" color={Colors.textSecondary}>Today's meals — tap to edit</Txt>
            <Spacer size={6} />
            <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {todaysMeals.map((meal) => (
                <TouchableOpacity accessibilityRole="button" key={meal.id} onPress={() => startEditingMeal(meal)} activeOpacity={0.8} style={styles.mealEditChip}>
                  <Ionicons name="pencil" size={12} color={Colors.primaryDark} />
                  <Txt size={12} weight="700" color={Colors.primaryDark}>{meal.mealType}</Txt>
                  {meal.isAlertSent && <View style={styles.mealEditChipDot} />}
                </TouchableOpacity>
              ))}
            </FormScroll>
          </>
        ) : null}

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
              <TouchableOpacity accessibilityState={{ selected: !!isSel }} accessibilityRole="button"
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

        <Spacer size={12} />
        <Row gap={6} align="center">
          <Txt size={13} weight="800" color={Colors.textPrimary}>Dietary Tag</Txt>
          <InfoTip text="Shown to residents on the meal card. Suggested from the dishes you pick below — tap to override." />
        </Row>
        <Row gap={8} style={{ marginTop: 6 }}>
          {[
            { id: 'veg' as const, label: 'Veg', icon: '🥦' },
            { id: 'non_veg' as const, label: 'Non-Veg', icon: '🍗' },
            { id: 'pure_veg' as const, label: 'Pure Veg', icon: '🥗' },
          ].map((d) => {
            const isSel = mealDietaryTypeSelected === d.id;
            return (
              <TouchableOpacity accessibilityState={{ selected: !!isSel }} accessibilityRole="button"
                key={d.id}
                onPress={() => set('mealDietaryTypeSelected', d.id)}
                style={[
                  styles.mealPill,
                  isSel ? styles.mealPillActive : styles.mealPillInactive
                ]}
                activeOpacity={0.8}
              >
                <Txt size={14}>{d.icon}</Txt>
                <Txt size={13} weight="700" color={isSel ? '#FFFFFF' : Colors.textPrimary}>{d.label}</Txt>
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
          <TouchableOpacity accessibilityRole="button" onPress={() => { setSelectedDishes([]); set('menuItemsInput', ''); }}>
            <Row align="center" gap={2}>
              <Txt size={12} weight="800" color={Colors.primaryDark}>View Menu</Txt>
              <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
            </Row>
          </TouchableOpacity>
        </Row>
      </Card>

      <Spacer size={16} />
      {/* "See all" used to sit here with no onPress — dead, and redundant: the category
          chips below default to "All", which already shows every dish. */}
      <Txt size={14} weight="900" color={Colors.textPrimary}>👋 Tap dishes to add to today's menu</Txt>
      <Spacer size={10} />
      <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {['All', '🍞 Breakfast', '🍚 Rice & Dal', '🌶 Curry & Fry', '🍬 Sweets', '🥤 Beverages'].map((c) => {
          const rawCat = c.replace(/^[^\s]+\s/, ''); // strip emoji for matching logic if needed, but 'All' stays 'All'
          const label = c;
          const matchCat = c === 'All' ? 'All' : rawCat;
          const isSel = selectedCat === matchCat;
          return (
            <TouchableOpacity accessibilityState={{ selected: !!isSel }} accessibilityRole="button"
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
            <TouchableOpacity accessibilityState={{ selected: !!isSel }} accessibilityRole="button" 
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
                    <View style={[styles.vegDotSmall, { backgroundColor: dish.isVeg ? Colors.success : Colors.danger }]} />
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
      <TouchableOpacity accessibilityRole="button" 
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
      <TouchableOpacity accessibilityRole="button" onPress={() => setShowAutomation(!showAutomation)} activeOpacity={0.7}>
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
            <TouchableOpacity accessibilityRole="button" onPress={() => setShowAutomation(!showAutomation)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryGlow, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}>
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
            {CHEF_ALARM_ROWS.map((row) => {
              const enabled = row.key === 'chefAlarm9amEnabled' ? alarm9 : row.key === 'chefAlarm1pmEnabled' ? alarm1 : alarm3;
              return (
                <View key={row.time} style={styles.automationRow}>
                  <Row gap={8} style={{ flex: 1 }} align="center">
                    <Txt size={18}>⏰</Txt>
                    <View style={{ flex: 1 }}>
                      <Txt size={12} weight="800" color={Colors.textPrimary}>{row.time}</Txt>
                      <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{row.label}</Txt>
                    </View>
                  </Row>
                  <Row gap={10} align="center">
                    <IconBtn onPress={() => triggerChefAlarm(row.time)} icon="notifications-outline" size={16} tint={Colors.primary} containerColor={Colors.surfaceElevated} />
                    <TouchableOpacity accessibilityRole="button" onPress={() => toggleChefAlarmRow(row, enabled)} style={[styles.switchTrack, { backgroundColor: enabled ? Colors.primary : '#CBD5E1', justifyContent: enabled ? 'flex-end' : 'flex-start' }]}>
                      <View style={styles.switchThumb} />
                    </TouchableOpacity>
                  </Row>
                </View>
              );
            })}

            <View style={styles.automationDivider} />

            <View style={styles.automationRow}>
              <Row gap={8} style={{ flex: 1 }} align="center">
                <Txt size={18}>🚨</Txt>
                <View style={{ flex: 1 }}>
                  <Row gap={4} align="center">
                    <Txt size={12} weight="800" color={Colors.textPrimary}>15-Min Check-in Reminder</Txt>
                    <InfoTip text="Nudges your phone every 15 minutes to check who hasn't responded — it doesn't notify residents by itself. Tap Send Follow-up Now below to actually re-notify them." />
                  </Row>
                  <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{noResponse} not responded</Txt>
                </View>
              </Row>
              <TouchableOpacity accessibilityRole="button" onPress={() => toggleFollowupReminder(autoFollowup)} style={[styles.switchTrack, { backgroundColor: autoFollowup ? Colors.primary : '#CBD5E1', justifyContent: autoFollowup ? 'flex-end' : 'flex-start' }]}>
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
      <Btn onPress={handleSubmit} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={16} height={56} style={styles.broadcastBtn}>
        <Txt size={14} weight="900" color="#FFFFFF">
          {editingMealId ? 'Save Changes ✏️' : 'Broadcast Menu & Send Food Alerts to Guests 🚀'}
        </Txt>
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
  editingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, padding: 10, marginTop: 10 },
  mealEditChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceElevated, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 12, paddingVertical: 8 },
  mealEditChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
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
    backgroundColor: Colors.success,
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
