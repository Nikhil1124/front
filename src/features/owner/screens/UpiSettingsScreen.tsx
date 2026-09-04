/**
 * UpiSettingsScreen — Owner drill-down for the UPI Settings quick action.
 * The actual list/add/remove UI lives in UpiConfigSection so this screen
 * and the Settings tab share one implementation.
 */
import { RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { UpiConfigSection } from '@/features/owner/tabs/UpiConfigSection';
import { useAuthStore } from '@/store/authStore';
import { qk } from '@/data/queryKeys';

export function UpiSettingsScreen() {
  const pgId = useAuthStore((s) => s.activePgId);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // The section owns the query, so the refresh lives here — where the scroll container is —
  // and reaches it by invalidating the same key rather than lifting the query up a level.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: qk.properties.upiIds(pgId ?? '') });
    } finally {
      setRefreshing(false);
    }
  }, [qc, pgId]);

  return (
    <HubScreenWrapper
      title="Payment & UPI"
      subtitle="Manage rent collection"
      icon="card-outline"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <UpiConfigSection />
    </HubScreenWrapper>
  );
}
