/**
 * The device's "reduce motion" accessibility setting.
 *
 * Every animation built on `react-native-reanimated` (`withTiming`, `withSpring`, the
 * `entering`/`exiting` Keyframe builders) already reads this automatically — its default
 * `reduceMotion` config is `ReduceMotion.System`, so nothing in this app has had to check it
 * by hand up to now. This hook exists for the one kind of "animation" that ISN'T built on
 * Reanimated and so gets none of that for free: `CountUp`'s counting digits, which are driven
 * by a plain `requestAnimationFrame` loop pushing new React state, because there is no
 * Reanimated primitive for animating a Text node's actual character content on the UI thread.
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` is the platform API both iOS and Android expose
 * for this; `addEventListener` keeps it live if the setting changes while the app is open,
 * which Reanimated's own default notably does NOT do (it captures the setting once at launch).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
