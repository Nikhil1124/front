import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { StyleSheet, ImageBackground, View } from 'react-native';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { Col, Row, Txt } from '@/components/ui';

export function ChefGroceriesShortcut() {
  const activeRole = usePGowStore((s) => s.activeRole);
  if (activeRole !== 'CHEF') return null;

  const GROCERY_BG = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80";

  return (
    <AnimatedPress accessibilityRole="button" onPress={() => router.push('/groceries')}>
      <ImageBackground source={{ uri: GROCERY_BG }} style={styles.groceryBanner} imageStyle={{ borderRadius: 20 }}>
        <View style={styles.groceryOverlay} />
        <Row align="center" justify="space-between" style={{ zIndex: 2 }}>
          <Row align="center" gap={16}>
            <View style={styles.cartIconBox}>
              <Ionicons name="cart-outline" size={24} color={Colors.textInverse} />
            </View>
            <Col>
              <Txt size={18} weight="800" color={Colors.textInverse}>Groceries</Txt>
              <Txt size={13} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>Request kitchen supplies</Txt>
            </Col>
          </Row>
          <View style={styles.bannerArrow}>
            <Ionicons name="chevron-forward" size={18} color={Colors.primaryDark} />
          </View>
        </Row>
      </ImageBackground>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  groceryBanner: { height: 110, borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.primaryDark, justifyContent: 'center', paddingHorizontal: 24, shadowColor: Colors.primaryDark, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6, marginBottom: 4 },
  groceryOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 10, 80, 0.4)' },
  cartIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  bannerArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
});
