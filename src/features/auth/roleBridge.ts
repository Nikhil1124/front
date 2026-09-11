/**
 * Mirror the freshly-derived role into the older store slices that still read it.
 *
 * Navigation itself only needs `useAuthStore.activeRole`, which the auth mutations already
 * set — this is the bridge for the screens that have not moved off `usePGowStore.activeRole`
 * yet. Extracted from `SignInScreen` so the forced-password-change route runs the SAME code
 * after it completes a sign-in, rather than a second copy that can drift.
 */
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { toUserRole } from '@/store/roles';

export async function applyRoleBridge(): Promise<void> {
  const role = toUserRole(useAuthStore.getState().activeRole);
  usePGowStore.getState().patch({ activeRole: role, isManagerMode: role === 'MANAGER' });
  await usePGowStore.getState().refreshAll();
}
