/**
 * Placeholder for an `AppScreen` that has a route but no built screen behind it yet.
 * Wraps `HubScreenWrapper` for the same sticky back header every other spoke screen uses.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Spacer } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors } from '@/theme';

interface Props {
  title?: string;
  description?: string;
}

export function InProgressScreen({
  title = 'Coming Soon',
  description = "This screen isn't built yet — check back in a future update.",
}: Props) {
  return (
    <HubScreenWrapper title={title} scrollable={false}>
      <View style={styles.center}>
        <Ionicons name="construct-outline" size={48} color={Colors.textMuted} />
        <Spacer size={12} />
        <Txt variant="sectionTitle" weight="800" color={Colors.textPrimary} align="center">In Progress</Txt>
        <Spacer size={6} />
        <Txt variant="body" color={Colors.textMuted} align="center" style={{ maxWidth: 280 }}>
          {description}
        </Txt>
      </View>
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
