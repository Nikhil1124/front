/**
 * haptics.ts — haptic feedback disabled app-wide.
 *
 * ponytail: neutered at this single chokepoint instead of stripping calls from
 * the ~40 call sites that import these — same effect (no vibration anywhere),
 * one-file diff. Re-enable by restoring the expo-haptics-backed impl if wanted.
 */
export type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

/** No-op. Kept async to match the previous signature at every call site. */
export async function haptic(_pattern: HapticPattern = 'light'): Promise<void> {}

/** Convenience: a light tap. Use on tab switches, card taps. */
export const hapticTap = () => haptic('light');

/** Convenience: a medium impact. Use on form submits, dialog confirms. */
export const hapticConfirm = () => haptic('medium');

/** Convenience: a selection tick. Use on chip / filter selections. */
export const hapticSelect = () => haptic('selection');

/** Convenience: success notification. Use on action success (RSVP submitted, etc). */
export const hapticSuccess = () => haptic('success');

/** Convenience: warning notification. Use on validation errors. */
export const hapticWarning = () => haptic('warning');

/** Convenience: error notification. Use on action failures. */
export const hapticError = () => haptic('error');
