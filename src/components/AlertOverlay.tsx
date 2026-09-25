/**
 * The app's one toast — replaces what used to render here: a full-width Card banner with a
 * giant icon bubble and an all-caps tagline per type ("✓ CONFIRMATION", "⚠️ ACTION NOTICE",
 * "🔔 NOTICE"), for every single confirmation in the app — RSVP, payment, login, KYC, staff
 * edits. It looked like a system alert, not a toast, and it fired on every login ("Welcome
 * back") the same way it fired on every other action.
 *
 * `activeAlert` is set from ~45 call sites across the store and `useToast` — none of them know
 * what the confirmation looks like. A small left-accent bar carries the tone instead of a
 * coloured icon circle plus a shouting subtitle; one line of title, two of description, done.
 *
 * The one piece here that is more than a toast — the Eat/Skip buttons on a foregrounded meal
 * push — stays, sized to match rather than dominating the card the way it used to.
 *
 * Three things make it behave the way a notification is supposed to:
 *
 * 1. **It clears the header.** It used to sit at `insets.top + 8`, which is *above* where every
 *    role header draws its own content (`insets.top + 12..14`) — so for the whole life of the
 *    toast it covered the back button, the screen title and the notification bell, and because
 *    the card is itself a `TouchableOpacity` it swallowed those taps rather than passing them
 *    through. Tapping "back" during a toast dismissed the toast. It now offsets by the full
 *    header band, which is the Material "banner sits below the app bar" rule.
 * 2. **It is announced.** A card that appears and vanishes inside three seconds does not exist
 *    for a screen-reader user unless something says it out loud, so it does.
 * 3. **It reads at the speed of its own content.** A bare title cleared in 2.2s; a title plus a
 *    two-line description did not. The timeout now scales with what is actually in the card.
 *
 * Top placement (rather than a bottom snackbar) is deliberate: the login toasts fire while the
 * keyboard may still be up, and a bottom-anchored card would be behind it.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, AccessibilityInfo, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radii, Colors, toastEntering, toastExiting } from '@/theme';
import { HEADER_BAND_HEIGHT } from '@/components/AppHeader';
import { usePGowStore } from '@/store/usePGowStore';
import type { SimulatedAlert } from '@/types';
import { AnimatedPress, Row, Txt } from '@/components/ui';
import { useNotificationAdQuery } from '@/features/ads/useAds';

interface ToastStyle {
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function toastStyleFor(type: string): ToastStyle {
  switch (type) {
    case 'MEAL':
      return { accent: Colors.primary, icon: 'restaurant' };
    case 'PAYMENT':
      return { accent: Colors.warning, icon: 'card' };
    case 'SUCCESS':
      return { accent: Colors.success, icon: 'checkmark-circle' };
    case 'ERROR':
      return { accent: Colors.danger, icon: 'alert-circle' };
    default:
      return { accent: Colors.info, icon: 'notifications' };
  }
}

/** Every screen now draws the same header, so there is one number to clear rather than a max
 *  over competing designs. */
const HEADER_CLEARANCE = HEADER_BAND_HEIGHT;

/** Eat/Skip on a meal toast — and on a failed answer (`ERROR` with the meal's id), so the
 *  resident can try again from the same card. */
const hasRSVP = (a: SimulatedAlert) =>
  a.notificationId != null && (a.type === 'MEAL' || a.type === 'ERROR');

/** How long the card stays up, in ms. A card waiting on a tap outlives one only being read,
 *  and a description outlives a bare title. */
function durationFor(alert: SimulatedAlert): number {
  if (hasRSVP(alert)) return 6000;
  return alert.description ? 4000 : 2600;
}

export function AlertOverlay() {
  const insets = useSafeAreaInsets();
  const activeAlert = usePGowStore((s) => s.activeAlert);
  const dismiss = usePGowStore((s) => s.dismissAlert);

  const isDismissing = useRef(false);

  const handleDismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    dismiss();
  }, [dismiss]);

  const stamp = activeAlert?.timestamp;
  const title = activeAlert?.title;
  const description = activeAlert?.description;
  const ms = activeAlert ? durationFor(activeAlert) : 0;

  useEffect(() => {
    if (!stamp) return;
    isDismissing.current = false;

    // Without this the toast is invisible to TalkBack/VoiceOver: it never takes focus and it is
    // gone before a linear traversal would ever reach it.
    AccessibilityInfo.announceForAccessibility(
      description ? `${title}. ${description}` : String(title),
    );

    const timer = setTimeout(handleDismiss, ms);
    return () => clearTimeout(timer);
  }, [stamp, title, description, ms, handleDismiss]);

  // The container stays mounted so reanimated has something to run the exit animation inside;
  // box-none keeps it transparent to touches everywhere the card itself is not.
  return (
    <View
      style={[styles.overlay, { top: insets.top + HEADER_CLEARANCE }]}
      pointerEvents="box-none"
    >
      {activeAlert ? (
        <ToastCard key={activeAlert.timestamp} alert={activeAlert} onDismiss={handleDismiss} />
      ) : null}
    </View>
  );
}

function ToastCard({ alert, onDismiss }: { alert: SimulatedAlert; onDismiss: () => void }) {
  const submitRSVPFromNotification = usePGowStore((s) => s.submitRSVPFromNotification);
  const [rsvpChoice, setRsvpChoice] = useState<string | null>(null);

  const style = toastStyleFor(alert.type);
  const showRSVP = hasRSVP(alert);
  // The sponsor's own picture: the same PGow ad the meal card shows. This was a grey box with
  // an image icon, standing in for a picture the toast never had. No ad running, no picture —
  // and none on a failed answer: an ad over "RSVP not recorded" sells nothing.
  const offersMeal = showRSVP && alert.type === 'MEAL';
  const { data: ad } = useNotificationAdQuery(0, offersMeal);
  const adImage = offersMeal ? ad?.image_url : null;

  const answer = (choice: 'EATING' | 'SKIPPING') => {
    if (alert.notificationId == null) return;
    setRsvpChoice(choice);
    submitRSVPFromNotification(alert.notificationId, choice === 'EATING' ? 'REQUIRED' : 'NOT_REQUIRED');
  };

  return (
    <Animated.View entering={toastEntering} exiting={toastExiting} style={styles.animWrap}>
      <AnimatedPress
        accessibilityRole="button"
        // Announced by the effect above; the label here is what a user gets when they land on the
        // card by traversal and need to know that tapping is what closes it.
        accessibilityLabel={alert.description ? `${alert.title}. ${alert.description}` : alert.title}
        accessibilityHint="Dismisses this notification"
        accessibilityLiveRegion="polite"
        onPress={onDismiss}
        style={[styles.toast, { borderLeftColor: style.accent }]}
      >
        <View style={styles.headerRow}>
          <Ionicons name={style.icon} size={18} color={style.accent} style={styles.icon} />
          <View style={{ flex: 1 }}>
            <Txt size={13} weight="700" color={Colors.textPrimary} numberOfLines={1}>
              {alert.title}
            </Txt>
            {alert.description ? (
              <Txt size={11} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 1, lineHeight: 15 }}>
                {alert.description}
              </Txt>
            ) : null}
          </View>
        </View>

        {adImage ? (
          <Image
            source={{ uri: adImage }}
            style={styles.banner}
            resizeMode="cover"
            accessibilityLabel={ad?.brand_name ? `${ad.brand_name} offer` : 'Sponsor offer'}
          />
        ) : null}

        {showRSVP && (
          <View style={{ marginTop: 12 }}>
            {rsvpChoice == null ? (
              <Row gap={8}>
                <AnimatedPress accessibilityRole="button" onPress={() => answer('EATING')} style={[styles.miniBtn, { backgroundColor: Colors.success, flex: 1, alignItems: 'center' }]}>
                  <Txt size={13} weight="700" color={Colors.textInverse}>I'll eat</Txt>
                </AnimatedPress>
                <AnimatedPress accessibilityRole="button" onPress={() => answer('SKIPPING')} style={[styles.miniBtn, { backgroundColor: Colors.danger, flex: 1, alignItems: 'center' }]}>
                  <Txt size={13} weight="700" color={Colors.textInverse}>Skip</Txt>
                </AnimatedPress>
              </Row>
            ) : (
              <Txt size={12} weight="700" color={Colors.success} style={{ textAlign: 'center' }}>
                Marked as {rsvpChoice === 'EATING' ? 'eating' : 'skipping'} ✓
              </Txt>
            )}
          </View>
        )}
      </AnimatedPress>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    alignItems: 'center',
  },
  animWrap: { width: '100%', maxWidth: 420 },
  toast: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: { marginTop: 1 },
  /** The sponsor's picture; the muted fill shows only while it loads. */
  banner: {
    marginTop: 12,
    height: 140,
    width: '100%',
    backgroundColor: Colors.borderMuted,
    borderRadius: Radii.control,
    overflow: 'hidden',
  },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.control,
  },
});
