/**
 * The app's last line of defence against a render-time crash.
 *
 * Wired in as `app/_layout.tsx`'s `ErrorBoundary` export — Expo Router's own convention
 * (see `expo-router/views/Try`), so this catches anything thrown while rendering the route
 * tree beneath the root layout. Without it, a single bad render anywhere in the app unmounts
 * the whole tree and the user is left staring at a blank screen with no way back.
 *
 * Deliberately built from bare `react-native` primitives and plain theme constants: this
 * renders *because* something below already failed, and Expo Router mounts it around the root
 * layout's output — so the providers that layout sets up (safe-area, query client, gesture
 * handler) are not guaranteed to be there. Anything this component needed from a provider or
 * a store would be a second crash with nothing left to catch it.
 */
import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { Colors } from '@/theme';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // No crash reporter wired up yet, so this console line is the only record that survives.
  // On a release build it reaches `adb logcat` / the device console, which is thin but is the
  // difference between "the app closed" and a reproducible stack.
  console.error('[PGow] unhandled render error:', error);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text maxFontSizeMultiplier={1.3} style={styles.emoji}>⚠️</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.title}>Something went wrong</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.body}>
          This screen ran into an unexpected problem. Your data is safe — nothing you saved has
          been lost.
        </Text>

        {__DEV__ && (
          <ScrollView style={styles.devBox} contentContainerStyle={{ padding: 12 }}>
            <Text maxFontSizeMultiplier={1.3} style={styles.devLabel}>DEV ONLY — {error.name}</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.devText}>{error.message}</Text>
            {!!error.stack && <Text maxFontSizeMultiplier={1.3} style={styles.devStack}>{error.stack}</Text>}
          </ScrollView>
        )}

        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={retry} activeOpacity={0.85}>
          <Text maxFontSizeMultiplier={1.3} style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>

        <Text maxFontSizeMultiplier={1.3} style={styles.hint}>
          If it keeps happening, close the app fully and reopen it.
        </Text>
      </View>
    </View>
  );
}

/**
 * The same fallback, as a self-contained class boundary.
 *
 * Expo Router's `ErrorBoundary` export only guards the route tree. Mount this directly around
 * anything that renders outside it — or around one risky subtree you want to fail in
 * isolation rather than taking its whole screen down.
 */
export class ErrorBoundaryView extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  retry = async () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <AppErrorBoundary error={this.state.error} retry={this.retry} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    // No safe-area provider guaranteed here (see the doc comment) — a generous fixed inset
    // keeps the card clear of a notch or status bar without depending on one.
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 40,
    paddingBottom: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 24,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  devBox: {
    alignSelf: 'stretch',
    maxHeight: 200,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  devLabel: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.5 },
  devText: { fontSize: 12, color: Colors.textPrimary, marginTop: 6 },
  devStack: { fontSize: 10, color: Colors.textMuted, marginTop: 8, lineHeight: 14 },
  button: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: { fontSize: 15, fontWeight: '800', color: Colors.textInverse },
  hint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 12 },
});
