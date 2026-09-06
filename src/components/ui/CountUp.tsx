/**
 * CountUp — a number that animates from its previous value to a new one, instead of snapping.
 *
 * Not built on Reanimated: there is no primitive there for animating a `Text` node's actual
 * character content on the UI thread the way `withTiming`/`useAnimatedStyle` animate a style
 * property. This drives a plain `requestAnimationFrame` loop that writes intermediate values
 * into React state, which is the standard, low-tech way this specific thing gets done in React
 * Native — a handful of renders over ~500ms, not a persistent cost.
 *
 * Because it bypasses Reanimated, it does NOT get that library's automatic reduce-motion
 * handling for free (see `useReducedMotion`'s own doc for why) — checked here explicitly, and
 * when it's on the number just jumps straight to the new value.
 */
import { useEffect, useRef, useState } from 'react';

import { Txt, type TxtProps } from './Txt';
import { Motion } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Ease-out cubic: fast at first, settling gently into the final number rather than arriving
 *  at a constant rate — the same "decelerate into place" feel `Motion.easing.entrance` uses
 *  for everything else in the app, expressed as a plain JS function since this runs off the
 *  UI thread. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface CountUpProps extends Omit<TxtProps, 'children'> {
  /** The number to display. Animates from whatever it last rendered to this. */
  value: number;
  /** Turns the current (possibly mid-count) number into display text — add a ₹, commas, a
   *  unit. Defaults to plain Indian-locale grouping, which is what a bare count wants. */
  format?: (n: number) => string;
  duration?: number;
}

export function CountUp({
  value, format = (n) => Math.round(n).toLocaleString('en-IN'), duration = Motion.timing.chart, ...txtProps
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    if (reduceMotion) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    let frame: number;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setDisplay(from + (to - from) * easeOutCubic(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  return <Txt {...txtProps} tabular>{format(display)}</Txt>;
}
