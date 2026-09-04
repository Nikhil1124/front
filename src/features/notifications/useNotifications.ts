import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import * as map from "../../data/mappers";
import type { AppRoleNotificationEntity } from "../../types";

/**
 * `meal` is absent on purpose. The server never writes a meal broadcast into the inbox —
 * the meals tab already shows every menu, and a bell that repeats what is one tap away is a
 * bell people stop reading.
 */
export type NotificationCategory =
  | "announcement"
  | "kyc"
  | "rent"
  | "complaint"
  | "finance"
  | "shift"
  | "service";

export interface NotificationRecord {
  id: string;
  pg_id?: string | null;
  category: NotificationCategory;
  priority: "high" | "normal" | "low";
  title: string;
  body: string;
  /** Where a tap goes. Pairs with `action_id`; both null means the row is read-only text. */
  // Mirrors the server's `NotificationActionType`. 'order' is written by every supply order
  // transition and 'trip' by delivery-agent assignment — both were missing here, so those
  // rows fell outside the declared union (harmless today: this is only rendered as a label,
  // never switched on for navigation).
  action_type?: "request" | "payment" | "kyc" | "meal" | "order" | "trip" | null;
  action_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export function listNotifications(opts?: {
  pgId?: string | null;
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<Page<NotificationRecord>> {
  const q = new URLSearchParams();
  if (opts?.pgId) q.set("pg_id", opts.pgId);
  if (opts?.unreadOnly) q.set("unread_only", "true");
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.cursor) q.set("cursor", opts.cursor);
  const qs = q.toString();
  return apiFetch<Page<NotificationRecord>>(
    qs ? `${API.NOTIFICATIONS}?${qs}` : API.NOTIFICATIONS
  );
}

/** Just the badge number — one cheap count, not a page of rows the caller discards. */
export function unreadCount(pgId?: string | null): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>(
    pgId
      ? `${API.NOTIFICATIONS_UNREAD_COUNT}?pg_id=${pgId}`
      : API.NOTIFICATIONS_UNREAD_COUNT
  );
}

/**
 * Clear it from the caller's own inbox.
 *
 * A DELETE to the client, a dismissal on the server: one notification row reaches everyone
 * it targets, so deleting it because one person swiped would take it from the rest.
 */
export function dismissNotification(id: string): Promise<void> {
  return apiFetch<void>(API.NOTIFICATION_DISMISS(id), { method: "DELETE" });
}

export function markRead(id: string): Promise<void> {
  return apiFetch<void>(API.NOTIFICATION_READ(id), { method: "POST" });
}

export function markAllRead(pgId?: string | null): Promise<{ marked: number }> {
  return apiFetch<{ marked: number }>(
    pgId ? `${API.NOTIFICATIONS_READ_ALL}?pg_id=${pgId}` : API.NOTIFICATIONS_READ_ALL,
    { method: "POST" }
  );
}

/** Diagnostic only — nothing here becomes an inbox row. The one way to answer "is push
 *  actually wired up on THIS phone" from inside the app instead of guessing. */
export function sendTestPush(): Promise<{
  push_configured: boolean;
  devices_found: number;
  pushed: number;
}> {
  return apiFetch<{ push_configured: boolean; devices_found: number; pushed: number }>(
    API.NOTIFICATIONS_TEST_PUSH,
    { method: "POST" }
  );
}

export type BroadcastAudience =
  | "all"
  | "owner"
  | "manager"
  | "chef"
  | "kitchen_staff"
  | "maintenance"
  | "delivery_agent"
  | "guest";

export interface BroadcastParams {
  pg_id: string;
  target_role?: BroadcastAudience;
  title: string;
  body?: string;
  category?: NotificationCategory;
  priority?: "high" | "normal" | "low";
}

/**
 * Post an announcement somebody typed. Owner/manager only, and rate limited server-side —
 * every send wakes every phone at the property.
 *
 * One row reaches everyone it targets; there is no per-recipient fan-out to undo later.
 */
export function broadcastNotification(params: BroadcastParams): Promise<NotificationRecord> {
  return apiFetch<NotificationRecord>(API.NOTIFICATIONS_BROADCAST, {
    method: "POST",
    body: JSON.stringify({ target_role: "all", ...params }),
  });
}

/** UI-facing audience label → the server's `BroadcastAudience` enum. Shared by every
 *  broadcast-composer screen so "resident" keeps meaning `guest` in exactly one place. */
export const BROADCAST_AUDIENCE_MAP: Record<string, BroadcastAudience> = {
  ALL: "all", OWNER: "owner", MANAGER: "manager", RESIDENT: "guest",
  GUEST: "guest", CHEF: "chef", STAFF: "kitchen_staff", MAINTENANCE: "maintenance",
  DELIVERY_AGENT: "delivery_agent", DELIVERY: "delivery_agent",
};

export function useRoleNotificationsQuery(pgId?: string) {
  return useQuery<AppRoleNotificationEntity[]>({
    queryKey: qk.notifications.list(pgId ?? ""),
    queryFn: async () => {
      const res = await listNotifications({ pgId, limit: 100 });
      return res.items.map(map.toRoleNotification);
    },
  });
}

export function useUnreadCountQuery(pgId?: string) {
  return useQuery<{ unread: number }>({
    queryKey: qk.notifications.unreadCount(pgId ?? ""),
    queryFn: () => unreadCount(pgId),
  });
}

export function useBroadcastNotificationMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: BroadcastParams) => broadcastNotification(params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.notifications.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.notifications.all(pgId) });
      }
    },
  });
}

export function useMarkNotificationReadMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.notifications.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.notifications.unreadCount(pgId) });
      }
    },
  });
}

export function useMarkAllNotificationsReadMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllRead(pgId),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.notifications.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.notifications.unreadCount(pgId) });
      }
    },
  });
}

export function useDismissNotificationMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissNotification(id),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.notifications.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.notifications.unreadCount(pgId) });
      }
    },
  });
}

export function useNotifications() {
  return {
    listNotifications,
    unreadCount,
    markRead,
    markAllRead,
    dismissNotification,
    sendTestPush,
    broadcastNotification,
  };
}
