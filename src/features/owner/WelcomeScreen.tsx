import { ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
// Official LUNA Design System Tokens
const BRAND_NAVY = Colors.primaryDark;       // Obsidian Navy
const BRAND_MIDNIGHT = Colors.textSecondary;   // Deep Midnight Blue
const BRAND_OCEAN = Colors.primary;      // Deep Ocean Blue
const BRAND_CYAN = Colors.secondary;       // Cyan Teal
const BRAND_ICE = '#A7EBF2';        // Soft Ice Cyan
const BRAND_BG = Colors.canvas;         // Light Ice Canvas
const CHARCOAL = Colors.textPrimary;  // Body/heading text — softened from the 15.94:1 navy
const TEXT_MUTED = Colors.primary;       // Ocean Text Muted
const BORDER_COLOR = Colors.borderSubtle;     // Ice Cyan Border
const CARD_BG = '#FFFFFF';

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.outerContainer}>
      {/* Background Watermark Decorations */}
      <View style={styles.topRightCircle} pointerEvents="none" />

      <View style={styles.dotGrid} pointerEvents="none">
        {[...Array(3)].map((_, i) => (
          <Row gap={4} key={i}>
            {[...Array(3)].map((_, j) => (
              <View key={j} style={styles.gridDot} />
            ))}
          </Row>
        ))}
      </View>

      <View style={styles.bottomLeftHouse} pointerEvents="none">
        <Ionicons name="home-outline" size={90} color={Colors.surfaceElevated} />
      </View>

      <View style={styles.bottomRightHouse} pointerEvents="none">
        <Ionicons name="business-outline" size={100} color={Colors.surfaceElevated} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.root, { paddingTop: insets.top + 24 }]}>
        {/* Centered Compact Header */}
        <View style={styles.headerSection}>
          <Txt size={38} weight="900" color={BRAND_NAVY} align="center" style={styles.logo}>
            PGow
          </Txt>
          <Txt size={9} weight="800" color={BRAND_CYAN} align="center" style={styles.tagline}>
            SMART CO-LIVING & PG MANAGEMENT
          </Txt>

          {/* Custom dot-divider line */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          <Txt size={22} weight="900" color={CHARCOAL} align="center" style={styles.heading}>
            Choose Your Portal
          </Txt>
          <Txt size={12} weight="600" color={TEXT_MUTED} align="center" style={styles.subheading}>
            One Platform. Every Role. Seamless Experience.
          </Txt>
        </View>

        {/* Main Portal Cards */}
        <View style={styles.cardsContainer}>

          {/* Card 1: PG Owner / Admin Portal */}
          <AnimatedPress
            scale={0.99}
            onPress={() => { router.push('/owner-login'); }}
          >
            <Card
              containerColor={CARD_BG}
              borderRadius={22}
              borderWidth={1}
              borderColor={BORDER_COLOR}
              padding={[18, 16]}
              style={styles.cardShadow}
            >
              <Row align="center" justify="space-between" style={{ width: '100%' }}>
                <Row align="center" gap={12} style={{ flex: 1 }}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="business" size={18} color={BRAND_OCEAN} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={15} weight="800" color={CHARCOAL}>
                      PG Owner / Admin
                    </Txt>
                    <Txt size={11} color={TEXT_MUTED} style={styles.description}>
                      Manage properties, tenants, payments and operations with ease.
                    </Txt>
                  </Col>
                </Row>
                <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} style={{ marginLeft: 4 }} />
              </Row>

              <Spacer size={10} />
              <Row gap={8}>
                <Btn
                  onPress={() => { router.push('/owner-register'); }}
                  containerColor={BRAND_OCEAN}
                  textColor="#FFFFFF"
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1.1 }}
                  testID="welcome_register_button"
                >
                  <Row align="center" gap={6}>
                    <Ionicons name="person-add" size={16} color="#FFFFFF" />
                    <Txt size={13} weight="800" color="#FFFFFF">Register PG</Txt>
                  </Row>
                </Btn>
                <OutlinedBtn
                  onPress={() => { router.push('/owner-login'); }}
                  borderColor={BRAND_OCEAN}
                  textColor={BRAND_OCEAN}
                  borderRadius={10}
                  height={44}
                  style={{ flex: 1 }}
                  testID="welcome_login_button"
                >
                  <Row align="center" gap={6}>
                    <Ionicons name="log-in-outline" size={16} color={BRAND_OCEAN} />
                    <Txt size={13} weight="800" color={BRAND_OCEAN}>Owner Login</Txt>
                  </Row>
                </OutlinedBtn>
              </Row>
            </Card>
          </AnimatedPress>

          {/* Card 2: Resident / Guest Portal */}
          <AnimatedPress
            scale={0.99}
            onPress={() => { router.push('/guest-join'); }}
          >
            <Card
              containerColor={CARD_BG}
              borderRadius={22}
              borderWidth={1}
              borderColor={BORDER_COLOR}
              padding={[18, 16]}
              style={styles.cardShadow}
            >
              <Row align="center" justify="space-between" style={{ width: '100%' }}>
                <Row align="center" gap={12} style={{ flex: 1 }}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="home" size={18} color={BRAND_OCEAN} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={15} weight="800" color={CHARCOAL}>
                      Resident / Guest
                    </Txt>
                    <Txt size={11} color={TEXT_MUTED} style={styles.description}>
                      Find your home, connect with your community and enjoy hassle-free living.
                    </Txt>
                  </Col>
                </Row>
                <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} style={{ marginLeft: 4 }} />
              </Row>

              <Spacer size={10} />
              <Btn
                onPress={() => { router.push('/guest-join'); }}
                containerColor={BRAND_OCEAN}
                textColor="#FFFFFF"
                borderRadius={10}
                height={44}
              >
                <Row align="center" gap={6}>
                  <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
                  <Txt size={13} weight="800" color="#FFFFFF">
                    Resident Login / Join
                  </Txt>
                </Row>
              </Btn>
            </Card>
          </AnimatedPress>

          {/* Card 3: Staff & Operations Portal */}
          <AnimatedPress
            scale={0.99}
            onPress={() => { router.push('/staff-login'); }}
          >
            <Card
              containerColor={CARD_BG}
              borderRadius={22}
              borderWidth={1}
              borderColor={BORDER_COLOR}
              padding={[18, 16]}
              style={styles.cardShadow}
            >
              <Row align="center" justify="space-between" style={{ width: '100%' }}>
                <Row align="center" gap={12} style={{ flex: 1 }}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.surfaceElevated }]}>
                    <Ionicons name="people" size={18} color={BRAND_CYAN} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={15} weight="800" color={CHARCOAL}>
                      Staff & Operations Portal
                    </Txt>
                    <Txt size={11} color={TEXT_MUTED} style={styles.description}>
                      For Chefs & Maintenance Crew
                    </Txt>
                  </Col>
                </Row>
                <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} style={{ marginLeft: 4 }} />
              </Row>

              {/* Subtle Styled Badges */}
              <Row gap={6} style={styles.badgeRow}>
                <View style={styles.staffBadge}>
                  <Row align="center" gap={4}>
                    <Ionicons name="restaurant-outline" size={13} color={BRAND_CYAN} />
                    <Txt size={10} weight="700" color={BRAND_MIDNIGHT}>Kitchen</Txt>
                  </Row>
                </View>
                <View style={styles.staffBadge}>
                  <Row align="center" gap={4}>
                    <Ionicons name="construct-outline" size={13} color={BRAND_CYAN} />
                    <Txt size={10} weight="700" color={BRAND_MIDNIGHT}>Maintenance</Txt>
                  </Row>
                </View>
              </Row>

              <Spacer size={10} />
              <OutlinedBtn
                onPress={() => { router.push('/staff-login'); }}
                borderColor={BRAND_OCEAN}
                textColor={BRAND_OCEAN}
                borderRadius={10}
                height={44}
                style={{ backgroundColor: '#FFFFFF' }}
              >
                <Row align="center" gap={6}>
                  <Ionicons name="people" size={16} color={BRAND_OCEAN} />
                  <Txt size={13} weight="800" color={BRAND_OCEAN}>
                    Open Staff & Operations Portal
                  </Txt>
                </Row>
              </OutlinedBtn>
            </Card>
          </AnimatedPress>

        </View>

        {/* Structured Trust Strip Card */}
        <View style={styles.footerSection}>
          <Card
            containerColor="#FFFFFF"
            borderRadius={16}
            borderWidth={1}
            borderColor={BORDER_COLOR}
            padding={[12, 10]}
            style={styles.trustCard}
          >
            <Row align="center" justify="space-between" style={{ width: '100%' }}>
              <Col align="center" style={{ flex: 1 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={BRAND_OCEAN} />
                <Spacer size={4} />
                <Txt size={9} weight="700" color={CHARCOAL} align="center">Secure</Txt>
                <Txt size={9} weight="700" color={CHARCOAL} align="center">& Reliable</Txt>
              </Col>

              <View style={styles.verticalDivider} />

              <Col align="center" style={{ flex: 1 }}>
                <Ionicons name="flash-outline" size={18} color={BRAND_OCEAN} />
                <Spacer size={4} />
                <Txt size={9} weight="700" color={CHARCOAL} align="center">Easy</Txt>
                <Txt size={9} weight="700" color={CHARCOAL} align="center">to Use</Txt>
              </Col>

              <View style={styles.verticalDivider} />

              <Col align="center" style={{ flex: 1 }}>
                <Ionicons name="time-outline" size={18} color={BRAND_OCEAN} />
                <Spacer size={4} />
                <Txt size={9} weight="700" color={CHARCOAL} align="center">Real-time</Txt>
                <Txt size={9} weight="700" color={CHARCOAL} align="center">Updates</Txt>
              </Col>

              <View style={styles.verticalDivider} />

              <Col align="center" style={{ flex: 1 }}>
                <Ionicons name="headset-outline" size={18} color={BRAND_OCEAN} />
                <Spacer size={4} />
                <Txt size={9} weight="700" color={CHARCOAL} align="center">24/7</Txt>
                <Txt size={9} weight="700" color={CHARCOAL} align="center">Support</Txt>
              </Col>
            </Row>
          </Card>

          {/* Heart Icon tagline at the bottom */}
          <Row align="center" justify="center" gap={4} style={styles.footerTaglineRow}>
            <Ionicons name="heart-outline" size={11} color={TEXT_MUTED} />
            <Txt size={10} weight="700" color={TEXT_MUTED} align="center">
              Building Better Co-Living Experiences
            </Txt>
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: BRAND_BG,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  root: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    letterSpacing: -1,
  },
  tagline: {
    letterSpacing: 1.5,
    marginTop: 2,
  },
  dividerContainer: {
    width: 120,
    height: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER_COLOR,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_OCEAN,
    marginHorizontal: 8,
  },
  heading: {
    letterSpacing: -0.2,
  },
  subheading: {
    marginTop: 4,
  },
  cardsContainer: {
    gap: 14,
    marginBottom: 20,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  badgeRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  staffBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: Colors.surfaceElevated,
  },
  cardShadow: {
    shadowColor: BRAND_NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  footerSection: {
    alignItems: 'center',
    gap: 8,
  },
  trustCard: {
    width: '100%',
    shadowColor: BRAND_NAVY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  verticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: BORDER_COLOR,
  },
  footerTaglineRow: {
    marginTop: 8,
    opacity: 0.8,
  },
  topRightCircle: {
    position: 'absolute',
    right: -40,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: Colors.surfaceElevated,
    zIndex: -1,
  },
  dotGrid: {
    position: 'absolute',
    right: 30,
    top: 140,
    gap: 4,
    zIndex: -1,
  },
  gridDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_COLOR,
  },
  bottomLeftHouse: {
    position: 'absolute',
    left: -24,
    bottom: 240,
    opacity: 0.25,
    zIndex: -1,
  },
  bottomRightHouse: {
    position: 'absolute',
    right: -24,
    bottom: 120,
    opacity: 0.25,
    zIndex: -1,
  },
});
