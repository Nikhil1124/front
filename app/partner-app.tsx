/**
 * Where a laundry provider or a service technician lands if they sign into THIS app.
 *
 * Both used to be served here — a provider had a Jobs tab and a technician was about to get
 * one. Both moved to standalone apps, PGow Laundry and PGow Services, because a worker
 * carrying a bag of clothes or a spanner has nothing else to do in a resident's app, and
 * keeping them here made every PGow release their release too.
 *
 * Their account still authenticates here perfectly well, which is the whole problem: without
 * this screen they hold no membership, fall into the owner branch, and are shown "Add your
 * first property" — an invitation to create a PG put in front of somebody who must never do
 * that. So this screen opens the app they want — straight away on landing, and again from the
 * button — and only names it when it is not installed.
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Btn, Col, Spacer, Txt } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { Colors, Radii } from '@/theme';

/** Which app to send them to, by the grant they hold. A provider and a technician get
 *  different answers, and "one of our other apps" would help neither. */
function partnerAppFor(roles: Set<string>): { name: string; icon: string; work: string; url: string } {
  // The partner apps' own schemes — see pgow_laundry / pgow_services app.config.ts.
  if (roles.has('laundry_provider')) {
    return { name: 'PGow Laundry', icon: 'shirt-outline', work: 'pickups', url: 'pgowlaundry://' };
  }
  return { name: 'PGow Services', icon: 'construct-outline', work: 'repair jobs', url: 'pgowservices://' };
}

export default function PartnerAppScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = usePGowStore((s) => s.logout);
  const target = partnerAppFor(new Set((user?.platform_roles ?? []).map((g) => g.role)));
  // Null until the first attempt resolves; false means the app is not on this phone.
  const [installed, setInstalled] = useState<boolean | null>(null);

  const openPartnerApp = () =>
    Linking.openURL(target.url).then(
      () => setInstalled(true),
      () => setInstalled(false),
    );

  // Landing here is always a mistake for this person, so go on to their app without a tap.
  useEffect(() => {
    openPartnerApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.url]);

  return (
    <View style={styles.root}>
      <Col align="center" style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name={target.icon as never} size={30} color={Colors.primary} />
        </View>
        <Spacer size={16} />
        <Txt variant="screenTitle" color={Colors.textPrimary} align="center">
          Your work is in {target.name}
        </Txt>
        <Spacer size={8} />
        <Txt variant="body" color={Colors.textSecondary} align="center">
          {user?.name ? `${user.name}, your` : 'Your'} {target.work} are in {target.name}.{' '}
          {installed === false
            ? `It is not installed on this phone. Install ${target.name}, then sign in with this same phone number and password.`
            : 'Sign in there with this same phone number and password.'}
        </Txt>
        <Spacer size={28} />
        <Btn
          onPress={openPartnerApp}
          containerColor={Colors.primary}
          textColor={Colors.textInverse}
          borderRadius={Radii.control}
          height={48}
          style={{ width: '100%' }}
          testID="partner_open_app"
        >
          <Txt variant="button" color={Colors.textInverse}>Open {target.name}</Txt>
        </Btn>
        <Spacer size={12} />
        <Btn
          onPress={() => { logout(); router.replace('/'); }}
          containerColor={Colors.surfaceElevated}
          textColor={Colors.textPrimary}
          borderRadius={Radii.control}
          height={48}
          style={{ width: '100%' }}
          testID="partner_sign_out"
        >
          <Txt variant="button" color={Colors.textPrimary}>Sign out</Txt>
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
