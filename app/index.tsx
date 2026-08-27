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

  // If we have a token but haven't finished the initial `/v1/me` fetch, we are in the middle
  // of session restoration. The splash screen is still up, so rendering nothing is safe and
  // prevents a premature redirect on a role that has not resolved yet.
  if (!user) return null;

  // Freshly registered owner with no PG properties yet must land on Owner Overview, which
  // shows the "add your first property" card. Guests are excluded — they get /guest-join
  // below, and the (auth) group stays mounted for exactly that case (see app/_layout.tsx).
  if (user.memberships.length === 0 && activeRole !== 'guest') {
    return <Redirect href="/overview" />;
  }

  if (activeRole === 'owner' || activeRole === 'manager') return <Redirect href="/overview" />;
  
  if (activeRole === 'guest') {
    // No property left to show a dashboard for — send them to the join screen rather than an
    // empty /home.
    if (user.memberships.length === 0) return <Redirect href="/guest-join" />;
    return <Redirect href="/home" />;
  }
  if (activeRole === 'maintenance') return <Redirect href="/housekeeping" />;
  if (activeRole === 'chef' || activeRole === 'kitchen_staff' || activeRole === 'delivery_agent') return <Redirect href="/eaters" />;

  // No recognized role yet (hydration still resolving, or a genuinely unknown role) —
  // welcome is always safe: if a token turns out to be valid, the role-based guards in
  // app/_layout.tsx will already keep this out of reach once activeRole is known.
  return <Redirect href="/welcome" />;
}
