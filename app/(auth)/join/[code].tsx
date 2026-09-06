/**
 * `pgow://join/<CODE>` — what the QR on a lobby poster actually points at.
 *
 * Lives inside `(auth)` so it inherits that group's guard: a deep link is only meaningful to
 * someone without a session (or a resident whose membership ended and who needs to join
 * again), which is exactly what that guard already expresses.
 */
import { useLocalSearchParams } from 'expo-router';

import { JoinPgScreen } from '@/features/auth/JoinPgScreen';

export default function JoinByCodeRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <JoinPgScreen initialCode={code} />;
}
