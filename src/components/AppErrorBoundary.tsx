/**
 * The app's last line of defence against a render-time crash.
 *
 * Wired in as `app/_layout.tsx`'s `ErrorBoundary` export — Expo Router's own convention
 * (see `expo-router/views/Try`), so this catches anything thrown while rendering the route
 * tree beneath the root layout. Without it, a single bad render anywhere in the app unmounts
 * the whole tree and the user is left staring at a blank screen with no way back.
 *
 * Deliberately avoids providers and stores: this renders *because* something below already
 * failed, and Expo Router mounts it around the root layout's output — so the providers that
 * layout sets up are not guaranteed to be there.
 */
import { Component, type ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { Radii, Colors } from '@/theme';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Txt } from '@/components/ui/Txt';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // No crash reporter wired up yet, so this console line is the only record that survives.
  // On a release build it reaches `adb logcat` / the device console, which is thin but is the
  // difference between "the app closed" and a reproducible stack.
  console.error('[PGow] unhandled render error:', error);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text maxFontSizeMultiplier={1.3} style={styles.emoji}>⚠️</Text>
        <Txt variant="screenTitle" color={Colors.textPrimary} align="center">Something went wrong</Txt>
        <Txt variant="body" color={Colors.textMuted} align="center" style={styles.body}>
          This screen ran into an unexpected problem. Your data is safe — nothing you saved has
          been lost.
        </Txt>

        {__DEV__ && (
          <ScrollView style={styles.devBox} contentContainerStyle={{ padding: 12 }}>
            <Txt variant="caption" weight="600" color={Colors.danger}>DEV ONLY — {error.name}</Txt>
            <Txt variant="meta" color={Colors.textPrimary} style={styles.devText}>{error.message}</Txt>
            {!!error.stack && <Txt variant="caption" color={Colors.textMuted} style={styles.devStack}>{error.stack}</Txt>}
          </ScrollView>
        )}

        <AnimatedPress accessibilityRole="button" style={styles.button} onPress={retry}>
          <Txt variant="button" color={Colors.textInverse}>Try Again</Txt>
        </AnimatedPress>

        <Txt variant="meta" color={Colors.textMuted} align="center" style={styles.hint}>
          If it keeps happening, close the app fully and reopen it.
        </Txt>
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
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 24,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  body: {
    marginTop: 8,
  },
  devBox: {
    alignSelf: 'stretch',
    maxHeight: 200,
    marginTop: 16,
    borderRadius: Radii.card,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  devText: { marginTop: 6 },
  devStack: { marginTop: 8 },
  button: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: Radii.card,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  hint: { marginTop: 12 },
});
