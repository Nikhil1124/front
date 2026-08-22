import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Txt, Btn, Spacer, Col } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/theme';

export default function DeliveryAgentPlaceholder() {
  const insets = useSafeAreaInsets();
  const staff = usePGowStore((s) => s.loggedInStaff);
  const logout = usePGowStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Col align="center" justify="center" style={{ flex: 1, paddingHorizontal: 24 }}>
        <Ionicons name="bicycle" size={80} color={Colors.primary} />
        <Spacer size={24} />
        <Txt size={24} weight="900" color={Colors.primaryDark} align="center">
          Delivery App Required
        </Txt>
        <Spacer size={12} />
        <Txt size={16} color={Colors.textPrimary} align="center" style={{ lineHeight: 24 }}>
          Hi {staff?.name?.split(' ')[0] ?? 'there'}, you've logged into the main PGow management app.
        </Txt>
        <Spacer size={16} />
        <Card containerColor={Colors.surfaceElevated} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]} style={{ width: '100%' }}>
          <Txt size={14} color={Colors.textSecondary} align="center" style={{ lineHeight: 22 }}>
            To view your deliveries, routes, and manage your profile, please download and use the dedicated <Txt weight="800" color={Colors.primaryDark}>PGow Delivery App</Txt>.
          </Txt>
        </Card>
        <Spacer size={32} />
        <Btn onPress={handleLogout} containerColor={Colors.danger} textColor="#FFFFFF" borderRadius={12} height={50} style={{ width: '100%' }}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Txt size={15} weight="800" style={{ marginLeft: 8 }}>Sign Out</Txt>
        </Btn>
      </Col>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
