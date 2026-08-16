import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
import { hapticSelect } from '@/utils/haptics';

export function WelcomeScreen() {

  return (
    <View style={styles.root}>
      {/* Top Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.brandContainer}>
          <Txt size={42} weight="900" color={Colors.primary} align="center" style={styles.title}>
            PGow
          </Txt>
          <View style={styles.taglineBadge}>
            <Txt size={11} weight="800" color={Colors.primaryDark} align="center" style={styles.tagline}>
              SMART CO-LIVING & PG MANAGEMENT
            </Txt>
          </View>
        </View>

        <Txt size={13} weight="800" color={Colors.textSecondary} align="center" style={styles.portalHeading}>
          CHOOSE YOUR PORTAL
        </Txt>
      </View>

      {/* Main Portal Selection Cards (No descriptions, direct action buttons) */}
      <View style={styles.cardsContainer}>
        {/* PG Owner / Admin Portal */}
        <AnimatedPress
          scale={0.985}
          hapticPattern="light"
          onPress={() => { hapticSelect(); router.push('/owner-login'); }}
        >
          <Card
            containerColor={Colors.surface}
            borderRadius={18}
            borderWidth={1.5}
            borderColor={Colors.borderSubtle}
            padding={[16, 14]}
            style={styles.cardShadow}
          >
            <Row align="center" gap={10} style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(13, 148, 136, 0.12)' }]}>
                <Ionicons name="business" size={20} color={Colors.primary} />
              </View>
              <Txt size={15} weight="800" color={Colors.textPrimary}>
                PG Owner / Admin
              </Txt>
            </Row>

            <Row gap={10}>
              <Btn
                onPress={() => { hapticSelect(); router.push('/owner-register'); }}
                containerColor={Colors.primary}
                textColor={Colors.textInverse}
                borderRadius={12}
                height={44}
                style={{ flex: 1.1 }}
                testID="welcome_register_button"
              >
                <Txt size={13} weight="700" color={Colors.textInverse}>Register PG</Txt>
              </Btn>
              <OutlinedBtn
                onPress={() => { hapticSelect(); router.push('/owner-login'); }}
                borderColor={Colors.primary}
                textColor={Colors.primary}
                borderRadius={12}
                height={44}
                style={{ flex: 1 }}
                testID="welcome_login_button"
              >
                <Txt size={13} weight="700" color={Colors.primary}>Owner Login</Txt>
              </OutlinedBtn>
            </Row>
          </Card>
        </AnimatedPress>

        {/* Resident / Paying Guest Portal */}
        <AnimatedPress
          scale={0.985}
          hapticPattern="light"
          onPress={() => { hapticSelect(); router.push('/guest-join'); }}
        >
          <Card
            containerColor={Colors.surface}
            borderRadius={18}
            borderWidth={1.5}
            borderColor={Colors.borderSubtle}
            padding={[16, 14]}
            style={styles.cardShadow}
          >
            <Row align="center" gap={10} style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="home" size={20} color={Colors.success} />
              </View>
              <Txt size={15} weight="800" color={Colors.textPrimary}>
                Resident / Guest
              </Txt>
            </Row>

            <Btn
              onPress={() => { hapticSelect(); router.push('/guest-join'); }}
              containerColor={Colors.success}
              textColor={Colors.textInverse}
              borderRadius={12}
              height={44}
            >
              <Ionicons name="log-in-outline" size={18} color={Colors.textInverse} style={{ marginRight: 6 }} />
              <Txt size={13} weight="800" color={Colors.textInverse}>
                Resident Login / Join
              </Txt>
            </Btn>
          </Card>
        </AnimatedPress>

        {/* Kitchen Staff & Operations */}
        <AnimatedPress
          scale={0.985}
          hapticPattern="light"
          onPress={() => { hapticSelect(); router.push('/staff-login'); }}
        >
          <Card
            containerColor={Colors.surface}
            borderRadius={18}
            borderWidth={1.5}
            borderColor={Colors.borderSubtle}
            padding={[16, 14]}
            style={styles.cardShadow}
          >
            <Row align="center" gap={10} style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#f0f0f0ff' }]}>
                <Ionicons name="restaurant" size={20} color={Colors.CyberAmber} />
              </View>
              <Txt size={15} weight="800" color={Colors.textPrimary}>
                Kitchen Staff & Chefs Portal
              </Txt>
            </Row>

            <Btn
              onPress={() => { hapticSelect(); router.push('/staff-login'); }}
              containerColor="#000000ff"
              textColor={Colors.CyberAmber}
              borderRadius={12}
              height={44}
            >
              <Ionicons name="restaurant" size={18} color={Colors.CyberAmber} style={{ marginRight: 6 }} />
              <Txt size={13} weight="700" color={Colors.CyberAmber}>
                Open Staff Dashboard
              </Txt>
            </Btn>
          </Card>
        </AnimatedPress>
      </View>

      {/* Clean Bottom Note */}
      <View style={styles.footer}>
        <Txt size={11} weight="600" color={Colors.textMuted} align="center">
          Secure-Smart Living Experience
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    letterSpacing: -1.2,
  },
  taglineBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginTop: 4,
  },
  tagline: {
    letterSpacing: 1.2,
  },
  portalHeading: {
    letterSpacing: 1.5,
    marginTop: 8,
  },
  cardsContainer: {
    gap: 11,
    marginTop: 100,
  },
  cardHeader: {
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShadow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
});
