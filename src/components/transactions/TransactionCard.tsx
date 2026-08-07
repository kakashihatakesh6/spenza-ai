import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Expense } from '../../types';
import { useTheme } from '../../hooks/useTheme';

interface TransactionCardProps {
  transaction: Expense;
  onPress: () => void;
  currencySymbol: string;
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  shopping: { bg: '#FFE5EC', color: '#FF6B81', icon: 'shopping-bag' },
  travel: { bg: '#E8F1F5', color: '#35B6D5', icon: 'compass' },
  bills: { bg: '#F0E6FF', color: '#8E7CF3', icon: 'file-text' },
  food: { bg: '#FFF3CD', color: '#FFB648', icon: 'coffee' },
  salary: { bg: '#E8F5E9', color: '#34C759', icon: 'dollar-sign' },
  transport: { bg: '#E0F7FA', color: '#35B6D5', icon: 'truck' },
  entertainment: { bg: '#FFFDE7', color: '#FFB648', icon: 'film' },
  default: { bg: '#F5F5F5', color: '#666666', icon: 'tag' },
};

const getCategoryStyle = (category: string) => {
  const norm = (category || '').toLowerCase();
  if (norm.includes('shop') || norm.includes('cloth')) return CATEGORY_STYLES.shopping;
  if (norm.includes('travel') || norm.includes('flight') || norm.includes('trip') || norm.includes('cab') || norm.includes('taxi')) return CATEGORY_STYLES.travel;
  if (norm.includes('bill') || norm.includes('utility') || norm.includes('rent') || norm.includes('insurance')) return CATEGORY_STYLES.bills;
  if (norm.includes('food') || norm.includes('dine') || norm.includes('cafe') || norm.includes('eat') || norm.includes('grocer')) return CATEGORY_STYLES.food;
  if (norm.includes('salary') || norm.includes('income') || norm.includes('earn')) return CATEGORY_STYLES.salary;
  if (norm.includes('transport') || norm.includes('car') || norm.includes('fuel')) return CATEGORY_STYLES.transport;
  if (norm.includes('entertain') || norm.includes('movie') || norm.includes('show') || norm.includes('game') || norm.includes('music')) return CATEGORY_STYLES.entertainment;
  return CATEGORY_STYLES.default;
};

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
  const catStyle = getCategoryStyle(transaction.category);
  const isIncome = (transaction.category || '').toLowerCase().includes('salary') || 
                   (transaction.category || '').toLowerCase().includes('income');

  // Dynamic icon colors inside circles for high visibility
  const dynamicIconBg = isDark ? '#1E293B' : catStyle.bg;
  const dynamicIconColor = isDark ? '#818CF8' : catStyle.color;

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
          <Feather name={catStyle.icon} size={18} color={dynamicIconColor} />
        </View>
        <View style={styles.centerSection}>
          <Text style={[styles.merchantText, { color: colors.text }]} numberOfLines={1}>
            {transaction.merchant}
          </Text>
          <Text style={styles.subText} numberOfLines={1}>
            <Text style={{ color: dynamicIconColor, fontWeight: '600' }}>{transaction.category}</Text>
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
          {isIncome ? '+' : '-'}{currencySymbol}{transaction.amount.toFixed(2)}
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
