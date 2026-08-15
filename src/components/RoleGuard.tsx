/**
 * RoleGuard — RBAC wrapper for the new owner/manager/staff/tenant screens.
 *
 * Reads `useAuthStore.activeRole` (one of `owner | manager | chef |
 * kitchen_staff | maintenance | guest`) and gates its children behind a set of
 * allowed roles expressed in the spec's vocabulary (`owner | manager | tenant |
 * chief | staff_housekeeping`). The mapping is deliberate — the spec's role
 * names are the product-facing vocabulary, while the auth store's role names
 * are the backend's, and the two should not be confused at the call site.
 *
 * Why a component AND a hook: a screen that renders different content per role
 * (e.g. the owner sees the approve button, the manager sees the submit button)
 * needs the boolean, not the wrapper, so `useRoleGuard` exposes the same check
 * without a render boundary.
 *
 * The fallback is the existing `EmptyState` so an unauthorized section looks
 * like every other empty section in the app, not a foreign error screen.
 */
import React, { ReactNode } from 'react';
import { useAuthStore, Membership } from '@/store/authStore';
import { EmptyState } from '@/components/EmptyState';

/** The spec's product-facing role vocabulary. */
export type GuardRole = 'owner' | 'manager' | 'tenant' | 'chief' | 'staff_housekeeping';

/**
 * Map a spec role to the auth store's role string. The auth store carries the
 * backend's role names verbatim, so this is the one place the translation lives.
 *
 * - `tenant`         → `guest`           (the backend calls a resident a "guest")
 * - `chief`          → `chef`            (the spec's spelling; the backend's is `chef`)
 * - `staff_housekeeping` → `maintenance` (the spec's name; the backend's is `maintenance`)
 * - `owner`/`manager` pass through unchanged.
 */
const SPEC_TO_AUTH: Record<GuardRole, Membership['role']> = {
  owner: 'owner',
  manager: 'manager',
  tenant: 'guest',
  chief: 'chef',
  staff_housekeeping: 'maintenance',
};

export interface RoleGuardProps {
  /** Roles permitted to view `children`, in the spec's vocabulary. */
  allowedRoles: Array<GuardRole>;
  children: ReactNode;
  /** Rendered when the active role is not permitted. Defaults to a lock card. */
  fallback?: ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { canView } = useRoleGuard(allowedRoles);
  if (canView) return <>{children}</>;
  if (fallback != null) return <>{fallback}</>;
  return (
    <EmptyState
      icon="lock-closed"
      title="Not authorized"
      subtitle="Your role cannot access this section"
    />
  );
}

/**
 * Hook form of the same check. Returns the resolved active role (in the spec's
 * vocabulary, or `null` when signed out) plus a `canView` boolean so screens
 * that branch on role can do so without mounting a guard boundary.
 */
export function useRoleGuard(allowedRoles: Array<GuardRole>): {
  canView: boolean;
  /** The active role in the spec's vocabulary, or `null` when signed out. */
  activeRole: GuardRole | null;
} {
  const authRole = useAuthStore((s) => s.activeRole);
  if (!authRole) return { canView: false, activeRole: null };

  // Translate the backend role back to the spec vocabulary for the return
  // value, so the caller branches on `tenant`/`chief` etc. as the spec writes
  // them, not on `guest`/`chef`.
  const specRole = AUTH_TO_SPEC[authRole] ?? null;
  const allowedAuthRoles = new Set(allowedRoles.map((r) => SPEC_TO_AUTH[r]));
  return { canView: allowedAuthRoles.has(authRole), activeRole: specRole };
}

/** Inverse of `SPEC_TO_AUTH`. `kitchen_staff` has no spec alias, so it stays
 *  itself — a guard that lists `staff_housekeeping` will not match it, which is
 *  correct: housekeeping is a subset of staff, not the whole set. */
const AUTH_TO_SPEC: Partial<Record<Membership['role'], GuardRole>> = {
  owner: 'owner',
  manager: 'manager',
  guest: 'tenant',
  chef: 'chief',
  maintenance: 'staff_housekeeping',
};

export default RoleGuard;
