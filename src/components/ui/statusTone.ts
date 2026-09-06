/**
 * The status → tone map, kept free of runtime imports so `logic.check.ts` can reach it under
 * plain node. Same reason `upiUri.ts` and `roles.ts` are separate modules.
 *
 * `StatusChip` re-exports both of these, so nothing imports this file directly.
 */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

/**
 * The tone for a status string, so callers stop each inventing their own mapping.
 *
 * Covers the vocabularies actually in use across payments, KYC, requests, procurement and
 * grocery orders — they overlap more than they differ. An unknown value is `neutral`, which
 * is the honest answer for a state this app does not have an opinion about yet.
 */
export function toneFor(status: string | null | undefined): StatusTone {
  const s = (status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['verified', 'paid', 'approved', 'resolved', 'delivered', 'completed', 'active', 'vacant'].includes(s)) return 'ok';
  // `pending_owner_approval` is the procurement server's word for `pending`; matching the
  // prefix keeps the map from having to enumerate every module's variant of "still waiting".
  if (s.startsWith('pending') || ['in_progress', 'submitted', 'awaiting', 'due', 'processing'].includes(s)) return 'warn';
  if (['rejected', 'overdue', 'failed', 'cancelled', 'canceled', 'unpaid'].includes(s)) return 'danger';
  if (['ordered', 'assigned', 'shipped', 'open', 'new'].includes(s)) return 'info';
  return 'neutral';
}
