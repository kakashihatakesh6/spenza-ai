import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { expenseHelpers } from '../../utils/expenseHelpers';

interface TransactionCardProps {
  transaction: Expense;
  onPress: () => void;
  currencySymbol: string;
}

const formatToAmPm = (timeStr: string) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMinute = String(m).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${ampm}`;
};

const formatToMonthDay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const dateObj = new Date(year, month, day);
  if (isNaN(dateObj.getTime())) return dateStr;
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
  return `${monthName} ${day}`;
};

export const TransactionCard: React.FC<TransactionCardProps> = React.memo(({
  transaction,
  onPress,
  currencySymbol,
}) => {
  const { colors, isDark } = useTheme();
  const catMeta = expenseHelpers.getCategoryMeta(transaction.category);
  const isIncome = (transaction.category || '').toLowerCase().includes('salary') || 
                   (transaction.category || '').toLowerCase().includes('income');

  // Dynamic icon colors matching Category Distribution
  const dynamicIconBg = isDark ? 'rgba(255,255,255,0.06)' : catMeta.color + '18';
  const dynamicIconColor = catMeta.color;
  const displaySymbol = expenseHelpers.getCurrencySymbol(transaction.currency || currencySymbol);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card },
        pressed && [styles.cardPressed, { backgroundColor: isDark ? '#1E293B' : '#FAFAFA' }],
      ]}
      accessibilityLabel={`Transaction card for ${transaction.merchant}`}
    >
      <View style={styles.leftSection}>
        <View style={[styles.iconContainer, { backgroundColor: dynamicIconBg }]}>
          <MaterialCommunityIcons name={(catMeta.icon || 'dots-horizontal') as any} size={20} color={dynamicIconColor} />
        </View>
        <View style={styles.centerSection}>
          <Text style={[styles.merchantText, { color: colors.text }]} numberOfLines={1}>
            {transaction.merchant}
          </Text>
          <Text style={styles.subText} numberOfLines={1}>
            <Text style={{ color: dynamicIconColor, fontWeight: '700' }}>{transaction.category}</Text>
            <Text style={{ color: colors.textSecondary }}> • {formatToAmPm(transaction.time)}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {formatToMonthDay(transaction.date)}
        </Text>
        <Text 
          style={[
            styles.amountText,
            { color: isIncome ? '#34C759' : colors.text }
          ]}
          numberOfLines={1}
        >
          {isIncome ? '+' : '-'}{displaySymbol}{transaction.amount.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
});

TransactionCard.displayName = 'TransactionCard';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  cardPressed: {
    opacity: 0.85,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
  },
  merchantText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 12,
    marginBottom: 2,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
  },
});
