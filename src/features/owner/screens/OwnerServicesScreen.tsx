/**
 * OwnerServicesScreen — hub-and-spoke wrapper around `OwnerServicesTab`.
 *
 * `OwnerServicesTab` was fully built (10-min grocery, daily subscriptions, Pronto repairs,
 * procurement entry point) but had no dashboard tile pushing it — this is that tile's
 * destination.
 */
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { OwnerServicesTab } from '@/features/owner/tabs/OwnerServicesTab';

export function OwnerServicesScreen() {
  return (
    <HubScreenWrapper title="Services & Procurement" scrollable={false}>
      <OwnerServicesTab />
    </HubScreenWrapper>
  );
}
