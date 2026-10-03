import { useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, Btn, Row, IconBtn, Spacer, AnimatedPress, SearchField } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/EmptyState';
import type { VisualDishItem } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useCustomDishesQuery } from '@/features/meals/useDishes';
import { DishProductCard } from '@/features/meals/components/DishProductCard';
import type { Dish, MealType } from '@/types';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { Ionicons } from '@expo/vector-icons';
import { useGuestsQuery } from '@/features/guests/useGuests';
import {
  useMealResponsesQuery,
  useMealsQuery,
  useCreateMealMutation,
  useUpdateMealMutation,
  useBroadcastMealMutation,
  useNudgeMealMutation } from '@/features/meals/useMeals';
import { useMyTripsQuery } from '@/features/staff/useTrips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { NotificationHelper } from '@/data/notificationHelper';
import { parseTime, todayLocalISO } from '@/utils/format';
import type { MealNotificationEntity } from '@/types';
import { useDockScroll } from '@/components/HeadlessDockTabButton';

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
  { name: 'Poori', icon: '🫓', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/poori.webp') },
  { name: 'Idli', icon: '⚪', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/idli.webp') },
  { name: 'Dosa', icon: '🥞', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/dosa.webp') },
  { name: 'Uttapam', icon: '🍕', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/uttapam.webp') },
  { name: 'Upma', icon: '🥣', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/upma.webp') },
  { name: 'Poha', icon: '🥣', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/poha.webp') },
  { name: 'Pasta', icon: '🍝', category: 'Breakfast', isVeg: true, image_url: require('../../../assets/food/pasta.webp') },
  { name: 'Steamed Rice', icon: '🍚', category: 'Rice & Dal', isVeg: true, image_url: require('../../../assets/food/whiterice.webp') },
  { name: 'Dal', icon: '🥣', category: 'Rice & Dal', isVeg: true, image_url: require('../../../assets/food/dal.webp') },
  { name: 'Sambar', icon: '🥘', category: 'Rice & Dal', isVeg: true, image_url: require('../../../assets/food/dal.webp') },
  { name: 'Lemon Rice', icon: '🍋', category: 'Rice & Dal', isVeg: true, image_url: require('../../../assets/food/whiterice.webp') },
  { name: 'Biryani', icon: '🍛', category: 'Rice & Dal', isVeg: false, image_url: require('../../../assets/food/biryani.webp') },
  { name: 'Paneer Curry', icon: '🧀', category: 'Curry', isVeg: true, image_url: require('../../../assets/food/paneer.webp') },
  { name: 'Egg Curry', icon: '🥚', category: 'Curry', isVeg: false, image_url: require('../../../assets/food/chicken.webp') },
  { name: 'Chicken Curry', icon: '🍗', category: 'Curry', isVeg: false, image_url: require('../../../assets/food/chicken.webp') },
  { name: 'Sweets', icon: '🍬', category: 'Snacks', isVeg: true, image_url: require('../../../assets/food/sweet.webp') },
];

/**
 * When a meal is served. A new meal takes the next time the clock shows the chosen time —
 * tomorrow once today's has passed, which is how a chef posts tomorrow's breakfast the evening
 * before. It used to be today regardless, so a breakfast posted at night was dated that
 * morning: its RSVPs closed the moment it was announced, or it collided with today's
 * breakfast. An edited meal keeps its own day and only its time moves.
 */
function serviceDateFor(serviceTime: string, editingMealDate: number | null): Date {
  const { hour, minute } = parseTime(serviceTime);
  const at = editingMealDate ? new Date(editingMealDate) : new Date();
  at.setHours(hour, minute, 0, 0);
  if (!editingMealDate && at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  return at;
}

function dayWord(at: Date): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(at) - start(new Date())) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return at.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function ChefBroadcastTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryHistoryRoute />;
  return <ChefBroadcastView />;
}

function ChefBroadcastView() {
  const dockScroll = useDockScroll();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [showAutomation, setShowAutomation] = useState(false);
  const [selectedCat, setSelectedCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingMealDate, setEditingMealDate] = useState<number | null>(null);

  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: customDishes = [] } = useCustomDishesQuery(activePgId ?? undefined);
  const staff = usePGowStore((s) => s.loggedInStaff);
  const { data: guests = [] } = useGuestsQuery(activePgId ?? undefined);
  const { activeMeal } = useActiveMeal();
  const { data: allMeals = [] } = useMealsQuery(activePgId ?? undefined);
  const todaysMeals = allMeals.filter((m) => todayLocalISO(new Date(m.timestamp)) === todayLocalISO());
  const { data: mealResponses = [] } = useMealResponsesQuery(activeMeal?.id, activePgId ?? undefined);

  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  const alarm9 = usePGowStore((s) => s.chefAlarm9amEnabled);
  const alarm1 = usePGowStore((s) => s.chefAlarm1pmEnabled);
  const alarm3 = usePGowStore((s) => s.chefAlarm330pmEnabled);
  const autoFollowup = usePGowStore((s) => s.auto15MinFollowupEnabled);
  const mealTypeSelected = usePGowStore((s) => s.mealTypeSelected);
  const menuItemsInput = usePGowStore((s) => s.menuItemsInput);
  const chefNoteInput = usePGowStore((s) => s.chefNoteInput);
  const serviceTimeInput = usePGowStore((s) => s.serviceTimeInput);
  const formatServiceTime12h = usePGowStore((s) => s.formatServiceTime12h);
  const getAlertTriggerTime = usePGowStore((s) => s.getAlertTriggerTime);
  const selectMealType = usePGowStore((s) => s.selectMealType);
  const triggerChefAlarm = usePGowStore((s) => s.triggerChefAlarm);
  const nudge = useNudgeMealMutation();
  // To the residents who have not answered the meal on screen. It used to re-send the newest
  // meal in the list (tomorrow's, if posted) as "Menu updated" to everyone.
  const triggerFollowup = async () => {
    if (!activeMeal) return;
    try {
      const { reminded } = await nudge.mutateAsync(activeMeal.id);
      toast('success', 'Follow-up sent', reminded === 1 ? '1 resident who has not answered.' : `${reminded} residents who have not answered.`);
    } catch (err) {
      toast('error', 'Not sent', err instanceof Error ? err.message : 'Please try again.');
    }
  };
  const createMealMutation = useCreateMealMutation(activePgId ?? undefined);
  const updateMealMutation = useUpdateMealMutation(activePgId ?? undefined);
  const broadcastMealMutation = useBroadcastMealMutation(activePgId ?? undefined);
  const set = usePGowStore((s) => s.set);
  const scheduleChefAlarm = usePGowStore((s) => s.scheduleChefAlarm);

  useEffect(() => {
    CHEF_ALARM_ROWS.forEach((row) => {
      if (usePGowStore.getState()[row.key]) {
        scheduleChefAlarm(row.id, row.time, row.hour, row.minute);
      }
    });
    if (usePGowStore.getState().auto15MinFollowupEnabled) {
      NotificationHelper.scheduleRepeatingReminder(FOLLOWUP_REMINDER_ID, FOLLOWUP_INTERVAL_SECONDS, FOLLOWUP_REMINDER_TITLE, FOLLOWUP_REMINDER_BODY);
    }
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
    clearMenuError(); setSelectedDishes((cur) => {
      const next = cur.includes(dish) ? cur.filter((d) => d !== dish) : [...cur, dish];
      return next;
    });
  };

  const defaultCatalogDishes: Dish[] = PRESET_DISHES.map((d, i) => ({
    id: `default_${i}`,
    name: d.name,
    imageUrl: undefined, // Handle locally required images below
    category: d.category.replace(/^[^\s]+\s/, ''), // Remove emojis
    source: 'default',
    mealTypes: ['breakfast', 'lunch', 'dinner'],
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }));
  PRESET_DISHES.forEach((d, i) => {
    (defaultCatalogDishes[i] as any).imageUrl = d.image_url;
  });

  const allCatalogDishes = [...defaultCatalogDishes, ...customDishes];

  let filteredDishes = selectedCat === 'All' ? allCatalogDishes : allCatalogDishes.filter((d) => d.category === selectedCat);
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase();
    filteredDishes = filteredDishes.filter(d => d.name.toLowerCase().includes(q));
  }

  const startEditingMeal = (meal: MealNotificationEntity) => {
    setEditingMealId(meal.id);
    setEditingMealDate(meal.timestamp);
    clearMenuError(); setSelectedDishes([]);
    set('mealTypeSelected', meal.mealType);
    set('menuItemsInput', meal.menuItems);
    set('chefNoteInput', meal.chefNote ?? '');
    set('serviceTimeInput', meal.serviceTime);
  };

  const cancelEditingMeal = () => {
    setEditingMealId(null);
    setEditingMealDate(null);
    clearMenuError(); setSelectedDishes([]);
    set('menuItemsInput', '');
    set('chefNoteInput', '');
  };

  const [menuError, setMenuError] = useState<string | undefined>();
  const clearMenuError = () => setMenuError(undefined);

  const handleSubmit = async () => {
    if (selectedDishes.length > 0) {
      set('menuItemsInput', selectedDishes.join(', '));
    }
    const menuItems = selectedDishes.length > 0 ? selectedDishes.join(', ') : menuItemsInput;
    if (!menuItems.trim()) {
      setMenuError('Pick some dishes above, or type what is being served');
      return;
    }
    if (!activePgId) {
      toast('error', 'No active property', 'Pick a property before broadcasting a meal.');
      return;
    }
    
    // Default to veg if no custom selection dictates otherwise. The prompt requested removing the UI for it, but the API still needs it.
    // The chef's own dishes count too: they carry a dietary type from the catalog. Only the
    // built-in list was checked, so a custom "Mutton Curry" went out labelled veg. Egg counts
    // as non-veg — that is the line a vegetarian resident draws.
    let finalDietaryType: 'veg' | 'non_veg' = 'veg';
    if (selectedDishes.some((name) =>
      PRESET_DISHES.find((d) => d.name === name)?.isVeg === false
      || ['non_veg', 'eggitarian'].includes(customDishes.find((d) => d.name === name)?.dietaryType ?? ''))) {
      finalDietaryType = 'non_veg';
    }

    const serviceAt = serviceDateFor(serviceTimeInput, editingMealDate);

    try {
      let meal;
      if (editingMealId) {
        meal = await updateMealMutation.mutateAsync({
          mealId: editingMealId,
          params: {
            menu_items: menuItems.trim(),
            chef_note: chefNoteInput.trim() || undefined,
            service_at: serviceAt.toISOString() } });
        if (meal.is_broadcast) {
          await broadcastMealMutation.mutateAsync({ mealId: editingMealId, params: { kind: 'menu_update' } });
        }
      } else {
        const mealType = mealTypeSelected.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
        meal = await createMealMutation.mutateAsync({
          meal_type: ['breakfast', 'lunch', 'dinner'].includes(mealType) ? mealType : 'lunch',
          menu_items: menuItems.trim(),
          dietary_type: finalDietaryType,
          chef_note: chefNoteInput.trim() || undefined,
          service_at: serviceAt.toISOString() });
        await broadcastMealMutation.mutateAsync({ mealId: meal.id, params: { kind: 'announce' } });
      }

      usePGowStore.getState().patch({
        menuItemsInput: '', chefNoteInput: '',
        activeAlert: editingMealId
          ? {
              title: '✏️ Meal Updated',
              description: `${mealTypeSelected} at ${formatServiceTime12h(serviceTimeInput)}\nMenu: ${meal.menu_items}`,
              // No `notificationId`: with one, the toast grows a resident's "I'll eat / Skip"
              // buttons — on the chef's own confirmation, answering as someone who cannot RSVP.
              type: 'MEAL', timestamp: Date.now() }
          : {
              title: '🍴 New Meal Broadcasted!',
              // The 2-hour reminder goes out only if that moment is still ahead.
              description: `${mealTypeSelected} at ${formatServiceTime12h(serviceTimeInput)}\nMenu: ${meal.menu_items}${serviceAt.getTime() - 2 * 3_600_000 > Date.now() ? `\nRSVP reminder at ${getAlertTriggerTime(serviceTimeInput)}` : ''}`,
              // notificationId carries the meal through, so tapping the toast opens that meal.
              type: 'MEAL', notificationId: meal.id, timestamp: Date.now() } });
      clearMenuError(); setSelectedDishes([]);
      setEditingMealId(null);
      setEditingMealDate(null);
    } catch (err) {
      toast('error', 'Not broadcast', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F9FC' }}>
      {/* Personalized Header - Restored to exact original */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center">
            <View style={styles.avatar}>
              <Ionicons name="restaurant" size={24} color={Colors.primary} />
            </View>
            <View>
              <Row gap={4} align="center">
                <Txt size={18} weight="700" color={Colors.textPrimary}>Hi Chef {staff?.name?.split(' ')[0] ?? 'there'} 👋</Txt>
              </Row>
              <Txt size={12} color={Colors.textSecondary}>Plan today's menu & keep everyone happy</Txt>
            </View>
          </Row>
          <Row gap={8} align="center">
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Notifications" accessibilityRole="button"
              style={styles.headerBtn}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              {unreadCount > 0 && <View style={styles.headerUnreadDot} />}
            </AnimatedPress>
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Log out" accessibilityRole="button" style={styles.headerBtn} onPress={() => { usePGowStore.getState().logout(); }}>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            </AnimatedPress>
          </Row>
        </Row>
      </View>

      <FormScroll {...dockScroll} contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 16 }}>
        <ChefGroceriesShortcut />

        <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <View style={{ gap: 16 }}>
            <Row gap={6} align="center">
              <Txt size={18} weight="700" color={Colors.textPrimary}>Plan & Broadcast Food Alert</Txt>
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
                <AnimatedPress accessibilityRole="button" onPress={cancelEditingMeal}>
                  <Txt size={12} weight="700" color={Colors.textSecondary}>Cancel</Txt>
                </AnimatedPress>
              </View>
            ) : todaysMeals.length > 0 ? (
              <View>
                <Txt size={12} weight="700" color={Colors.textSecondary}>Today's meals — tap to edit</Txt>
                <Spacer size={6} />
                <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {todaysMeals.map((meal) => (
                    <AnimatedPress accessibilityRole="button" key={meal.id} onPress={() => startEditingMeal(meal)} style={styles.mealEditChip}>
                      <Ionicons name="pencil" size={12} color={Colors.primaryDark} />
                      <Txt size={12} weight="700" color={Colors.primaryDark}>{meal.mealType}</Txt>
                      {meal.isAlertSent && <View style={styles.mealEditChipDot} />}
                    </AnimatedPress>
                  ))}
                </FormScroll>
              </View>
            ) : null}

        {/* Meal Type Selection */}
        <Row gap={8}>
          {[
            { id: 'Breakfast', icon: 'partly-sunny' },
            { id: 'Lunch', icon: 'sunny' },
            { id: 'Dinner', icon: 'moon' }
          ].map((m) => {
            const isSel = mealTypeSelected === m.id;
            return (
              <AnimatedPress accessibilityState={{ selected: !!isSel }} accessibilityRole="button"
                key={m.id}
                onPress={() => selectMealType(m.id)}
                style={[
                  styles.mealPill,
                  isSel ? styles.mealPillActive : styles.mealPillInactive
                ]}
              >
                <Ionicons name={m.icon as any} size={16} color={isSel ? Colors.textInverse : Colors.textPrimary} />
                <Txt size={13} weight="700" color={isSel ? Colors.textInverse : Colors.textPrimary}>{m.id}</Txt>
              </AnimatedPress>
            );
          })}
        </Row>

        {/* Dish Categories */}
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['All', '🍞 Breakfast', '🍚 Rice & Dal', '🌶 Curry', '🥥 South Indian', '🥖 Bread', '🥨 Snacks'].map((c) => {
            const rawCat = c.replace(/^[^\s]+\s/, ''); 
            const matchCat = c === 'All' ? 'All' : rawCat;
            const isSel = selectedCat === matchCat;
            return (
              <AnimatedPress accessibilityState={{ selected: !!isSel }} accessibilityRole="button"
                key={c}
                onPress={() => setSelectedCat(matchCat)}
                style={[
                  styles.categoryChip,
                  isSel ? styles.categoryChipActive : styles.categoryChipInactive
                ]}
              >
                <Txt size={12} weight="700" color={isSel ? Colors.textInverse : Colors.textPrimary}>{c}</Txt>
              </AnimatedPress>
            );
          })}
        </FormScroll>

        {/* Search */}
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search dishes..."
          style={styles.searchContainer}
        />

        {/* 2-Column Grid for Dishes */}
        <View style={styles.gridContainer}>
          {filteredDishes.map((dish) => {
            const isSel = selectedDishes.includes(dish.name);
            const isEligible = dish.mealTypes.includes(mealTypeSelected.toLowerCase() as MealType);
            return (
              <DishProductCard
                key={dish.id}
                dish={dish as Dish}
                isSelected={isSel}
                isEligible={isEligible}
                onToggle={() => toggleDish(dish.name)}
              />
            );
          })}
        </View>

        {/* Add Custom Item */}
        <AnimatedPress accessibilityRole="button" 
          onPress={() => router.push('/custom-dish/create')}
          style={styles.addCustomBtn}
        >
          <Ionicons name="add" size={16} color={Colors.success} />
          <Txt size={14} weight="700" color={Colors.success}>Create New Custom Dish</Txt>
        </AnimatedPress>
          </View>
        </Card>

        {/* Today's Selected Menu */}
        <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <Row gap={12} align="center" justify="space-between">
            <Row gap={12} align="center">
              <View style={{ width: 40, height: 40, borderRadius: Radii.pill, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="restaurant-outline" size={20} color={Colors.textMuted} />
              </View>
              <View>
                <Txt size={15} weight="700" color={Colors.textPrimary}>Today's Selected Menu</Txt>
                <Spacer size={2} />
                <Txt size={13} color={menuError ? Colors.danger : Colors.textMuted}>
                  {selectedDishes.length > 0 ? `${selectedDishes.length} items selected` : `Tap dishes to build menu`}
                </Txt>
              </View>
            </Row>
            <AnimatedPress accessibilityRole="button" onPress={() => { clearMenuError(); setSelectedDishes([]); set('menuItemsInput', ''); }}>
              <Row align="center" gap={2}>
                <Txt size={12} weight="700" color={Colors.primaryDark}>View Menu</Txt>
                <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
              </Row>
            </AnimatedPress>
          </Row>

          {menuError ? (
            <Row gap={4} align="center" style={{ marginTop: 8 }}>
              <Ionicons name="alert-circle" size={13} color={Colors.danger} />
              <Txt size={11} color={Colors.danger}>{menuError}</Txt>
            </Row>
          ) : null}

          {selectedDishes.length > 0 && (
            <View style={styles.selectedItemsContainer}>
              {selectedDishes.map(dishName => {
                const dishObj = PRESET_DISHES.find(d => d.name === dishName);
                return (
                  <AnimatedPress key={dishName} onPress={() => toggleDish(dishName)} style={styles.selectedMiniCard}>
                    {dishObj?.image_url ? (
                      <Image source={dishObj.image_url} style={styles.selectedMiniImg} />
                    ) : (
                      <View style={[styles.selectedMiniImg, { backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }]}><Txt size={14}>{dishObj?.icon}</Txt></View>
                    )}
                    <Txt size={12} weight="700" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>{dishName}</Txt>
                    <Ionicons name="close" size={14} color={Colors.textMuted} />
                  </AnimatedPress>
                );
              })}
            </View>
          )}
        </Card>

        {/* Notes */}
        <View>
          <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
            <Txt size={13} weight="700" color={Colors.textPrimary}>Note / Instructions <Txt color={Colors.textMuted} weight="600">(Visible to guests)</Txt></Txt>
            <View style={{ backgroundColor: Colors.surfaceElevated, width: 36, height: 36, borderRadius: Radii.control, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pencil" size={16} color={Colors.primaryDark} />
            </View>
          </Row>
          <OutlinedTextField placeholder="Please confirm RSVP before 11:30 AM" value={chefNoteInput} onChangeText={(v) => set('chefNoteInput', v)} focusedBorderColor={Colors.primary} />
        </View>

        {/* Automation settings */}
        <AnimatedPress accessibilityRole="button" onPress={() => setShowAutomation(!showAutomation)}>
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 16]}>
            <Row justify="space-between" align="center" gap={8}>
              <Row gap={12} align="center" style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.automationIconBadge}>
                  <Ionicons name="settings" size={20} color={Colors.primaryDark} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={14} weight="700" color={Colors.textPrimary}>Automation Settings</Txt>
                  <Spacer size={2} />
                  <Txt variant="labelSmall" weight="600" color={Colors.textMuted}>3 daily alarms • Follow-up {autoFollowup ? 'ON' : 'OFF'}</Txt>
                </View>
              </Row>
              <AnimatedPress accessibilityRole="button" onPress={() => setShowAutomation(!showAutomation)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceElevated, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.sheet, borderWidth: 1, borderColor: Colors.borderSubtle }}>
                 <Txt size={12} weight="700" color={Colors.primaryDark}>Manage</Txt>
                 <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
              </AnimatedPress>
            </Row>
          </Card>
        </AnimatedPress>

        {showAutomation && (
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[6, 6]}>
            {CHEF_ALARM_ROWS.map((row) => {
              const enabled = row.key === 'chefAlarm9amEnabled' ? alarm9 : row.key === 'chefAlarm1pmEnabled' ? alarm1 : alarm3;
              return (
                <View key={row.time} style={styles.automationRow}>
                  <Row gap={8} style={{ flex: 1 }} align="center">
                    <Txt size={18}>⏰</Txt>
                    <View style={{ flex: 1 }}>
                      <Txt size={12} weight="700" color={Colors.textPrimary}>{row.time}</Txt>
                      <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{row.label}</Txt>
                    </View>
                  </Row>
                  <Row gap={10} align="center">
                    <IconBtn onPress={() => triggerChefAlarm(row.time)} icon="notifications-outline" size={16} tint={Colors.primary} containerColor={Colors.surfaceElevated} />
                    <AnimatedPress accessibilityRole="button" onPress={() => toggleChefAlarmRow(row, enabled)} style={[styles.switchTrack, { backgroundColor: enabled ? Colors.primary : '#CBD5E1', justifyContent: enabled ? 'flex-end' : 'flex-start' }]}>
                      <View style={styles.switchThumb} />
                    </AnimatedPress>
                  </Row>
                </View>
              );
            })}
            <View style={styles.automationDivider} />
            <View style={styles.automationRow}>
              <Row gap={8} style={{ flex: 1 }} align="center">
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <View style={{ flex: 1 }}>
                  <Row gap={4} align="center">
                    <Txt size={12} weight="700" color={Colors.textPrimary}>15-Min Check-in Reminder</Txt>
                    <InfoTip text="Nudges your phone every 15 minutes to check who hasn't responded — it doesn't notify residents by itself. Tap Send Follow-up Now below to actually re-notify them." />
                  </Row>
                  <Txt variant="labelSmall" weight="400" color={Colors.textMuted}>{noResponse} not responded</Txt>
                </View>
              </Row>
              <AnimatedPress accessibilityRole="button" onPress={() => toggleFollowupReminder(autoFollowup)} style={[styles.switchTrack, { backgroundColor: autoFollowup ? Colors.primary : '#CBD5E1', justifyContent: autoFollowup ? 'flex-end' : 'flex-start' }]}>
                <View style={styles.switchThumb} />
              </AnimatedPress>
            </View>
            {noResponse > 0 && (
              <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
                <Btn onPress={() => triggerFollowup()} loading={nudge.isPending} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={36}>
                  <Txt size={11} weight="700" color={Colors.textInverse}>Send follow-up now ({noResponse})</Txt>
                </Btn>
              </View>
            )}
          </Card>
        )}

        <Row align="center" gap={6} style={{ marginTop: 8, justifyContent: 'center' }}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          {/* Was a fixed "will be broadcast at 7:30 AM": the broadcast goes out when the button
              is tapped, and the time that matters is when the meal is served. */}
          <Txt size={13} weight="600" color={Colors.textSecondary}>
            {`${mealTypeSelected} is served ${dayWord(serviceDateFor(serviceTimeInput, editingMealDate))} at `}
            <Txt color={Colors.textPrimary} weight="700">{formatServiceTime12h(serviceTimeInput)}</Txt>
          </Txt>
        </Row>

        <Btn onPress={handleSubmit} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.card} height={56} style={styles.broadcastBtn}>
          <Txt size={15} weight="700" color={Colors.textInverse}>
            {editingMealId ? 'Save Changes ✏️' : 'Broadcast Menu & Send Food Alerts to Guests 🚀'}
          </Txt>
        </Btn>
      </FormScroll>
    </View>
  );
}

function DeliveryHistoryRoute() {
  const dockScroll = useDockScroll();
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
        status: s.status === 'failed' ? 'Failed' : 'Delivered' }))
  );

  const history = completedStops;

  return (
    <View style={styles.root}>
      <FormScroll {...dockScroll} contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
        <Txt size={18} weight="700" color={Colors.primaryDark}>Delivery History</Txt>
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
          <Card key={item.id} containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row justify="space-between" align="center">
              <Row gap={12} align="center">
                <View style={styles.historyThumbBox}>
                  {item.status === 'Delivered' ? (
                    <Ionicons name="image-outline" size={20} color={Colors.primary} />
                  ) : (
                    <Ionicons name="close-circle-outline" size={20} color={Colors.danger} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={14} weight="700" color={Colors.textPrimary} numberOfLines={1}>{item.pgName}</Txt>
                  <Txt size={12} color={Colors.textMuted} numberOfLines={1}>{item.date} · {item.orders} Orders</Txt>
                </View>
              </Row>
              <View style={[styles.statusPill, { backgroundColor: item.status === 'Delivered' ? '#F0FDF4' : Palette.TintRed }]}>
                <Txt size={11} weight="700" color={item.status === 'Delivered' ? Colors.success : Colors.danger}>{item.status}</Txt>
              </View>
            </Row>
          </Card>
        ))}
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F9FC' },
  headerContainer: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    position: 'relative' },
  headerUnreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.danger },
  editingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.primary, padding: 10, marginTop: 10 },
  mealEditChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.sheet, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 12, paddingVertical: 8 },
  mealEditChipDot: { width: 6, height: 6, borderRadius: Radii.pill, backgroundColor: Colors.success },
  mealPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radii.pill,
    gap: 6,
    borderWidth: 1 },
  mealPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3 },
  mealPillInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderSubtle },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    borderWidth: 1 },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary },
  categoryChipInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderSubtle },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginTop: 4
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.textPrimary
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  gridFoodCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden' },
  foodCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.surfaceElevated },
  foodImageContainer: {
    width: '100%',
    height: 110,
    position: 'relative' },
  foodImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover' },
  foodAddBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4 },
  foodAddBtnSelected: {
    backgroundColor: Colors.success },
  foodCardBody: {
    padding: 10 },
  vegDotSmall: {
    width: 8,
    height: 8,
    borderRadius: Radii.pill },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.success,
    borderStyle: 'dashed',
    backgroundColor: '#F0FDF4' },
  selectedItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16
  },
  selectedMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.pill,
    padding: 6,
    paddingRight: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 8,
    maxWidth: '48%'
  },
  selectedMiniImg: {
    width: 24,
    height: 24,
    borderRadius: Radii.card
  },
  automationIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  automationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  automationDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 2 },
  switchTrack: { width: 44, height: 24, borderRadius: Radii.card, padding: 2, flexDirection: 'row' },
  switchThumb: { width: 20, height: 20, borderRadius: Radii.pill, backgroundColor: Colors.surface },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.badge },
  historyThumbBox: { width: 44, height: 44, borderRadius: Radii.control, backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  broadcastBtn: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6 }
});
