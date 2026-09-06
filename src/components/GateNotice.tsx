/**
 * What a resident sees when ADR-004's gate closes a screen to them.
 *
 * The gate (`pg-backend/app/deps/gates.py`) blocks three things for a pure guest — listing
 * meals, opening one, and submitting an RSVP — and answers with a 403 carrying the reason:
 * KYC not submitted / awaiting review / rejected, or this month's rent not yet confirmed.
 *
 * Before this existed those screens had no branch for it, so a gated resident fell through to
 * the ordinary empty state and was told **"No meals posted yet"** — which is untrue and
 * unactionable. The chef had posted meals; the resident simply could not see them, and the
 * screen offered no hint as to why or what to do about it.
 *
 * Deliberately rendered inline, where the blocked action is, rather than by navigating: the
 * app's gate handler is a no-op on purpose (see `app/_layout.tsx`) because moving someone on
 * a gate changes the flow instead of reporting it.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Radii, Colors } from '@/theme';
import { PGowApiError } from '@/data/apiClient';
import { gateCodeFrom, type GateCode } from '@/data/gateCodes';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Txt } from '@/components/ui/Txt';

/** The gate code behind an error, or null when it is an ordinary failure. The rule itself
 *  lives in `data/gateCodes.ts` so it can be checked without a react-native import. */
export function gateCodeOf(error: unknown): GateCode | null {
  if (!(error instanceof PGowApiError)) return null;
  return gateCodeFrom(error.httpStatus, error.code);
}

interface GateCopy {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  body: string;
  /** Omitted where there is nothing for the resident to do but wait. */
  action?: { label: string; go: () => void };
}

const COPY: Record<GateCode, GateCopy> = {
  RENT_UNPAID: {
    icon: 'wallet-outline',
    tint: Colors.warning,
    title: 'Pay this month’s rent to unlock meals',
    body:
      'Meals open up as soon as your payment for this month is confirmed by your PG owner. '
      + 'You can pay any time during the month.',
    action: { label: 'Go to Payments', go: () => router.push('/(guest)/(tabs)/guest-payments') },
  },
  KYC_REQUIRED: {
    icon: 'shield-outline',
    tint: Colors.warning,
    title: 'Submit your ID to unlock meals',
    body: 'Your PG needs to verify who you are before you can see and respond to meals.',
    action: { label: 'Complete Verification', go: () => router.push('/(guest)/(tabs)/profile') },
  },
  KYC_PENDING: {
    icon: 'hourglass-outline',
    tint: Colors.warning,
    title: 'Verification under review',
    body:
      'Your PG owner is reviewing the documents you submitted. Meals unlock as soon as they '
      + 'approve them — nothing more is needed from you right now.',
  },
  KYC_REJECTED: {
    icon: 'alert-circle-outline',
    tint: Colors.danger,
    title: 'Your verification was rejected',
    body: 'Check the reason on your profile and re-upload your documents to unlock meals.',
    action: { label: 'Re-submit Documents', go: () => router.push('/(guest)/(tabs)/profile') },
  },
  // Never reaches a gated screen: the app routes a forced password change at sign-in, before
  // any of this is on screen. Present so the map stays total over GateCode.
  PASSWORD_CHANGE_REQUIRED: {
    icon: 'key-outline',
    tint: Colors.warning,
    title: 'Set a new password to continue',
    body: 'Your account still has its temporary password. Sign out and set your own to continue.',
  },
};

/**
 * Renders the matching notice, or nothing when `error` is not a gate.
 *
 * `compact` is for the places a full card does not fit — the home hero's narrow column —
 * and keeps the same copy so the two surfaces cannot drift apart.
 */
export function GateNotice({ error, compact = false }: { error: unknown; compact?: boolean }) {
  const code = gateCodeOf(error);
  if (!code) return null;
  const copy = COPY[code];

  if (compact) {
    const Wrapper: any = copy.action ? AnimatedPress : View;
    return (
      <Wrapper
        style={styles.compact}
        onPress={copy.action?.go}

      >
        <Txt variant="cardTitle" color={copy.tint} numberOfLines={2} style={styles.compactTitle}>
          {copy.title}
        </Txt>
        {copy.action && (
          <View style={styles.compactCta}>
            <Txt variant="meta" weight="600" color={Colors.primary}>{copy.action.label}</Txt>
            <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
          </View>
        )}
      </Wrapper>
    );
  }

  return (
    <View style={styles.box}>
      <View style={[styles.iconWrap, { backgroundColor: `${copy.tint}1A` }]}>
        <Ionicons name={copy.icon} size={26} color={copy.tint} />
      </View>
      <Txt variant="sectionTitle" color={Colors.textPrimary} align="center">{copy.title}</Txt>
      <Txt variant="body" color={Colors.textMuted} align="center" style={styles.body}>{copy.body}</Txt>
      {copy.action && (
        <AnimatedPress accessibilityRole="button" style={styles.button} onPress={copy.action.go}>
          <Txt variant="button" color={Colors.textInverse}>{copy.action.label}</Txt>
        </AnimatedPress>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginVertical: 8,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  body: {
    marginTop: 8,
  },
  button: {
    height: 46,
    minWidth: 200,
    paddingHorizontal: 22,
    borderRadius: Radii.card,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  compact: { marginTop: 4 },
  compactTitle: { lineHeight: 18 },
  compactCta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
});
