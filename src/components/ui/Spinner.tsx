/**
 * Spinner — the app's one loading indicator.
 *
 * Plain `ActivityIndicator` rather than a Reanimated custom ring: the platform spinner
 * already matches what a user expects, runs on the UI thread for free, and respects
 * "reduce motion" without any work here. The only thing worth owning is the colour, which
 * defaults to the brand green so a spinner never shows up in iOS grey on a mint canvas.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Colors } from '@/theme';

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
        <Text maxFontSizeMultiplier={1.3} style={[styles.label, { fontSize: 12, fontWeight: '600', color: Colors.textMuted }]}>
          {label}
        </Text>
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
 * The other half of a query's non-happy path. Without this a failed fetch renders as an
 * empty list, which reads as "there is nothing here" — the one thing it does not mean.
 */
export function ErrorState({ error, title = 'Could not load this', onRetry, fill = true }: ErrorStateProps) {
  const message =
    error instanceof Error && error.message ? error.message : 'Something went wrong. Pull down to try again.';
  return (
    <View style={[fill ? styles.fill : styles.block]}>
      <View style={styles.errIcon}>
        <Ionicons name="cloud-offline-outline" size={28} color={Colors.danger} />
      </View>
      <Text maxFontSizeMultiplier={1.3} style={[styles.label, { fontSize: 14, fontWeight: '800', color: Colors.textPrimary }]}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={1.3} style={[styles.message, { fontSize: 12, color: Colors.textMuted }]}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading" style={styles.retry}>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, fontWeight: '800', color: Colors.primary }}>
            Tap to retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  block: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  label: { marginTop: 10, textAlign: 'center' },
  message: { marginTop: 4, textAlign: 'center', lineHeight: 17 },
  retry: { marginTop: 12 },
  errIcon: {
    width: 56, height: 56, borderRadius: Radii.pill,
    backgroundColor: `${Colors.danger}14`,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default Spinner;
