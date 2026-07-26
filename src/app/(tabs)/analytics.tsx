import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Header } from '../../components/Header';
import { useExpenseStore } from '../../store/expenseStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import { useCurrencyStore } from '../../store/currencyStore';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import {
  TrendingUp,
  Percent,
  Calendar,
  Sparkles,
  Award,
  Wallet,
} from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const { expenses, categories, fetchExpenses } = useExpenseStore();
  const { settings } = useSettingsStore();

  const [timePeriod, setTimePeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Calculate stats
  const convert = useCurrencyStore.getState().convert;
  const totalSpend = expenses.reduce((sum, e) => {
    const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
    return sum + amt;
  }, 0);
  const averageSpend = expenses.length > 0 ? totalSpend / expenses.length : 0;

  // Largest Expense
  const largestExpense = [...expenses].sort((a, b) => {
    const amtA = convert(Number(a.amount), a.currency || 'INR', 'INR');
    const amtB = convert(Number(b.amount), b.currency || 'INR', 'INR');
    return amtB - amtA;
  })[0] || null;

  // Top Merchants
  const getTopMerchants = (): { merchant: string; count: number; total: number }[] => {
    const map: Record<string, { count: number; total: number }> = {};
    expenses.forEach((e) => {
      if (!map[e.merchant]) {
        map[e.merchant] = { count: 0, total: 0 };
      }
      map[e.merchant].count += 1;
      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      map[e.merchant].total += amt;
    });

    return Object.keys(map)
      .map((merchant) => ({
        merchant,
        count: map[merchant].count,
        total: map[merchant].total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  };

  const topMerchants = getTopMerchants();

  // Highest Spending Day
  const getHighestSpendingDay = (): { date: string; amount: number } | null => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      map[e.date] = (map[e.date] || 0) + amt;
    });

    const sorted = Object.keys(map)
      .map((date) => ({ date, amount: map[date] }))
      .sort((a, b) => b.amount - a.amount);

    return sorted[0] || null;
  };

  const highestSpendingDay = getHighestSpendingDay();

  // Chart data
  const chartData =
    timePeriod === 'week'
      ? expenseHelpers.getWeeklySpendingData(expenses)
      : expenseHelpers.getMonthlyTrendData(expenses);

  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Reset/default selected index when timePeriod or expenses change
  useEffect(() => {
    if (chartData.length > 0) {
      const lastValIdx = [...chartData].reverse().findIndex((d) => d.amount > 0);
      if (lastValIdx !== -1) {
        setSelectedBarIndex(chartData.length - 1 - lastValIdx);
      } else {
        setSelectedBarIndex(chartData.length - 1);
      }
    } else {
      setSelectedBarIndex(null);
    }
  }, [timePeriod, expenses]);

  const renderTrendChart = () => {
    const dataValues = chartData.map((d) => d.amount);
    const maxVal = Math.max(...dataValues, 100); // minimum scale of 100
    
    const chartHeight = 180;
    const chartWidth = SCREEN_WIDTH - 64; // considering margins
    const paddingBottom = 25;
    const paddingTop = 20;
    const barWidth = timePeriod === 'week' ? 24 : 32;
    const availableHeight = chartHeight - paddingTop - paddingBottom;
    const barGap = (chartWidth - barWidth * chartData.length) / (chartData.length + 1);

    return (
      <View style={styles.chartWrapper}>
        <Svg height={chartHeight} width={chartWidth}>
          <G>
            {chartData.map((d, i) => {
              const x = barGap + i * (barWidth + barGap);
              const height = (d.amount / maxVal) * availableHeight;
              const y = chartHeight - paddingBottom - height;
              const isSelected = i === selectedBarIndex;

              return (
                <G key={i}>
                  {/* Invisible background hit-box for easier tapping */}
                  <Rect
                    x={x - barGap / 2}
                    y={0}
                    width={barWidth + barGap}
                    height={chartHeight - paddingBottom}
                    fill="transparent"
                    onPress={() => setSelectedBarIndex(i)}
                  />
                  {/* Bar */}
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={6}
                    fill={colors.primary}
                    opacity={d.amount > 0 ? (isSelected ? 1 : 0.45) : 0.12}
                    onPress={() => setSelectedBarIndex(i)}
                  />
                  {/* Amount label on top of selected bar */}
                  {isSelected && d.amount > 0 && (
                    <SvgText
                      x={x + barWidth / 2}
                      y={y - 6}
                      fontSize="10"
                      fontWeight="800"
                      fill={colors.primary}
                      textAnchor="middle"
                    >
                      {/* {expenseHelpers.getCurrencySymbol(settings.currency)} */}
                      {d.amount.toFixed(0)}
                    </SvgText>
                  )}
                  {/* X Axis Label */}
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartHeight - 8}
                    fontSize="10"
                    fontWeight="600"
                    fill={colors.textSecondary}
                    textAnchor="middle"
                  >
                    {(timePeriod === 'week' ? (d as any).day : (d as any).month)}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      </View>
    );
  };

  let categorySpending = expenseHelpers.getCategorySpending(expenses, categories);
  if (categorySpending.length === 0) {
    categorySpending = categories.map((cat) => ({
      name: cat.name,
      amount: 0,
      percentage: 0,
      color: cat.color || '#C7C7CC',
      icon: cat.icon || 'dots-horizontal',
    }));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="ANALYTICS"
        showBackButton={true}
        onBackPress={() => router.back()}
        rightIcon="download"
        onRightPress={() => {
          Alert.alert('Export Report', 'Your PDF & CSV reports are being prepared for download.');
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          {/* Chart Period Selector */}
          <View style={styles.headerRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Trend</Text>
            <View style={styles.periodSelector}>
              <TouchableOpacity
                style={[
                  styles.periodBtn,
                  timePeriod === 'week' && { backgroundColor: colors.primary },
                ]}
                onPress={() => setTimePeriod('week')}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: timePeriod === 'week' ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  Weekly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodBtn,
                  timePeriod === 'month' && { backgroundColor: colors.primary },
                ]}
                onPress={() => setTimePeriod('month')}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: timePeriod === 'month' ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Trend Chart Card */}
          <Card style={styles.chartCard} glassmorphism>
            {selectedBarIndex !== null && chartData[selectedBarIndex] && (
              <View style={styles.selectedDetailsContainer}>
                <Text style={[styles.selectedDetailsPeriod, { color: colors.textSecondary }]}>
                  {timePeriod === 'week'
                    ? `Spend on ${(chartData[selectedBarIndex] as any).day}`
                    : `Spend in ${(chartData[selectedBarIndex] as any).month}`}
                </Text>
                <Text style={[styles.selectedDetailsAmount, { color: colors.text }]}>
                  {expenseHelpers.getCurrencySymbol(settings.currency)}
                  {chartData[selectedBarIndex].amount.toFixed(2)}
                </Text>
              </View>
            )}
            {renderTrendChart()}
          </Card>

          {/* Core Statistics */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>Key Statistics</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.gridCard}>
              <Wallet size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Average Spend</Text>
              <Text style={[styles.cardVal, { color: colors.text }]}>
                {expenseHelpers.getCurrencySymbol(settings.currency)}
                {averageSpend.toFixed(2)}
              </Text>
            </Card>

            <Card style={styles.gridCard}>
              <Award size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Largest Expense</Text>
              <Text style={[styles.cardVal, { color: colors.text }]} numberOfLines={1}>
                {expenseHelpers.getCurrencySymbol(settings.currency)}
                {largestExpense ? convert(Number(largestExpense.amount), largestExpense.currency || 'INR', 'INR').toFixed(0) : '0'}
              </Text>
              {largestExpense && (
                <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {largestExpense.merchant}
                </Text>
              )}
            </Card>
          </View>

          <View style={styles.statsGrid}>
            <Card style={styles.gridCard}>
              <Calendar size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Peak Day</Text>
              <Text style={[styles.cardVal, { color: colors.text }]} numberOfLines={1}>
                {highestSpendingDay
                  ? `${expenseHelpers.getCurrencySymbol(settings.currency)}${highestSpendingDay.amount.toFixed(0)}`
                  : `${expenseHelpers.getCurrencySymbol(settings.currency)}0`}
              </Text>
              <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {highestSpendingDay ? highestSpendingDay.date : 'No spend days'}
              </Text>
            </Card>

            <Card style={styles.gridCard}>
              <Sparkles size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Top Merchant</Text>
              <Text style={[styles.cardVal, { color: colors.text }]} numberOfLines={1}>
                {topMerchants.length > 0 ? topMerchants[0].merchant : 'None'}
              </Text>
              <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                Spent {expenseHelpers.getCurrencySymbol(settings.currency)}
                {topMerchants.length > 0 ? topMerchants[0].total.toFixed(0) : '0'}
              </Text>
            </Card>
          </View>

          {/* Category Spending List */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>Category Distribution</Text>
          <Card style={styles.categoryDistCard}>
            {categorySpending.map((cat, idx) => (
              <View key={idx} style={styles.catDistItem}>
                <View style={styles.catHeader}>
                  <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                  <Text style={[styles.catAmount, { color: colors.text }]}>
                    {expenseHelpers.getCurrencySymbol(settings.currency)}
                    {cat.amount.toFixed(2)} ({cat.percentage}%)
                  </Text>
                </View>
                {/* Horizontal Progress Bar */}
                <View style={[styles.progBg, { backgroundColor: isDark ? '#1f293d' : '#e5e7eb' }]}>
                  <View
                    style={[
                      styles.progFill,
                      {
                        backgroundColor: cat.color,
                        width: `${cat.percentage}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </Card>
          <View style={{ height: 40 }} />
        </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    padding: 2,
  },
  periodBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    padding: 14,
    marginVertical: 0,
    borderRadius: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  cardVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  gridCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  categoryDistCard: {
    padding: 16,
    marginTop: 8,
  },
  catDistItem: {
    marginVertical: 8,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  progBg: {
    height: 8,
    borderRadius: 4,
  },
  progFill: {
    height: '100%',
    borderRadius: 4,
  },
  selectedDetailsContainer: {
    alignItems: 'center',
    marginBottom: 16,
    height: 48,
    justifyContent: 'center',
  },
  selectedDetailsPeriod: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedDetailsAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
});
