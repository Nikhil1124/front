/**
 * Spinner — the app's one loading indicator.
 *
 * Plain `ActivityIndicator` rather than a Reanimated custom ring: the platform spinner
 * already matches what a user expects, runs on the UI thread for free, and respects
 * "reduce motion" without any work here. The only thing worth owning is the colour, which
 * defaults to the brand green so a spinner never shows up in iOS grey on a mint canvas.
 */
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Colors } from '@/theme';
import { PGowApiError } from '@/data/apiClient';
import { Txt } from './Txt';
import { AnimatedPress } from './AnimatedPress';

export interface SpinnerProps {
  /** 'small' ≈ 20dp, 'large' ≈ 36dp — the two sizes RN actually supports on both platforms. */
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
}

export function Spinner({ size = 'small', color = Colors.primary, style }: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} style={style} />;
}

export interface LoadingStateProps {
  /** Say what is loading. "Loading…" on its own tells the user nothing they cannot see. */
  label?: string;
  size?: 'small' | 'large';
  /** Fill the available space and centre — for a whole screen rather than a section. */
  fill?: boolean;
  style?: ViewStyle;
}

/** Centred spinner with an optional caption, for a screen or section that has no data yet. */
export function LoadingState({ label, size = 'large', fill = true, style }: LoadingStateProps) {
  return (
    <View style={[fill ? styles.fill : styles.block, style]}>
      <Spinner size={size} />
      {label ? (
        <Txt variant="meta" weight="600" color={Colors.textMuted} align="center" style={styles.label}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  /** The thrown error. `PGowApiError.message` is already user-facing copy from the server. */
  error?: unknown;
  /** Shown above the server's message — what the user was trying to see. */
  title?: string;
  onRetry?: () => void;
  fill?: boolean;
}

/**
 * A 4xx is an answer, not a hiccup. `queryClient` already refuses to retry one automatically
 * for that reason — but the retry BUTTON was still drawn whenever a caller passed `onRetry`,
 * so a permission failure offered the user an action that cannot ever succeed. Tapping it
 * re-runs the same request against the same role and fails identically.
 *
 * 403 in particular has to look different from every other failure: the request was
 * understood and refused, so the honest message is about access, not about the network.
 */
function retryability(error: unknown): { canRetry: boolean; icon: 'cloud-offline-outline' | 'lock-closed-outline'; title?: string } {
  const status = error instanceof PGowApiError ? error.httpStatus : undefined;
  if (status === 403) {
    return { canRetry: false, icon: 'lock-closed-outline', title: 'You do not have access to this' };
  }
  // 401 tears down to the login screen elsewhere; 404 and 422 are equally final here.
  if (status === 401 || status === 404 || status === 422) {
    return { canRetry: false, icon: 'cloud-offline-outline' };
  }
  return { canRetry: true, icon: 'cloud-offline-outline' };
}

/**
 * The other half of a query's non-happy path. Without this a failed fetch renders as an
 * empty list, which reads as "there is nothing here" — the one thing it does not mean.
 */
export function ErrorState({ error, title, onRetry, fill = true }: ErrorStateProps) {
  const { canRetry, icon, title: forcedTitle } = retryability(error);
  const heading = forcedTitle ?? title ?? 'Could not load this';
  const message =
    error instanceof Error && error.message ? error.message : 'Something went wrong. Pull down to try again.';
  return (
    <View style={[fill ? styles.fill : styles.block]}>
      <View style={styles.errIcon}>
        <Ionicons name={icon} size={28} color={Colors.danger} />
      </View>
      <Txt variant="cardTitle" color={Colors.textPrimary} align="center" style={styles.label}>
        {heading}
      </Txt>
      <Txt variant="meta" color={Colors.textMuted} align="center" style={styles.message}>
        {message}
      </Txt>
      {onRetry && canRetry ? (
        <AnimatedPress onPress={onRetry} accessibilityLabel="Retry loading" style={styles.retry}>
          <Txt variant="button" color={Colors.primary}>
            Tap to retry
          </Txt>
        </AnimatedPress>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  block: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  label: { marginTop: 10, textAlign: 'center' },
  message: { marginTop: 4 },
  retry: { marginTop: 12 },
  errIcon: {
    width: 56, height: 56, borderRadius: Radii.pill,
    backgroundColor: `${Colors.danger}14`,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default Spinner;
