/**
 * Where a PGow ops account lands if they sign into the app.
 *
 * Area managers and super admins work from the web portal — areas, staff roles, dispatch,
 * catalogue, stock and the laundry queue are all there, and all of them want a wide screen.
 * Without this they fall into the owner branch, because they hold no membership either, and
 * are shown "Add your first property": an invitation to create a PG, put in front of the one
 * kind of user who must never do that from here.
 *
 * Saying so plainly beats a dashboard that is not theirs. The sign-out is the only action,
 * because it is the only one that makes sense on this screen.
 */
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Btn, Col, Spacer, Txt } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { Colors, Radii } from '@/theme';

export default function OpsPortalScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = usePGowStore((s) => s.logout);

  return (
    <View style={styles.root}>
      <Col align="center" style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="desktop-outline" size={30} color={Colors.primary} />
        </View>
        <Spacer size={16} />
        <Txt variant="screenTitle" color={Colors.textPrimary} align="center">
          PGow ops works on the web
        </Txt>
        <Spacer size={8} />
        <Txt variant="body" color={Colors.textSecondary} align="center">
          {user?.name ? `${user.name}, your` : 'Your'} account manages areas, staff and the
          laundry queue — all of that lives in the ops portal, not the app.
        </Txt>
        <Spacer size={28} />
        <Btn
          onPress={() => { logout(); router.replace('/'); }}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={Radii.control}
          height={48}
          style={{ width: '100%' }}
          testID="ops_sign_out"
        >
          <Txt variant="button" color={Colors.textInverse}>Sign out</Txt>
        </Btn>
      </Col>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas, justifyContent: 'center', padding: 28 },
  body: { width: '100%' },
  icon: {
    width: 72, height: 72, borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
});
