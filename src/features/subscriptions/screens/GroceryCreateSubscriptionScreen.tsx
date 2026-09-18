import { useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSupplyItems } from '../../groceries/useSupply';
import { useAuthStore } from '@/store/authStore';
import { useCreateSubscriptionMutation, WEEKDAY_INDEX, type DayOfWeek } from '../useSubscriptions';
import { SupplyItem } from '@/types/supply';
import { Radii, Colors, Layout } from '@/theme';
import { formatINR } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, Txt } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

export function GroceryCreateSubscriptionScreen() {
  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: catalog, isLoading } = useSupplyItems(activePgId);
  const createMutation = useCreateSubscriptionMutation();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  // schedule[day][itemId] = quantity
  const [schedule, setSchedule] = useState<Record<DayOfWeek, Record<string, number>>>({
    monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}, sunday: {}
  });

  const selectedItems = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter(item => selectedItemIds.has(item.id));
  }, [catalog, selectedItemIds]);

  const toggleItem = (itemId: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedItemIds(next);
  };

  const updateQuantity = (day: DayOfWeek, itemId: string, delta: number) => {
    setSchedule(prev => {
      const next = { ...prev };
      const current = next[day][itemId] || 0;
      const updated = Math.max(0, current + delta);
      
      next[day] = { ...next[day] };
      if (updated > 0) {
        next[day][itemId] = updated;
      } else {
        delete next[day][itemId];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!activePgId) return;

    // One line per (item, day). The server stores exactly this and the materialiser reads
    // it directly, so what is planned here is what ships.
    //
    // This replaced an aggregation that took `Math.max` of each item across the week and put
    // the real plan in `delivery_note` as JSON — a field the materialiser never reads. One
    // milk on weekdays and three on Saturday therefore shipped THREE every day: eight units
    // a week planned, twenty-one delivered and charged, silently.
    const itemsPayload = DAYS.flatMap((day) =>
      Object.entries(schedule[day.id])
        .filter(([, quantity]) => quantity > 0)
        .map(([item_id, quantity]) => ({
          item_id,
          quantity,
          weekday: WEEKDAY_INDEX[day.id],
        })),
    );

    if (itemsPayload.length === 0) {
      toast('error', 'Empty Plan', 'Please configure quantities for at least one day.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        pg_id: activePgId,
        deliver_at: '07:00:00', // Default morning delivery
        payment_method: 'credit',
        items: itemsPayload,
      });
      toast('success', 'Plan Created', 'Your daily subscription has been scheduled.');
      router.back();
    } catch (err) {
      toast('error', 'Error', err instanceof Error ? err.message : 'Failed to create plan.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="New Daily Plan" onBack={() => step === 2 ? setStep(1) : router.back()} />

      {step === 1 ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.stepTitle}>Step 1: Select Items</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.stepSub}>Choose the items you want delivered regularly.</Txt>

          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.grid}>
              {catalog?.map((item: SupplyItem) => {
                const isSelected = selectedItemIds.has(item.id);
                return (
                  <AnimatedPress
                    key={item.id}
                    style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                    onPress={() => toggleItem(item.id)}
                  >
                    <Image
                      source={item.image_url ? { uri: item.image_url } : require('../../../../assets/productimages/d1_nobg.webp')}
                      style={styles.itemImage}
                    />
                    <Txt maxFontSizeMultiplier={1.3} style={styles.itemName} numberOfLines={2}>{item.name}</Txt>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.itemUnit}>{item.unit_label}</Txt>
                    <View style={styles.checkboxContainer}>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={isSelected ? Colors.primary : Colors.borderSubtle}
                      />
                    </View>
                  </AnimatedPress>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.stepTitle}>Step 2: Set Day-wise Plan</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.stepSub}>Configure how many of each item you need per day.</Txt>

          {selectedItems.map((item: SupplyItem) => (
            <View key={item.id} style={styles.configCard}>
              <View style={styles.configHeader}>
                <Image
                  source={item.image_url ? { uri: item.image_url } : require('../../../../assets/productimages/d1_nobg.webp')}
                  style={styles.configThumb}
                />
                <View>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.configName}>{item.name}</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.configUnit}>{item.unit_label} • {formatINR(item.price)}</Txt>
                </View>
              </View>

              <View style={styles.dayGrid}>
                {DAYS.map(day => {
                  const qty = schedule[day.id][item.id] || 0;
                  return (
                    <View key={day.id} style={[styles.dayRow, qty > 0 && styles.dayRowActive]}>
                      <Txt maxFontSizeMultiplier={1.3} style={styles.dayLabel}>{day.label}</Txt>
                      <View style={styles.stepper}>
                        <AnimatedPress style={styles.stepperBtn} onPress={() => updateQuantity(day.id, item.id, -1)}>
                          <Ionicons name="remove" size={16} color={Colors.textPrimary} />
                        </AnimatedPress>
                        <Txt maxFontSizeMultiplier={1.3} style={styles.stepperValue}>{qty}</Txt>
                        <AnimatedPress style={styles.stepperBtn} onPress={() => updateQuantity(day.id, item.id, 1)}>
                          <Ionicons name="add" size={16} color={Colors.textPrimary} />
                        </AnimatedPress>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {step === 1 ? (
          <AnimatedPress
            style={[styles.primaryBtn, selectedItemIds.size === 0 && styles.disabledBtn]}
            onPress={() => setStep(2)}
            disabled={selectedItemIds.size === 0}
          >
            <Txt maxFontSizeMultiplier={1.3} style={styles.primaryBtnText}>Continue to Schedule</Txt>
            <Ionicons name="arrow-forward" size={18} color={Colors.surface} />
          </AnimatedPress>
        ) : (
          <AnimatedPress
            style={[styles.primaryBtn, createMutation.isPending && styles.disabledBtn]}
            onPress={handleSave}
            disabled={createMutation.isPending}
          >
            <Txt maxFontSizeMultiplier={1.3} style={styles.primaryBtnText}>
              {createMutation.isPending ? 'Saving...' : 'Save Plan'}
            </Txt>
            <Ionicons name="checkmark" size={18} color={Colors.surface} />
          </AnimatedPress>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.canvas },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  stepSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 20 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    position: 'relative',
    ...Layout.shadowCard,
  },
  itemCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  itemImage: { width: '100%', height: 80, resizeMode: 'contain', marginBottom: 8 },
  itemName: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, marginBottom: 2 },
  itemUnit: { fontSize: 11, color: Colors.textSecondary },
  checkboxContainer: { position: 'absolute', top: 8, right: 8 },
  
  configCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
    padding: 16,
    ...Layout.shadowCard,
  },
  configHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  configThumb: { width: 40, height: 40, resizeMode: 'contain' },
  configName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  configUnit: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  
  dayGrid: { gap: 8 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  dayRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.brandPale,
  },
  dayLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  stepperValue: { fontSize: 15, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  
  footer: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    elevation: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.control,
  },
  disabledBtn: { opacity: 0.5 },
  primaryBtnText: { color: Colors.surface, fontSize: 15, fontWeight: '600' },
});
