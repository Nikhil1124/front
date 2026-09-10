import React from 'react';
import { View, StyleSheet } from 'react-native';

;
import { Radii, Colors } from '@/theme';
import { getPerUnitRateLabel, parseUnitQuantity } from '../../utils/pricing';
import { AnimatedPress, Txt } from '@/components/ui';

export interface PricingOption {
  unit: string;
  price: number;
  originalPrice?: number;
}

interface BulkPricingGridProps {
  options: PricingOption[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  currentSavings: number;
}

/**
 * Bulk pricing comparison grid for owner mode.
 * Extracted from product/[id].tsx — Section 10 ("Best Value for PG Owners").
 */

export const BulkPricingGrid: React.FC<BulkPricingGridProps> = ({
  options,
  selectedIdx,
  onSelect,
  currentSavings,
}) => {
  return (
    <View style={styles.card}>
      <Txt maxFontSizeMultiplier={1.3} style={styles.heading}>🏢 Best Value for PG Owners</Txt>
      <View style={styles.gridRow}>
        <View style={styles.columnsWrapper}>
          {options.map((opt, i) => {
            const isSelected = selectedIdx === i;
            const isBestValue = i === options.length - 1;
            const perUnitRate = getPerUnitRateLabel(opt.unit, opt.price);

            const firstOpt = options[0];
            const expected = (firstOpt.price / parseUnitQuantity(firstOpt.unit)) * parseUnitQuantity(opt.unit);
            const calcSavings = Math.round(expected - opt.price);

            return (
              <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                key={opt.unit}
                style={[styles.column, isSelected && styles.selectedColumn]}
                onPress={() => onSelect(i)}

              >
                <Txt maxFontSizeMultiplier={1.3} style={styles.columnUnit}>{opt.unit}</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.columnPrice}>₹{opt.price}</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.columnRate}>{perUnitRate}</Txt>

                {isBestValue ? (
                  <View style={styles.bestValueTag}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.bestValueTagText}>Best Value</Txt>
                  </View>
                ) : calcSavings > 0 ? (
                  <View style={styles.savingsTag}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.savingsTagText}>Save ₹{calcSavings}</Txt>
                  </View>
                ) : null}
              </AnimatedPress>
            );
          })}
        </View>

        {/* Savings highlight block */}
        <View style={styles.savingsBlock}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.savingsTitle}>You Save</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.savingsPrice}>₹{currentSavings || 0}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.savingsSubtitle}>
            {currentSavings > 0
              ? `on ${options[selectedIdx]?.unit} pack`
              : 'Buy bulk to save'}
          </Txt>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    marginBottom: 14,
  },
  heading: {
    fontSize: 13,
    color: Colors.primaryDark,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  columnsWrapper: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  column: {
    flex: 1,
    minWidth: 60,
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 8,
    alignItems: 'center',
    gap: 3,
  },
  selectedColumn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  columnUnit: {
    fontSize: 11,
    color: Colors.textPrimary,
  },
  columnPrice: {
    fontSize: 13,
    color: Colors.primary,
  },
  columnRate: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  bestValueTag: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.badge,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  bestValueTagText: {
    color: Colors.surface,
    fontSize: 8,
  },
  savingsTag: {
    backgroundColor: Colors.danger,
    borderRadius: Radii.badge,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  savingsTagText: {
    color: Colors.surface,
    fontSize: 8,
  },
  savingsBlock: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radii.control,
    padding: 8,
  },
  savingsTitle: {
    fontSize: 10,
    color: Colors.surfaceElevated,
  },
  savingsPrice: {
    fontSize: 20,
    color: Colors.surface,
  },
  savingsSubtitle: {
    fontSize: 8,
    color: Colors.surfaceElevated,
    textAlign: 'center',
    marginTop: 2,
  },
});
