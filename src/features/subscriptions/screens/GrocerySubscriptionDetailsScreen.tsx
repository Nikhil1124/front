import { useMemo } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSubscriptionsQuery, useSetSubscriptionActiveMutation, DayOfWeek, SubscriptionItem } from '../useSubscriptions';
import { useAuthStore } from '@/store/authStore';
import { Radii, Colors, Layout } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, ErrorState, Txt } from '@/components/ui';

const DAYS = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'sunday', label: 'Sunday' },
];

export function GrocerySubscriptionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const insets = useSafeAreaInsets();
  
  const { data: subscriptions, isLoading, error } = useSubscriptionsQuery(activePgId);
  const toggleActiveMutation = useSetSubscriptionActiveMutation(activePgId);

  const subscription = useMemo(() => {
    return subscriptions?.find(s => s.id === id);
  }, [subscriptions, id]);

  const schedule = useMemo(() => {
    if (!subscription) return null;
    
    if (subscription.schedule) {
      return subscription.schedule;
    }

    if (subscription.delivery_note?.startsWith('DAYWISE_PLAN: ')) {
      try {
        const jsonStr = subscription.delivery_note.replace('DAYWISE_PLAN: ', '');
        const parsed = JSON.parse(jsonStr) as Record<DayOfWeek, any[]>;
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [subscription]);

  const handleToggle = () => {
    if (!subscription) return;
    toggleActiveMutation.mutate({ id: subscription.id, active: !subscription.is_active });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Plan Details" onBack={() => router.back()} />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !subscription) {
    return (
      <View style={styles.container}>
        <AppHeader title="Plan Details" onBack={() => router.back()} />
        <ErrorState
          error={error || new Error('Subscription not found')}
          title="Could not load plan"
          fill={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Plan Details" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.title}>Daily Delivery Plan</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.subtitle}>Scheduled for {subscription.deliver_at.slice(0, 5)}</Txt>
            </View>
            <View style={[styles.statusBadge, !subscription.is_active && styles.statusBadgePaused]}>
              <Txt maxFontSizeMultiplier={1.3} style={[styles.statusText, !subscription.is_active && styles.statusTextPaused]}>
                {subscription.is_active ? 'ACTIVE' : 'PAUSED'}
              </Txt>
            </View>
          </View>
          
          <AnimatedPress
            style={styles.actionBtn}
            onPress={handleToggle}
            disabled={toggleActiveMutation.isPending}
          >
            <Ionicons name={subscription.is_active ? "pause-outline" : "play-outline"} size={18} color={subscription.is_active ? Colors.warning : Colors.success} />
            <Txt maxFontSizeMultiplier={1.3} style={[styles.actionText, { color: subscription.is_active ? Colors.warning : Colors.success }]}>
              {toggleActiveMutation.isPending ? 'Updating...' : subscription.is_active ? 'Pause this plan' : 'Resume this plan'}
            </Txt>
          </AnimatedPress>
        </View>

        <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>
          {schedule ? 'Day-wise Schedule' : 'Items'}
        </Txt>

        {schedule ? (
          <View style={styles.scheduleContainer}>
            {DAYS.map(day => {
              const dayItems = schedule[day.id as DayOfWeek];
              if (!dayItems || dayItems.length === 0) return null;
              
              return (
                <View key={day.id} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.dayTitle}>{day.label}</Txt>
                  </View>
                  {dayItems.map((item: any, idx: number) => {
                    // Try to map to the full catalog item name if possible, otherwise fallback
                    const catItem = subscription.items.find(i => i.item_id === item.item_id);
                    const itemName = catItem?.item_name || 'Grocery Item';
                    const unit = catItem?.unit_label || '';
                    
                    return (
                      <View key={item.item_id + idx} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Txt maxFontSizeMultiplier={1.3} style={styles.itemName}>{itemName}</Txt>
                          {unit && <Txt maxFontSizeMultiplier={1.3} style={styles.itemUnit}>{unit}</Txt>}
                        </View>
                        <Txt maxFontSizeMultiplier={1.3} style={styles.itemQty}>x{item.quantity}</Txt>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.itemsCard}>
            {subscription.items.map((item: SubscriptionItem, idx: number) => (
              <View key={item.item_id + idx} style={[styles.itemRow, idx > 0 && styles.itemRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.itemName}>{item.item_name}</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.itemUnit}>{item.unit_label}</Txt>
                </View>
                <Txt maxFontSizeMultiplier={1.3} style={styles.itemQty}>x{item.quantity}</Txt>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 24,
    ...Layout.shadowCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.badge,
  },
  statusBadgePaused: {
    backgroundColor: Colors.surfaceElevated,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  statusTextPaused: {
    color: Colors.textSecondary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radii.control,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  scheduleContainer: {
    gap: 12,
  },
  dayCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Layout.shadowCard,
  },
  dayHeader: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  itemsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 16,
    ...Layout.shadowCard,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  itemUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemQty: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
