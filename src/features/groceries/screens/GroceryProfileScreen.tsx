import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';

const MENU_ITEMS = [
  { id: '1', title: 'Manage Addresses', icon: 'location-outline' as const },
  { id: '2', title: 'Payment Methods', icon: 'card-outline' as const },
  { id: '3', title: 'Need Help?', icon: 'chatbubbles-outline' as const },
  { id: '4', title: 'Settings', icon: 'settings-outline' as const },
];

/** The groceries mini-app's own profile tab — the real signed-in account (whichever role
 *  is shopping: owner, manager, chef, or resident), not a stand-in. Logout is the same
 *  action the rest of the app uses (`usePGowStore.logout`, see `GroceryOrdersScreen`). */
export function GroceryProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = usePGowStore((s) => s.logout);

  const name = user?.name ?? 'PGow User';
  const phone = user?.phone ?? '';
  const avatarLetter = name.trim().charAt(0).toUpperCase() || 'P';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            {!!phone && <Text style={styles.userPhone}>{phone}</Text>}
          </View>
        </View>

        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon} size={20} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
              {index < MENU_ITEMS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    paddingHorizontal: 16,
    // SafeAreaView above already applies insets.top — this is only the extra buffer, same
    // 14/16px every other grocery screen uses (was double-padding on Android: insets.top+40).
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerTitle: {
    fontSize: 20,
    color: Colors.textPrimary,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.surface,
    marginTop: 16,
    marginBottom: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  menuContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginLeft: 48,
  },
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 32,
    marginBottom: 110,
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: Radii.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  logoutText: {
    color: Colors.danger,
    fontSize: 16,
  },
});
