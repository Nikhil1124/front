import { Keyframe, Easing } from 'react-native-reanimated';

export const Motion = {
  timing: {
    micro: 120,          // micro-interactions, button taps
    small: 180,          // toggles, filters, chips
    tab: 200,            // bottom tab transitions
    modal: 200,          // alert/dialog entries
    navigation: 280,     // normal screen slide durations
    sheet: 300,          // bottom drawer sheet slide-ups
    layout: 300,         // item insertions/deletions
    chart: 500,          // statistics reveal transitions
  },
  easing: {
    entrance: Easing.out(Easing.quad),
    exit: Easing.in(Easing.quad),
    standard: Easing.inOut(Easing.quad),
  },
} as const;

// Tab-swap keyframes used to live here. Removed with the tab transition itself —
// see the tab `_layout.tsx` files for why (perceived lag, plus a forced remount).

// Center Dialog scale-fade transitions:
// Incoming scales gently from 0.96 -> 1.0 with a fade. Outgoing scales down to 0.96 with a fade.
export const dialogEntering = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ scale: 0.96 }],
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
}).duration(Motion.timing.modal);

export const dialogExiting = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  100: {
    opacity: 0,
    transform: [{ scale: 0.96 }],
  },
}).duration(Motion.timing.modal);

// Toast banner transitions:
// Drops in from 12dp above with a fade, leaves the same way. The vertical direction matters —
// it reads as "arrived from off-screen", which is what separates a transient notice from a
// card that was always part of the layout.
export const toastEntering = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: -12 }],
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
}).duration(Motion.timing.modal);

export const toastExiting = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  100: {
    opacity: 0,
    transform: [{ translateY: -12 }],
  },
}).duration(Motion.timing.small);
