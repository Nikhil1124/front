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

// Bottom Tab Swapping transitions:
// Incoming fades in and rises up by 4dp. Outgoing fades out and shifts up by 4dp.
export const tabEntering = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: 4 }],
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
}).duration(Motion.timing.tab);

export const tabExiting = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  100: {
    opacity: 0,
    transform: [{ translateY: -4 }],
  },
}).duration(Motion.timing.tab);

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
