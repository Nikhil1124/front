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
 * The catch-all matters: `kitchen_staff`, `maintenance` and `delivery_agent` all render the
 * same STAFF surfaces, so a role added server-side lands somewhere sane instead of falling
 * through as null and leaving someone on a blank screen.
 *
 * The parameter is `ActiveRole` rather than `Membership['role']` because this app used to
 * serve PGow's own field workers too. They are in the standalone partner apps now, so every
 * value reaching here is a membership — but the seam is left open for the next platform role
 * that genuinely belongs on a resident's phone.
 */
export function toUserRole(role: ActiveRole | null): UserRole | null {
  if (!role) return null;
  if (role === 'owner') return 'OWNER';
  if (role === 'manager') return 'MANAGER';
  if (role === 'guest') return 'GUEST';
  if (role === 'chef') return 'CHEF';
  return 'STAFF';
}
