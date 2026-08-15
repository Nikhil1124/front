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
import { hapticSuccess, hapticError, hapticWarning } from '@/utils/haptics';

export type ToastTone = 'success' | 'warning' | 'error' | 'info' | 'meal' | 'payment';

const TONE_TO_TYPE: Record<ToastTone, 'MEAL' | 'PAYMENT' | 'SUCCESS' | 'ERROR' | 'ANNOUNCEMENT'> = {
  success: 'SUCCESS',
  warning: 'ANNOUNCEMENT',
  error: 'ERROR',
  info: 'ANNOUNCEMENT',
  meal: 'MEAL',
  payment: 'PAYMENT',
};

export function useToast() {
  const set = usePGowStore((s) => s.set);

  const toast = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      // Haptic synchronously with the toast so the user feels + sees the
      // confirmation at the same instant.
      if (tone === 'success') hapticSuccess();
      else if (tone === 'error') hapticError();
      else if (tone === 'warning') hapticWarning();

      set('activeAlert', {
        title,
        description: description ?? '',
        type: TONE_TO_TYPE[tone],
        timestamp: Date.now(),
      });
    },
    [set],
  );

  return toast;
}

export default useToast;
