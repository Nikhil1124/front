/**
 * The app's one toast — replaces what used to render here: a full-width Card banner with a
 * giant icon bubble and an all-caps tagline per type ("✓ CONFIRMATION", "⚠️ ACTION NOTICE",
 * "🔔 NOTICE"), for every single confirmation in the app — RSVP, payment, login, KYC, staff
 * edits. It looked like a system alert, not a toast, and it fired on every login ("Welcome
 * back") the same way it fired on every other action.
 *
 * This is a rendering change only. `activeAlert` is set from ~45 call sites across the store
 * and `useToast` — none of them changed, because none of them should have to know what the
 * confirmation looks like. A small left-accent bar carries the tone instead of a coloured
 * icon circle plus a shouting subtitle; one line of title, one line of description, done.
 *
 * The one piece here that is more than a toast — the Eat/Skip buttons on a foregrounded meal
 * push — stays, sized to match rather than dominating the card the way it used to.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt, Row } from '@/components/ui';
import { Colors, Motion } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

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

export function AlertOverlay() {
  const insets = useSafeAreaInsets();
  const activeAlert = usePGowStore((s) => s.activeAlert);
  const dismiss = usePGowStore((s) => s.dismissAlert);
  const submitRSVPFromNotification = usePGowStore((s) => s.submitRSVPFromNotification);

  const [rsvpChoice, setRsvpChoice] = useState<string | null>(null);
  const isDismissing = useRef(false);

  const handleDismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    setRsvpChoice(null);
    if (activeAlert) {
      isDismissing.current = false;

      const isMealWithNotif = activeAlert.type === 'MEAL' && activeAlert.notificationId != null;
      // A plain toast reads in under two seconds; the meal card needs longer because it is
      // waiting on a tap, not just being read.
      const durationMs = isMealWithNotif ? 6000 : 2200;

      const timer = setTimeout(() => {
        handleDismiss();
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [activeAlert?.timestamp, activeAlert?.type, activeAlert?.notificationId, handleDismiss]);

  if (!activeAlert) return null;

  const style = toastStyleFor(activeAlert.type);
  const isMealWithNotif = activeAlert.type === 'MEAL' && activeAlert.notificationId != null;

  const handleEat = () => {
    if (activeAlert.notificationId != null) {
      setRsvpChoice('EATING');
      submitRSVPFromNotification(activeAlert.notificationId, 'REQUIRED');
    }
  };

  const handleSkip = () => {
    if (activeAlert.notificationId != null) {
      setRsvpChoice('SKIPPING');
      submitRSVPFromNotification(activeAlert.notificationId, 'NOT_REQUIRED');
    }
  };

  return (
    <View style={[styles.overlay, { top: Math.max(insets.top, 8) + 8 }]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleDismiss}
        style={[styles.toast, { borderLeftColor: style.accent }]}
      >
        <Ionicons name={style.icon} size={18} color={style.accent} style={styles.icon} />
        <View style={{ flex: 1 }}>
          <Txt size={13} weight="700" color={Colors.textPrimary} numberOfLines={1}>
            {activeAlert.title}
          </Txt>
          {activeAlert.description ? (
            <Txt size={11} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 1, lineHeight: 15 }}>
              {activeAlert.description}
            </Txt>
          ) : null}

          {isMealWithNotif && (
            <View style={{ marginTop: 8 }}>
              {rsvpChoice == null ? (
                <Row gap={6}>
                  <TouchableOpacity onPress={handleEat} style={[styles.miniBtn, { backgroundColor: Colors.success }]}>
                    <Txt size={11} weight="700" color={Colors.textInverse}>I'll eat</Txt>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSkip} style={[styles.miniBtn, { backgroundColor: Colors.danger }]}>
                    <Txt size={11} weight="700" color={Colors.textInverse}>Skip</Txt>
                  </TouchableOpacity>
                </Row>
              ) : (
                <Txt size={11} weight="700" color={Colors.success}>
                  Marked as {rsvpChoice === 'EATING' ? 'eating' : 'skipping'} ✓
                </Txt>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    // A soft shadow reads as "floating above the screen", which is what tells the eye this
    // is a transient toast and not another card in the layout underneath it.
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  icon: { marginTop: 1 },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
});
