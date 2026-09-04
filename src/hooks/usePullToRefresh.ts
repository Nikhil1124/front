/**
 * usePullToRefresh — a small helper that wires RefreshControl up to the
 * store's `refreshAll` action and exposes `refreshing` + `onRefresh` to drop
 * into any ScrollView/FlatList.
 *
 * Why a hook: every dashboard tab wants the same behaviour (pull → show
 * spinner → call refreshAll → hide spinner). Centralising it stops one tab
 * forgetting to reset `refreshing=false` on error, or showing the spinner
 * for too long because someone awaited something else.
 */
import { useState, useCallback } from 'react';
import { usePGowStore } from '@/store/usePGowStore';
export function usePullToRefresh() {
  const refreshAll = usePGowStore((s) => s.refreshAll);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      // Always reset, even on error — `refreshAll` itself swallows per-section
      // errors via `safeList`, so by the time it returns the spinner has
      // nothing left to wait for.
      setRefreshing(false);
    }
  }, [refreshAll]);

  return { refreshing, onRefresh };
}
