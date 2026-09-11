/**
 * Backend membership role → the coarse role this UI switches on.
 *
 * Lives apart from `usePGowStore.ts` because that module pulls in zustand, the query client,
 * the notification helper and every API module — nothing in it can be reached by a plain
 * `node` check. This mapping decides which dashboard a person lands on, so it is worth
 * keeping checkable.
 *
 * Dependency-free apart from types. Keep it that way.
 */
import type { ActiveRole } from '@/store/authStore';
import type { UserRole } from '@/types';

/**
 * Every backend role collapses to one of five UI roles.
 *
 * The catch-all matters: `kitchen_staff`, `maintenance`, `delivery_agent` and
 * `laundry_provider` all render the same STAFF surfaces, so a role added server-side lands
 * somewhere sane instead of falling through as null and leaving someone on a blank screen.
 *
 * `laundry_provider` is a PLATFORM role rather than a membership — PGow's own worker, scoped
 * to an area — which is why the parameter is `ActiveRole` and not `Membership['role']`.
 */
export function toUserRole(role: ActiveRole | null): UserRole | null {
  if (!role) return null;
  if (role === 'owner') return 'OWNER';
  if (role === 'manager') return 'MANAGER';
  if (role === 'guest') return 'GUEST';
  if (role === 'chef') return 'CHEF';
  return 'STAFF';
}
