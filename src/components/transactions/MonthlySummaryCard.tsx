import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface MonthlySummaryCardProps {
  amount: number;
  changePercentage: number;
  currencySymbol: string;
}

export const MonthlySummaryCard: React.FC<MonthlySummaryCardProps> = React.memo(({
  amount,
  changePercentage,
  currencySymbol,
}) => {
  const { colors, isDark } = useTheme();
  const isNegative = changePercentage < 0;
  const formattedPercent = Math.abs(changePercentage).toFixed(1);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.leftCol}>
        <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{"This Month's Spending"}</Text>
        <Text 
          style={[styles.amountText, { color: colors.text }]} 
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {currencySymbol}
          {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View
        style={[
          styles.badge,
          {
            backgroundColor: isNegative 
              ? (isDark ? '#451A1A' : '#FEE2E2') 
              : (isDark ? '#143C28' : '#D1FAE5'),
          },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            {
              color: isNegative ? '#EF4444' : '#10B981',
            },
          ]}
        >
          {isNegative ? '▼' : '▲'} {isNegative ? '-' : '+'}{formattedPercent}%
        </Text>
      </View>
    </View>
  );
});

MonthlySummaryCard.displayName = 'MonthlySummaryCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    padding: 20,
    marginTop: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  leftCol: {
    flex: 1,
    paddingRight: 10,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  amountText: {
    fontSize: 48,
    fontWeight: '800',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
