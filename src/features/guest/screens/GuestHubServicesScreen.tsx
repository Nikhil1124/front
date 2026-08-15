/**
 * GuestHubServicesScreen — hub-and-spoke wrapper around `GuestHubServicesTab`.
 *
 * `GuestHubServicesTab` was fully built (laundry booking + grocery/repairs/cleaning/wifi
 * marketplace grid) but had no dashboard tile pushing it — this is that tile's destination.
 */
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { GuestHubServicesTab } from '@/features/guest/tabs/GuestHubServicesTab';

export function GuestHubServicesScreen() {
  return (
    <HubScreenWrapper title="Hub Services" scrollable={false}>
      <GuestHubServicesTab />
    </HubScreenWrapper>
  );
}
