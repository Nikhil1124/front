/**
 * Points, as a root-level Stack screen — reachable from any tab context, the same reason
 * `/notifications` is one. Points are earned on the meals tab and spent against rent on the
 * payments tab, so it belongs to neither navigator.
 */
import { router } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { RewardsScreen } from '@/features/rewards/RewardsScreen';

export default function RewardsRoute() {
  return (
    <>
      <AppHeader title="Points" onBack={() => router.back()} />
      <RewardsScreen />
    </>
  );
}
