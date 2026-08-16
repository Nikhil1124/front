/**
 * StaffDashboardScreen — port of Kotlin `StaffDashboardScreen`.
 * Sticky header + 3-tab bottom dock (Eaters/Menu/Kitchen).
 */
import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { Card, Txt, Btn, Row, Col, Spacer, Chip, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { VisualDishItem } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

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

const ANNOUNCEMENTS = [
  'Special Dessert today! 🍨',
  'Serving started! Come get hot portions! 🍽️',
  'Delay of 10 mins due to prep ⏰',
  'Limited portions available. Hurry! 🏃‍♂️',
  'Chai is ready in the dining area! ☕',
];

export function StaffDashboardScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeMeal, setActiveMeal] = useState<any>(null);
  const [prepState, setPrepState] = useState('PREPPING');
  const [chefBroadcast, setChefBroadcast] = useState('');
  const [showNotif, setShowNotif] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);

  const staff = usePGowStore((s) => s.loggedInStaff);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const activeRole = usePGowStore((s) => s.activeRole);
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const notifications = usePGowStore((s) => s.currentPGNotifications);
  const allRSVPs = usePGowStore((s) => s.allRSVPsState);
  const guests = usePGowStore((s) => s.currentGuests);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
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
  const logout = usePGowStore((s) => s.logout);
  const set = usePGowStore((s) => s.set);
  const sendRoleNotification = usePGowStore((s) => s.sendRoleNotification);
  const setActiveNotificationId = usePGowStore((s) => s.setActiveNotificationId);

  /** One server broadcast addressed to residents — the only thing that reaches their phones. */
  const broadcastToResidents = async (title: string, body: string) => {
    const ok = await sendRoleNotification('RESIDENT', title, body, 'ANNOUNCEMENT', 'HIGH');
    if (!ok) Alert.alert('Not sent', 'The broadcast did not go out. Check your connection and try again.');
    return ok;
  };

  // Nothing was picked yet — default to the newest meal rather than leaving the tab stuck on
  // "No active meals" until someone taps a chip that was never shown because nothing was
  // selected to reveal it. Functional update so a real tap is never overwritten by this.
  useEffect(() => {
    if (notifications.length > 0) {
      setActiveMeal((cur: any) => cur ?? notifications[0]);
    }
  }, [notifications]);

  // The RSVP roster `refreshAll` fetches is scoped to whichever meal id this holds — keep it
  // in sync with what's on screen, or switching meals shows the previous one's headcount.
  useEffect(() => {
    if (activeMeal) {
      setActiveNotificationId(activeMeal.id);
    }
  }, [activeMeal?.id]);

  useEffect(() => {
    setPrepState('PREPPING');
  }, [activeMeal?.id]);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  const rsvpsForActive = activeMeal ? allRSVPs.filter((r) => r.notificationId === activeMeal.id) : [];
  const reqCount = rsvpsForActive.filter((r) => r.choice === 'REQUIRED').length;
  const notReqCount = rsvpsForActive.filter((r) => r.choice === 'NOT_REQUIRED').length;
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

  const sendCustomAnnouncement = async () => {
    if (!chefBroadcast.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please enter or select a message to send.');
      return;
    }
    // Goes to the server, addressed to residents. It used to raise a local toast on the chef's
    // own phone — the one person in the building who already knew.
    const ok = await broadcastToResidents('🍳 Kitchen Update', chefBroadcast.trim());
    if (!ok) return;
    hapticSuccess();
    setChefBroadcast('');
    Alert.alert('Success', '🔔 Announcement sent to all residents!');
  };

  const switchTab = (idx: number) => {
    if (idx === activeTab) return;
    hapticSelect();
    setActiveTab(idx);
  };

  return (
    <View style={styles.root}>
      {/* Header — its own surface, separate from the scrollable body below,
          so it reads as fixed chrome rather than the first card in the list. */}
      <View style={styles.header}>
        <Row justify="space-between" align="center">
          <Row gap={12} align="center">
            <View style={styles.chefIcon}><Txt size={24}>👨‍🍳</Txt></View>
            <Col>
              <Txt size={18} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 0.5 }}>CHEF DASHBOARD</Txt>
              <Txt size={11} color={Colors.textMuted}>Chef: {staff?.name ?? 'Ramesh Kumar'} (PG: {owner?.pgName ?? 'Co-Living'})</Txt>
            </Col>
          </Row>
          <Row gap={8}>
            <AnimatedPress scale={0.85} hapticPattern="light" onPress={() => setShowNotif(true)}>
              <View style={styles.bellBtn}>
                <Ionicons name="notifications" size={20} color={Colors.primary} />
                {unreadCount > 0 && <View style={styles.unreadDot} />}
              </View>
            </AnimatedPress>
            <AnimatedPress scale={0.85} hapticPattern="medium" onPress={() => { hapticSuccess(); logout(); }}>
              <View style={styles.bellBtn}>
                <Ionicons name="exit" size={20} color={Colors.danger} />
              </View>
            </AnimatedPress>
          </Row>
        </Row>
      </View>

      <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
        {activeRole === 'CHEF' && (
          <AnimatedPress scale={0.98} hapticPattern="light" onPress={() => pushScreen('GROCERIES_SCREEN')}>
            <Card containerColor={Colors.surfaceElevated} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
              <Row justify="space-between" align="center">
                <Row gap={10} align="center">
                  <Ionicons name="nutrition" size={22} color={Colors.primary} />
                  <Col>
                    <Txt size={14} weight="800" color={Colors.textPrimary}>Groceries</Txt>
                    <Txt size={11} color={Colors.textMuted}>Request kitchen supplies from the Manager</Txt>
                  </Col>
                </Row>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Row>
            </Card>
          </AnimatedPress>
        )}

        {/* Tab 0: Eaters — keyed for entrance animation */}
        {activeTab === 0 && (
          <Animated.View key={`eaters-${activeTab}`} entering={SlideInRight.duration(220).springify().damping(18).stiffness(220)}>
            {!activeMeal ? (
              <View style={styles.emptyMealBox}>
                <Txt size={12} color={Colors.textMuted} align="center">No active meals. Use 'Broadcast Food Alert' tab to create a meal.</Txt>
              </View>
            ) : (
              <>
                <Txt size={11} weight="700" color={Colors.textSecondary}>Select Active Meal to View RSVP Data:</Txt>
                <Spacer size={6} />
                <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {notifications.map((n) => (
                    <Chip key={n.id} label={`${n.mealType} - ${n.menuItems.slice(0, 20)}...`} selected={activeMeal?.id === n.id} onPress={() => setActiveMeal(n)} selectedColor={Colors.primary} size={11} />
                  ))}
                </FormScroll>
                <Spacer size={14} />

                <Card containerColor={Colors.surface} borderRadius={20} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]}>
                  <Col align="center">
                    <Txt size={11} weight="900" color={Colors.primaryDark} style={{ letterSpacing: 1.2 }}>TOTAL PORTIONS TO PREPARE TODAY</Txt>
                    <Spacer size={10} />
                    <View style={styles.bigPortionBox}>
                      <Txt size={46} weight="900" color={Colors.primary}>{reqCount}</Txt>
                    </View>
                    <Spacer size={10} />
                    <Txt size={13} weight="700" color={Colors.textPrimary} align="center">Active Menu: {activeMeal?.menuItems}</Txt>
                  </Col>
                </Card>

                <Spacer size={14} />
                <Row gap={10}>
                  <View style={[styles.metricCard, { backgroundColor: '#F0FDF9', borderColor: '#CCFBF1' }]}>
                    <Txt size={10} weight="800" color={Colors.primaryDark}>COOK PORTIONS</Txt>
                    <Txt size={28} weight="900" color={Colors.primary}>{reqCount}</Txt>
                    <Txt size={10} weight="700" color={Colors.textMuted}>Eating ✅</Txt>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' }]}>
                    <Txt size={10} weight="800" color="#B91C1C">SKIPPED / SAVED</Txt>
                    <Txt size={28} weight="900" color={Colors.danger}>{notReqCount}</Txt>
                    <Txt size={10} weight="700" color={Colors.textMuted}>Skipping ❌</Txt>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
                    <Txt size={10} weight="800" color="#B45309">NO REPLY</Txt>
                    <Txt size={28} weight="900" color={Colors.warning}>{noResponse}</Txt>
                    <Txt size={10} weight="700" color={Colors.textMuted}>Awaiting ⏳</Txt>
                  </View>
                </Row>
              </>
            )}
          </Animated.View>
        )}

        {/* Tab 1: Broadcast */}
        {activeTab === 1 && (
          <Animated.View key={`broadcast-${activeTab}`} entering={SlideInRight.duration(220).springify().damping(18).stiffness(220)}>
            <>
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
                    <Col>
                      <Txt size={13} weight="900" color={Colors.textPrimary}>Automation Settings</Txt>
                      <Txt size={10} color={Colors.textMuted}>3 daily alarms • follow-up {autoFollowup ? 'ON' : 'OFF'}</Txt>
                    </Col>
                  </Row>
                  <Ionicons name={showAutomation ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
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
                        <Col style={{ flex: 1 }}>
                          <Txt size={12} weight="800" color={Colors.textPrimary}>{a.time}</Txt>
                          <Txt size={10} color={Colors.textMuted}>{a.label}</Txt>
                        </Col>
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
                      <Col style={{ flex: 1 }}>
                        <Row gap={4} align="center">
                          <Txt size={12} weight="800" color={Colors.textPrimary}>15-Min Follow-up</Txt>
                          <InfoTip text="Every 15 minutes, residents who haven't responded to the active meal get an automatic reminder. Responded residents stop receiving them." />
                        </Row>
                        <Txt size={10} color={Colors.textMuted}>{noResponse} not responded</Txt>
                      </Col>
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
              <Ionicons name="send" size={16} color="#FFFFFF" />
              <Txt size={14} weight="900" color="#FFFFFF" style={{ marginLeft: 8 }}>Broadcast Menu &amp; Send Food Alerts to Guests 🚀</Txt>
            </Btn>
            </>
          </Animated.View>
        )}

        {/* Tab 2: Kitchen */}
        {activeTab === 2 && (
          <Animated.View key={`kitchen-${activeTab}`} entering={SlideInRight.duration(220).springify().damping(18).stiffness(220)}>
          <>
            <Txt size={15} weight="900" color={Colors.textPrimary}>Kitchen Preparation Status</Txt>
            <Spacer size={8} />
            <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
              <Row gap={8}>
                {['PREPPING 🥕', 'COOKING 🔥', 'READY 🍽️'].map((s) => {
                  const sel = prepState === s.split(' ')[0];
                  return (
                    <Btn key={s} onPress={() => setPrepState(s.split(' ')[0])} containerColor={sel ? Colors.primary : Colors.surfaceMuted} textColor={sel ? '#FFFFFF' : Colors.textSecondary} borderRadius={10} height={42} style={{ flex: 1 }}>
                      <Txt size={11} weight="800" color={sel ? '#FFFFFF' : Colors.textSecondary}>{s}</Txt>
                    </Btn>
                  );
                })}
              </Row>
              {prepState === 'READY' && (
                <>
                  <Spacer size={14} />
                  <Btn onPress={async () => { if (await broadcastToResidents('🍽️ Meal is Served', 'Meal is ready! Please come collect your hot portions!')) Alert.alert('Success', '🔔 Alert dispatched to all residents!'); }} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={44}>
                    <Ionicons name="megaphone" size={18} color="#FFFFFF" />
                    <Txt size={12} weight="800" color="#FFFFFF" style={{ marginLeft: 8 }}>Broadcast 'Meal is Served' to Residents 📢</Txt>
                  </Btn>
                </>
              )}
            </Card>

            <Spacer size={18} />
            <Txt size={15} weight="900" color={Colors.textPrimary}>Broadcast Custom Message to Residents</Txt>
            <Spacer size={8} />
            <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
              <OutlinedTextField placeholder="Type custom kitchen update..." value={chefBroadcast} onChangeText={setChefBroadcast} focusedBorderColor={Colors.primary} multiline numberOfLines={3} style={{ marginBottom: 10 }} />
              <Txt size={10} weight="700" color={Colors.textMuted}>Tap to quick-populate template:</Txt>
              <Spacer size={6} />
              <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {ANNOUNCEMENTS.map((msg) => (
                  <TouchableOpacity key={msg} onPress={() => setChefBroadcast(msg)} style={styles.templateChip}>
                    <Txt size={10} weight="800" color={Colors.primaryDark}>{msg}</Txt>
                  </TouchableOpacity>
                ))}
              </FormScroll>
              <Spacer size={14} />
              <Btn onPress={sendCustomAnnouncement} disabled={!chefBroadcast.trim()} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={42}>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Txt size={12} weight="800" color="#FFFFFF" style={{ marginLeft: 8 }}>Send Announcement to Residents 🚀</Txt>
              </Btn>
            </Card>
          </>
          </Animated.View>
        )}
      </FormScroll>

      {/* Sticky bottom dock */}
      <View style={styles.dockWrap}>
        <View style={styles.dock}>
          <AnimatedPress scale={activeTab === 0 ? 1 : 0.92} hapticPattern={null} onPress={() => switchTab(0)} style={[styles.dockBtn, { backgroundColor: activeTab === 0 ? Colors.primary : Colors.surfaceMuted, flex: 1 }]}>
            <Txt size={11} weight="900" color={activeTab === 0 ? '#FFFFFF' : Colors.textPrimary}>📊 Eaters</Txt>
            <Txt size={8} weight="700" color={activeTab === 0 ? '#CCFBF1' : Colors.textMuted}>RSVP List</Txt>
          </AnimatedPress>
          <AnimatedPress
            scale={activeTab === 1 ? 1 : 0.92}
            hapticPattern={null}
            onPress={() => switchTab(1)}
            style={[styles.dockBtn, { backgroundColor: activeTab === 1 ? Colors.primary : Colors.surfaceMuted, flex: 1 }]}
          >
            <Txt size={11} weight="900" color={activeTab === 1 ? '#FFFFFF' : Colors.textPrimary}>📣 Menu</Txt>
            <Txt size={8} weight="700" color={activeTab === 1 ? '#CCFBF1' : Colors.textMuted}>Broadcast</Txt>
          </AnimatedPress>
          <AnimatedPress scale={activeTab === 2 ? 1 : 0.92} hapticPattern={null} onPress={() => switchTab(2)} style={[styles.dockBtn, { backgroundColor: activeTab === 2 ? Colors.primary : Colors.surfaceMuted, flex: 1 }]}>
            <Txt size={11} weight="900" color={activeTab === 2 ? '#FFFFFF' : Colors.textPrimary}>🍳 Kitchen</Txt>
            <Txt size={8} weight="700" color={activeTab === 2 ? '#CCFBF1' : Colors.textMuted}>Pantry</Txt>
          </AnimatedPress>
        </View>
      </View>

      {showNotif && <RoleNotificationsCenterSheet roleTitle={staff?.role === 'Chef' ? 'CHEF' : 'MANAGER'} onDismiss={() => setShowNotif(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  chefIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  emptyMealBox: { height: 160, backgroundColor: Colors.surfaceMuted, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center', padding: 16 },
  bigPortionBox: { width: 104, height: 104, borderRadius: 52, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  metricCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center' },
  automationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  automationDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 2 },
  switchTrack: { width: 44, height: 24, borderRadius: 12, padding: 2, flexDirection: 'row' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  selectedDishPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6 },
  dishShelfCard: { width: 120, borderRadius: 14, padding: 10, alignItems: 'center', gap: 6 },
  dishIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  dishSelBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  aiLoadingBar: { height: 4, backgroundColor: Colors.surfaceMuted, borderRadius: 2, overflow: 'hidden' },
  aiReportBox: { backgroundColor: Colors.surfaceMuted, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.borderSubtle },
  templateChip: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dockWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(240, 253, 249, 0.95)', paddingHorizontal: 10, paddingVertical: 8 },
  dock: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 4, gap: 4, shadowColor: '#0D9488', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 6 },
  dockBtn: { borderRadius: 12, padding: 6, alignItems: 'center', justifyContent: 'center' },
});
