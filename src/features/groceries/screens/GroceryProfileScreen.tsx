import { StyleSheet, View, ScrollView, Alert } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Palette, Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { AnimatedPress, Txt } from '@/components/ui';

const MENU_ITEMS = [
  { id: '1', title: 'Manage Addresses', icon: 'location-outline' as const },
  { id: '2', title: 'Payment Methods', icon: 'card-outline' as const },
  { id: '3', title: 'Need Help?', icon: 'chatbubbles-outline' as const },
  { id: '4', title: 'Settings', icon: 'settings-outline' as const },
];

/** The groceries mini-app's profile screen — styled with the official LUNA palette */
export function GroceryProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = usePGowStore((s) => s.logout);

  const name = user?.name ?? 'PGow User';
  const phone = user?.phone ?? '';
  const avatarLetter = name.trim().charAt(0).toUpperCase() || 'P';

  return (
    <HubScreenWrapper title="Grocery Account" scrollable={false} contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.avatarText}>{avatarLetter}</Txt>
          </View>
          <View style={styles.userInfo}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.userName}>{name}</Txt>
            {!!phone && <Txt maxFontSizeMultiplier={1.3} style={styles.userPhone}>{phone}</Txt>}
          </View>
        </View>

        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item.id}>
              {/* This tab is shared by every signed-in role (owner, guest, staff...), and
                  none of these four have a real screen to route to yet — "Manage Addresses"
                  and "Payment Methods" have no dedicated concept anywhere in the app (grocery
                  delivery always goes to the PG's own address), and "Need Help?"/"Settings"
                  do exist, but only for some roles, at routes ('/support', '/profile') that
                  don't exist for the others. Rather than silently do nothing on tap, or guess
                  wrong and send someone to a route their role doesn't have, this says so. */}
              <AnimatedPress accessibilityRole="button"
                style={styles.menuItem}
                onPress={() => Alert.alert(item.title, 'Not available yet — coming soon.')}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon} size={20} color={Colors.primary} />
                  </View>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.menuTitle}>{item.title}</Txt>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </AnimatedPress>
              {index < MENU_ITEMS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <AnimatedPress accessibilityRole="button" style={styles.logoutBtn} onPress={() => logout()}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.logoutText}>Log Out</Txt>
        </AnimatedPress>
      </ScrollView>
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16 },
  avatarText: {
    color: Colors.textInverse,
    fontSize: 22,
    fontWeight: '700' },
  userInfo: {
    flex: 1 },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2 },
  userPhone: {
    fontSize: 13,
    color: Colors.textSecondary },
  menuContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 16,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14 },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center' },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginLeft: 48 },
  logoutBtn: {
    marginTop: 24,
    marginBottom: 40,
    backgroundColor: Palette.TintRed,
    paddingVertical: 14,
    borderRadius: Radii.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Palette.TintRed },
  logoutText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '700' } });
