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

  if (!accessToken) return <Redirect href="/welcome" />;
  if (activeRole === 'owner' || activeRole === 'manager') return <Redirect href="/overview" />;
  if (activeRole === 'guest') return <Redirect href="/home" />;
  if (activeRole === 'maintenance') return <Redirect href="/housekeeping" />;
  if (activeRole === 'chef' || activeRole === 'kitchen_staff' || activeRole === 'delivery_agent') return <Redirect href="/eaters" />;
  // No recognized role yet (hydration still resolving, or a genuinely unknown role) —
  // welcome is always safe: if a token turns out to be valid, the role-based guards in
  // app/_layout.tsx will already keep this out of reach once activeRole is known.
  return <Redirect href="/welcome" />;
}
