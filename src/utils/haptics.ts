/**
 * haptics.ts — thin wrapper around expo-haptics with a no-op fallback.
 *
 * Why a wrapper: not every environment has the native module wired up (Expo Go on
 * web, jest tests, dev clients that didn't re-build after adding the dep). A bare
 * `import * as Haptics from 'expo-haptics'` would crash on those targets. The
 * wrapper imports lazily inside the call so a missing module becomes a silent
 * no-op, which is the correct behaviour for a haptic — the user feels nothing
 * either way.
 */
import { Platform } from 'react-native';

export type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

let cachedImpl: ((pattern: HapticPattern) => Promise<void> | void) | null = null;
let didTryImport = false;

async function loadImpl(): Promise<(pattern: HapticPattern) => Promise<void> | void> {
  if (didTryImport) return cachedImpl ?? noopImpl;
  didTryImport = true;

  // Web never has haptics, and React Native's vibration API on web is non-existent.
  if (Platform.OS === 'web') {
    cachedImpl = noopImpl;
    return cachedImpl;
  }

  try {
    // Lazy require so the module is only loaded on platforms that actually have it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptics = require('expo-haptics');
    cachedImpl = async (pattern: HapticPattern) => {
      try {
        switch (pattern) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'selection':
            await Haptics.selectionAsync();
            break;
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'warning':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'error':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      } catch {
        /* swallow — see header comment */
      }
    };
  } catch {
    cachedImpl = noopImpl;
  }
  return cachedImpl;
}

function noopImpl(_pattern: HapticPattern) {
  /* no-op */
}

/** Fire a haptic pattern. Safe to call anywhere. */
export async function haptic(pattern: HapticPattern = 'light'): Promise<void> {
  const impl = await loadImpl();
  try {
    await impl(pattern);
  } catch {
    /* never throw on haptics */
  }
}

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
