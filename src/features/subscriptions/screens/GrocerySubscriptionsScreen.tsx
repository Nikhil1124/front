import { StyleSheet, View, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSubscriptionsQuery, useSetSubscriptionActiveMutation, Subscription } from '../useSubscriptions';
import { useAuthStore } from '@/store/authStore';
import { Radii, Colors, Layout } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { AnimatedPress, ErrorState, Txt } from '@/components/ui';

export function GrocerySubscriptionsScreen() {
  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const insets = useSafeAreaInsets();
  
  const { data: subscriptions, isLoading, error, refetch } = useSubscriptionsQuery(activePgId);
  const toggleActiveMutation = useSetSubscriptionActiveMutation(activePgId);

  const handleToggle = (sub: Subscription) => {
    toggleActiveMutation.mutate({ id: sub.id, active: !sub.is_active });
  };

  const renderItem = ({ item }: { item: Subscription }) => {
    // Distinct items, not lines: a day-wise plan holds one line per item per day, so the
    // same milk on five weekdays is five lines but one item to a reader.
    const itemCount = new Set((item.items ?? []).map((l) => l.item_id)).size;
    // Day-wise the moment any line names a day; a plan of only daily lines is a plain
    // standing order and says nothing extra.
    const isDaywise = (item.items ?? []).some((l) => l.weekday != null);

    return (
      <AnimatedPress style={styles.card} onPress={() => router.push(`/groceries/subscriptions/${item.id}`)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardTitle}>Daily Delivery</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusBadge, !item.is_active && styles.statusBadgePaused]}>
              <Txt maxFontSizeMultiplier={1.3} style={[styles.statusText, !item.is_active && styles.statusTextPaused]}>
                {item.is_active ? 'ACTIVE' : 'PAUSED'}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </View>
        </View>

        <View style={styles.cardBody}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.cardMeta}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} • Delivery at {item.deliver_at.slice(0, 5)}
          </Txt>
          {isDaywise && (
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardMetaSub}>
              Day-wise custom schedule active
            </Txt>
          )}
        </View>

        <View style={styles.cardFooter}>
          <AnimatedPress
            style={styles.actionBtn}
            onPress={() => handleToggle(item)}
            disabled={toggleActiveMutation.isPending}
          >
            <Ionicons name={item.is_active ? "pause-outline" : "play-outline"} size={16} color={Colors.textPrimary} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.actionText}>{item.is_active ? 'Pause' : 'Resume'}</Txt>
          </AnimatedPress>
        </View>
      </AnimatedPress>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="My Subscriptions"
        onBack={() => router.back()}
        actions={
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" onPress={() => router.push('/groceries/subscriptions/create')}>
            <Ionicons name="add" size={24} color={Colors.primary} />
          </AnimatedPress>
        }
      />

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <ErrorState
          error={error}
          title="Could not load subscriptions"
          onRetry={refetch}
          fill={false}
        />
      ) : (
        <FlatList
          data={subscriptions || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-clear-outline" size={48} color={Colors.textMuted} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.emptyTitle}>No Subscriptions Yet</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.emptySub}>Set up a daily delivery schedule for items like milk, bread, and eggs.</Txt>
              <AnimatedPress style={styles.createBtn} onPress={() => router.push('/groceries/subscriptions/create')}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.createBtnText}>Create Plan</Txt>
              </AnimatedPress>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  listContainer: {
    padding: 16,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
    ...Layout.shadowCard,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.badge,
  },
  statusBadgePaused: {
    backgroundColor: Colors.surfaceElevated,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  statusTextPaused: {
    color: Colors.textSecondary,
  },
  cardBody: {
    padding: 16,
  },
  cardMeta: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  cardMetaSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceElevated,
    borderBottomLeftRadius: Radii.card,
    borderBottomRightRadius: Radii.card,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.control,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radii.control,
  },
  createBtnText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
});
