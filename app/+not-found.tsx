/**
 * 404 Screen — Rendered when an unmapped route is accessed.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Page Not Found',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.LuxurySurfaceDark },
          headerTintColor: Colors.IvoryWhiteText,
        }}
      />
      <View style={styles.container}>
        <Ionicons name="alert-circle-sharp" size={64} color={Colors.CyberGreen} style={styles.icon} />
        <Text style={styles.title}>404 - Screen Not Found</Text>
        <Text style={styles.subtitle}>The page or route you requested does not exist in PGow App.</Text>

        <Link href="/" asChild>
          <TouchableOpacity style={styles.button}>
            <Ionicons name="home-sharp" size={18} color={Colors.LuxuryPureBlack} />
            <Text style={styles.buttonText}>Return to Home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.LuxuryPureBlack,
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
    color: Colors.IvoryWhiteText,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.SlateMutedText,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.CyberGreen,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.LuxuryPureBlack,
  },
});
