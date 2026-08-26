/**
 * App Root Index Route — resolves "/" to the right place based on auth state.
 *
 * Not wrapped in a Stack.Protected guard on purpose: its whole job is deciding where a
 * guard-protected group should send someone, so it has to be reachable regardless of state.
 * Stack.Protected (see app/_layout.tsx) still owns ongoing protection of every screen for
 * the lifetime of the session — this only resolves the very first "/" hit on cold start.
 */
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function IndexRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeRole = useAuthStore((s) => s.activeRole);
  const user = useAuthStore((s) => s.user);

  if (!accessToken) return <Redirect href="/welcome" />;

  // Freshly registered owner with no PG properties yet must land on Owner Overview (onboarding state)
  if (!!user && user.memberships.length === 0 && (activeRole === 'owner' || activeRole === null)) {
    return <Redirect href="/overview" />;
  }

  if (activeRole === 'owner' || activeRole === 'manager') return <Redirect href="/overview" />;
  
  if (activeRole === 'guest') {
    if (!!user && user.memberships.length === 0) {
      return <Redirect href="/guest-join" />;
    }
    return <Redirect href="/home" />;
  }
  if (activeRole === 'maintenance') return <Redirect href="/housekeeping" />;
  if (activeRole === 'chef' || activeRole === 'kitchen_staff' || activeRole === 'delivery_agent') return <Redirect href="/eaters" />;
  
  // Safe fallback
  return <Redirect href="/welcome" />;
}
