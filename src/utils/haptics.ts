/**
 * Haptics — reintroduced, deliberately narrow.
 *
 * `expo-haptics` was installed but unused everywhere in this app; `AnimatedPress`'s own doc
 * comment records that the vibration feedback it used to carry "was removed entirely". This
 * brings it back only where the iOS HIG's own rule for haptics applies cleanly: confirming
 * that a REAL, consequential state change just happened — not decorating an ordinary tap. A
 * KYC or payment decision and publishing an announcement qualify; switching a tab or opening
 * a row does not, and does not get one.
 *
 * Two calls, not a menu of feedback types to choose from at each call site — `hapticSuccess`
 * for a decision that went through the way the person intended, `hapticCaution` for one that
 * went through as a deliberate negative (a reject) — that is still a successful operation, not
 * a failure, so it is `NotificationFeedbackType.Warning`, not `.Error`. `.Error` is reserved
 * for something that stays out of this file's job: a request that failed outright, which
 * every one of these actions already reports through its existing `Alert.alert('Failed', …)`
 * path and was explicitly not part of what this pass was asked to add haptics to.
 */
import * as Haptics from 'expo-haptics';

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticCaution(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
