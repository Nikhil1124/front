/**
 * 404 Screen — Rendered when an unmapped route is accessed.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Colors } from '@/theme';
import { AnimatedPress } from '@/components/ui/AnimatedPress';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Page Not Found',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
        }}
      />
      <View style={styles.container}>
        <Ionicons name="alert-circle-sharp" size={64} color={Colors.primary} style={styles.icon} />
        <Text maxFontSizeMultiplier={1.3} style={styles.title}>404 - Screen Not Found</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.subtitle}>The page or route you requested does not exist in PGow App.</Text>

        <Link href="/" asChild>
          <AnimatedPress accessibilityRole="button" style={styles.button}>
            <Ionicons name="home-sharp" size={18} color={Colors.textInverse} />
            <Text maxFontSizeMultiplier={1.3} style={styles.buttonText}>Return to Home</Text>
          </AnimatedPress>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radii.card,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
