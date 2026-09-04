import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { OwnerSetupGate } from '@/features/owner/OwnerSetupGate';

export default function OwnerLayout() {
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Covers everything above until a property and a bed layout exist — except the two
          routes that create them. See OwnerSetupGate for why it overlays the stack rather
          than replacing it. */}
      <OwnerSetupGate />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
