import { View, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPress, Row, Txt } from '@/components/ui';
import { LaundryItem } from '../store/useLaundryStore';
import { Radii, Colors, Palette } from '@/theme';

type LaundryCardProps = {
  item: LaundryItem;
  qty: number;
  onUpdateQty: (delta: number) => void;
};

export function LaundryCard({ item, qty, onUpdateQty }: LaundryCardProps) {
  // Determine the source for the image
  let imageSource: any;
  if (item.name === 'Bedsheet' || item.name === 'Blanket') imageSource = require('../../../../assets/laundry/bedsheet.png');
  else if (item.name === 'Saree') imageSource = require('../../../../assets/laundry/saree.png');
  else if (item.name === 'Suit' || item.name === 'Blazer' || item.name === 'Jacket') imageSource = require('../../../../assets/laundry/suit.png');
  else if (item.name.includes('Sneakers') || item.name.includes('Shoes')) imageSource = require('../../../../assets/laundry/sneakers.png');
  else if (item.name === 'Handbag') imageSource = require('../../../../assets/laundry/handbag.png');
  else if (item.category === 'Wash & Fold') imageSource = require('../../../../assets/laundry/clothes_stack.png');
  else if (item.category === 'Wash & Iron') imageSource = require('../../../../assets/laundry/iron.png');
  else if (item.category === 'Dry Cleaning' || item.category === 'Home Linen') imageSource = require('../../../../assets/laundry/washing_machine.png');
  else if (item.category === 'Shoes & Bags') imageSource = require('../../../../assets/laundry/laundry_basket.png');

  return (
    <AnimatedPress style={styles.cardContainer} accessibilityRole="button">
      {/* Top Image Section */}
      <View style={styles.imageSection}>
        {imageSource && <Image source={imageSource} style={styles.cardImage} />}
        
        {/* Discount Badge */}
        <View style={styles.discountBadge}>
          <Txt style={styles.discountText}>15% OFF</Txt>
        </View>
        
        {/* Heart Icon */}
        <View style={styles.heartCircle}>
          <Ionicons name="heart-outline" size={18} color={Colors.textMuted} />
        </View>
        
        {/* Fresh & Clean Badge */}
        <View style={styles.leafBadge}>
          <Ionicons name="leaf" size={12} color={Colors.success} />
          <Txt style={styles.leafText}>Fresh & Clean</Txt>
        </View>
      </View>

      {/* Bottom Details Section */}
      <View style={styles.detailsSection}>
        <Txt maxFontSizeMultiplier={1.3} style={styles.cardTitle} numberOfLines={1}>{item.name}</Txt>
        <Txt maxFontSizeMultiplier={1.3} style={styles.cardSubtitle} numberOfLines={1}>{item.category}</Txt>
        
        <Row style={{ marginTop: 6, gap: 6, alignItems: 'baseline' }}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.cardPrice}>₹{item.price}/{item.unit}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.cardStrike}>₹{Math.round(item.price * 1.15)}</Txt>
        </Row>

        {/* Add / Qty Button */}
        {qty > 0 ? (
          <Row align="center" justify="space-between" style={styles.qtyContainer}>
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => onUpdateQty(-1)} style={styles.qtyBtn}>
              <Ionicons name="remove" size={16} color={Colors.success} />
            </AnimatedPress>
            <Txt maxFontSizeMultiplier={1.3} style={styles.qtyText}>{qty}</Txt>
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => onUpdateQty(1)} style={styles.qtyBtn}>
              <Ionicons name="add" size={16} color={Colors.success} />
            </AnimatedPress>
          </Row>
        ) : (
          <AnimatedPress accessibilityRole="button" style={styles.addButton} onPress={() => onUpdateQty(1)}>
            <Ionicons name="add" size={16} color={Colors.success} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.addButtonText}>Add</Txt>
          </AnimatedPress>
        )}
      </View>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  cardContainer: { width: 160, marginRight: 12, backgroundColor: Colors.surface, borderRadius: Radii.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: Colors.surfaceMuted },
  imageSection: { height: 120, backgroundColor: '#EBF4EC', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  discountBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: '#FF5252', borderBottomRightRadius: 12, borderTopLeftRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { color: Colors.textInverse, fontSize: 10, fontWeight: '800' },
  heartCircle: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, backgroundColor: Colors.surface, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  leafBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: Palette.TintGreen, borderRadius: Radii.control, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Palette.TintGreen },
  leafText: { color: '#064E3B', fontSize: 9, fontWeight: '700' },
  
  detailsSection: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  cardSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: Colors.success },
  cardStrike: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through', fontWeight: '500' },
  
  addButton: { marginTop: 10, borderWidth: 1, borderColor: Colors.success, borderRadius: Radii.badge, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addButtonText: { color: Colors.success, fontSize: 13, fontWeight: '700' },
  
  qtyContainer: { marginTop: 10, borderWidth: 1, borderColor: Colors.success, borderRadius: Radii.badge, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: Palette.TintGreen },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: Colors.success, fontSize: 13, fontWeight: '800' },
});
