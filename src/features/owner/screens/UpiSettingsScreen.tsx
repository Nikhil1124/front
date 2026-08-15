/**
 * UpiSettingsScreen — Owner drill-down for the UPI Settings quick action.
 * The actual list/add/remove UI lives in UpiConfigSection so this screen
 * and the Settings tab share one implementation.
 */
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { UpiConfigSection } from '@/features/owner/tabs/UpiConfigSection';

export function UpiSettingsScreen() {
  return (
    <HubScreenWrapper
      title="Payment & UPI Configuration"
      icon="card-outline"
    >
      <UpiConfigSection />
    </HubScreenWrapper>
  );
}
