import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

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
  action_type?: "request" | "payment" | "kyc" | "meal" | null;
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
