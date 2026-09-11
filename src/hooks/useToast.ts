/**
 * useToast — a small wrapper around the store's existing `activeAlert` channel
 * that surfaces short-lived confirmations without a system `Alert.alert` modal.
 *
 * Why: `Alert.alert` blocks the user with a system dialog. A toast-style
 * overlay (already provided by `AlertOverlay`) is the right primitive for
 * "RSVP submitted ✅" / "Password updated" / "Payment recorded" feedback.
 * This hook produces those toasts with the same `SimulatedAlert` shape the
 * overlay already renders.
 */
import { useCallback } from 'react';
import { usePGowStore } from '@/store/usePGowStore';
export type ToastTone = 'success' | 'warning' | 'error' | 'info' | 'meal' | 'payment';

const TONE_TO_TYPE: Record<ToastTone, 'MEAL' | 'PAYMENT' | 'SUCCESS' | 'ERROR' | 'ANNOUNCEMENT'> = {
  success: 'SUCCESS',
  warning: 'ANNOUNCEMENT',
  error: 'ERROR',
  info: 'ANNOUNCEMENT',
  meal: 'MEAL',
  payment: 'PAYMENT',
};

/**
 * The same toast, callable from module scope — a helper defined outside any component, or a
 * `.catch` in a plain function, where a hook cannot be called. Zustand's `getState()` reads
 * the same store the hook writes to, so both land in the one `AlertOverlay`.
 */
export function toastNow(tone: ToastTone, title: string, description?: string) {
  usePGowStore.getState().set('activeAlert', {
    title,
    description: description ?? '',
    type: TONE_TO_TYPE[tone],
    timestamp: Date.now(),
  });
}

export function useToast() {
  return useCallback(toastNow, []);
}

export default useToast;
