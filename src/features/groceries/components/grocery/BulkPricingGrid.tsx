import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppColors, AppFonts } from '../../theme/AppColors';
import { PricingOption } from '../../data/mockProducts';
import { getPerUnitRateLabel, parseUnitQuantity } from '../../utils/pricing';

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
      <Text style={styles.heading}>🏢 Best Value for PG Owners</Text>
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
              <TouchableOpacity
                key={opt.unit}
                style={[styles.column, isSelected && styles.selectedColumn]}
                onPress={() => onSelect(i)}
                activeOpacity={0.8}
              >
                <Text style={styles.columnUnit}>{opt.unit}</Text>
                <Text style={styles.columnPrice}>₹{opt.price}</Text>
                <Text style={styles.columnRate}>{perUnitRate}</Text>

                {isBestValue ? (
                  <View style={styles.bestValueTag}>
                    <Text style={styles.bestValueTagText}>Best Value</Text>
                  </View>
                ) : calcSavings > 0 ? (
                  <View style={styles.savingsTag}>
                    <Text style={styles.savingsTagText}>Save ₹{calcSavings}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Savings highlight block */}
        <View style={styles.savingsBlock}>
          <Text style={styles.savingsTitle}>You Save</Text>
          <Text style={styles.savingsPrice}>₹{currentSavings || 0}</Text>
          <Text style={styles.savingsSubtitle}>
            {currentSavings > 0
              ? `on ${options[selectedIdx]?.unit} pack`
              : 'Buy bulk to save'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.primaryLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.softGreen,
    padding: 14,
    marginBottom: 14,
  },
  heading: {
    fontSize: 13,
    fontFamily: AppFonts.bold,
    color: AppColors.primaryDark,
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
    backgroundColor: AppColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 8,
    alignItems: 'center',
    gap: 3,
  },
  selectedColumn: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.softGreen,
  },
  columnUnit: {
    fontSize: 11,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
  },
  columnPrice: {
    fontSize: 13,
    fontFamily: AppFonts.bold,
    color: AppColors.primary,
  },
  columnRate: {
    fontSize: 10,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.regular,
  },
  bestValueTag: {
    backgroundColor: AppColors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  bestValueTagText: {
    color: AppColors.surface,
    fontSize: 8,
    fontFamily: AppFonts.bold,
  },
  savingsTag: {
    backgroundColor: AppColors.error,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  savingsTagText: {
    color: AppColors.surface,
    fontSize: 8,
    fontFamily: AppFonts.bold,
  },
  savingsBlock: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    padding: 8,
  },
  savingsTitle: {
    fontSize: 10,
    color: AppColors.softGreen,
    fontFamily: AppFonts.regular,
  },
  savingsPrice: {
    fontSize: 20,
    fontFamily: AppFonts.bold,
    color: AppColors.surface,
  },
  savingsSubtitle: {
    fontSize: 8,
    color: AppColors.softGreen,
    fontFamily: AppFonts.regular,
    textAlign: 'center',
    marginTop: 2,
  },
});
