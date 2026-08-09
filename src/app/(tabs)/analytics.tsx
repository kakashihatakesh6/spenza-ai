import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Header } from '../../components/Header';
import { useExpenseStore } from '../../store/expenseStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import { useCurrencyStore } from '../../store/currencyStore';
import { Skeleton } from '../../components/Skeleton';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Card } from '../../components/Card';
import Svg, { Rect, Text as SvgText, G, Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  TrendingUp,
  Calendar,
  Sparkles,
  Award,
  Wallet,
  CreditCard,
  QrCode,
  Activity,
  CheckCircle2,
  AlertTriangle,
  PieChart,
  BarChart2,
  ShoppingBag,
  Zap,
  Banknote,
  Globe,
  HelpCircle,
  Lightbulb,
} from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const { expenses, categories, budgets, fetchExpenses, fetchBudgets, isLoading } = useExpenseStore();
  const { settings } = useSettingsStore();

  const [timePeriod, setTimePeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchExpenses();
    fetchBudgets();
  }, []);

  const convert = useCurrencyStore.getState().convert;
  const currencySymbol = expenseHelpers.getCurrencySymbol(settings.currency);

  // 1. Overall Stats
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

  // Top Merchants
  const getTopMerchants = () => {
    const map: Record<string, { count: number; total: number; category: string }> = {};
    expenses.forEach((e) => {
      if (!map[e.merchant]) {
        map[e.merchant] = { count: 0, total: 0, category: e.category };
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
        category: map[merchant].category,
        percentage: totalSpend > 0 ? Math.round((map[merchant].total / totalSpend) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };
  const topMerchants = getTopMerchants();

  // Financial Health Score
  const healthData = expenseHelpers.getFinancialHealthScore(expenses, budgets);

  // Payment Methods Breakdown (6 options: UPI, Cash, Debit Card, Credit Card, Online (Netbanking), Other)
  const paymentBreakdown = expenseHelpers.getPaymentMethodBreakdown(expenses);

  // Day of Week Pattern
  const dayPatterns = expenseHelpers.getSpendingPatternByDay(expenses);
  const peakDayPattern = [...dayPatterns].sort((a, b) => b.amount - a.amount)[0];

  // 2. Chart Trend Data Selection (Weekly, Monthly, Yearly)
  const getChartData = () => {
    if (timePeriod === 'weekly') {
      return expenseHelpers.getWeeklySpendingData(expenses);
    }
    if (timePeriod === 'yearly') {
      return expenseHelpers.getYearlyTrendData(expenses);
    }
    return expenseHelpers.getMonthlyTrendData(expenses);
  };

  const chartData = getChartData();
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

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

  // Trend Chart Renderer with Native Touch Overlay for 100% Reliable Interactivity
  const renderTrendChart = () => {
    const dataValues = chartData.map((d) => d.amount);
    const maxVal = Math.max(...dataValues, 100);

    const chartHeight = 200;
    const chartWidth = SCREEN_WIDTH - 64;
    const paddingBottom = 28;
    const paddingTop = 36;
    const barWidth = timePeriod === 'weekly' ? 24 : timePeriod === 'yearly' ? 38 : 30;
    const availableHeight = chartHeight - paddingTop - paddingBottom;
    const barGap = (chartWidth - barWidth * chartData.length) / (chartData.length + 1);

    const formatBarAmount = (amt: number) => {
      if (amt >= 100000) return `${currencySymbol}${(amt / 1000).toFixed(0)}k`;
      if (amt >= 1000) return `${currencySymbol}${(amt / 1000).toFixed(1)}k`;
      return `${currencySymbol}${amt.toFixed(0)}`;
    };

    return (
      <View style={[styles.chartWrapper, { width: chartWidth, height: chartHeight }]}>
        <Svg height={chartHeight} width={chartWidth}>
          <G>
            {chartData.map((d, i) => {
              const x = barGap + i * (barWidth + barGap);
              const height = Math.max(6, (d.amount / maxVal) * availableHeight);
              const y = chartHeight - paddingBottom - height;
              const isSelected = i === selectedBarIndex;
              const label = (d as any).day || (d as any).month || (d as any).label || '';

              return (
                <G key={i}>
                  {/* Column Bar */}
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={6}
                    fill={isSelected ? colors.primary : isDark ? '#334155' : '#CBD5E1'}
                    opacity={d.amount > 0 ? (isSelected ? 1 : 0.65) : 0.25}
                  />
                  {/* Amount label directly above selected column */}
                  {isSelected && d.amount > 0 && (
                    <SvgText
                      x={x + barWidth / 2}
                      y={Math.max(14, y - 10)}
                      fontSize="11"
                      fontWeight="800"
                      fill={colors.primary}
                      textAnchor="middle"
                    >
                      {formatBarAmount(d.amount)}
                    </SvgText>
                  )}
                  {/* X Axis Label */}
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartHeight - 8}
                    fontSize="10"
                    fontWeight="700"
                    fill={isSelected ? colors.text : colors.textSecondary}
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>

        {/* 100% Reliable Native Touchable Overlay across all columns */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
            {chartData.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={{ flex: 1, height: '100%' }}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedBarIndex(i);
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }}
              />
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Category Spending List
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

  // AI Insights List
  const insightsList = expenseHelpers.getSpendingInsights(expenses, budgets, settings.currency);

  const renderPaymentIcon = (methodName: string) => {
    const lower = methodName.toLowerCase();
    if (lower.includes('upi')) return <QrCode size={16} color={colors.primary} />;
    if (lower.includes('cash')) return <Banknote size={16} color="#10B981" />;
    if (lower.includes('credit')) return <CreditCard size={16} color="#F59E0B" />;
    if (lower.includes('debit')) return <CreditCard size={16} color="#3B82F6" />;
    if (lower.includes('online')) return <Globe size={16} color="#8B5CF6" />;
    return <HelpCircle size={16} color={colors.textSecondary} />;
  };

  // 100% 1-to-1 Matching Skeleton Screen
  const renderAnalyticsSkeleton = () => {
    return (
      <View style={styles.content}>
        {/* Hero Card Skeleton */}
        <Card style={styles.heroCard}>
          <Skeleton width="40%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={32} borderRadius={6} style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width="28%" height={24} borderRadius={6} />
            <Skeleton width="28%" height={24} borderRadius={6} />
            <Skeleton width="28%" height={24} borderRadius={6} />
          </View>
        </Card>

        {/* Trend Chart Card Skeleton */}
        <View style={styles.sectionHeaderRow}>
          <Skeleton width="40%" height={16} borderRadius={4} />
          <Skeleton width="45%" height={28} borderRadius={14} />
        </View>
        <Card style={styles.chartCard}>
          <Skeleton width="50%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
          <Skeleton width="40%" height={26} borderRadius={6} style={{ marginBottom: 20 }} />
          <View style={{ height: 160, justifyContent: 'flex-end', flexDirection: 'row', gap: 16, alignItems: 'flex-end', paddingBottom: 10 }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} width={28} height={40 + Math.random() * 80} borderRadius={6} />
            ))}
          </View>
        </Card>

        {/* Financial Health Skeleton */}
        <Skeleton width="50%" height={16} borderRadius={4} style={{ marginVertical: 12 }} />
        <Card style={styles.healthCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Skeleton width={70} height={70} borderRadius={35} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={16} borderRadius={4} />
              <Skeleton width="90%" height={12} borderRadius={4} />
            </View>
          </View>
        </Card>

        {/* Key Statistics Grid Skeleton */}
        <Skeleton width="40%" height={16} borderRadius={4} style={{ marginVertical: 12 }} />
        <View style={styles.statsGrid}>
          <Card style={styles.gridCard}><Skeleton width="80%" height={40} borderRadius={6} /></Card>
          <Card style={styles.gridCard}><Skeleton width="80%" height={40} borderRadius={6} /></Card>
        </View>

        {/* Payment Methods Skeleton */}
        <Skeleton width="50%" height={16} borderRadius={4} style={{ marginVertical: 12 }} />
        <Card style={styles.paymentCard}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} width="100%" height={32} borderRadius={6} />
          ))}
        </Card>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="ANALYTICS"
        showBackButton={true}
        onBackPress={() => router.back()}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {isLoading ? (
          renderAnalyticsSkeleton()
        ) : (
          <View style={styles.content}>
            {/* Hero Financial Summary Banner */}
            <Card style={styles.heroCard} glassmorphism>
              <View style={styles.heroHeaderRow}>
                <View>
                  <Text style={[styles.heroSuperTitle, { color: colors.textSecondary }]}>TOTAL EXPENDITURE</Text>
                  <Text style={[styles.heroAmount, { color: colors.text }]}>
                    {currencySymbol}
                    {totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.heroBadge, { backgroundColor: colors.primaryLight }]}>
                  <TrendingUp size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.heroBadgeText, { color: colors.primary }]}>{expenses.length} Txns</Text>
                </View>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
              <View style={styles.heroSubRow}>
                <View>
                  <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]}>Avg / Txn</Text>
                  <Text style={[styles.heroSubValue, { color: colors.text }]}>
                    {currencySymbol}{averageSpend.toFixed(0)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]}>Peak Day</Text>
                  <Text style={[styles.heroSubValue, { color: colors.text }]}>
                    {highestSpendingDay ? highestSpendingDay.date : 'N/A'}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]}>Top Category</Text>
                  <Text style={[styles.heroSubValue, { color: colors.text }]} numberOfLines={1}>
                    {categorySpending.length > 0 ? categorySpending[0].name : 'None'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* 1. Spending Trend Section (Weekly, Monthly, Yearly) */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Trend</Text>
              </View>

              {/* Weekly / Monthly / Yearly Selector */}
              <View style={[styles.periodSelector, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                {(['weekly', 'monthly', 'yearly'] as const).map((period) => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.periodBtn,
                      timePeriod === period && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setTimePeriod(period)}
                  >
                    <Text
                      style={[
                        styles.periodText,
                        { color: timePeriod === period ? '#FFF' : colors.textSecondary },
                      ]}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Trend Chart Card with Expanded Details */}
            <Card style={styles.chartCard} glassmorphism>
              {selectedBarIndex !== null && chartData[selectedBarIndex] && (
                <View style={styles.selectedDetailsContainer}>
                  <Text style={[styles.selectedDetailsPeriod, { color: colors.textSecondary }]}>
                    {timePeriod === 'weekly'
                      ? `Day: ${(chartData[selectedBarIndex] as any).day}`
                      : timePeriod === 'yearly'
                      ? `Year: ${(chartData[selectedBarIndex] as any).month}`
                      : `Month: ${(chartData[selectedBarIndex] as any).month}`}
                  </Text>
                  <Text style={[styles.selectedDetailsAmount, { color: colors.text }]}>
                    {currencySymbol}
                    {chartData[selectedBarIndex].amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}
              {renderTrendChart()}
            </Card>

            {/* 2. Financial Health Score Card */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Activity size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Financial Health Score</Text>
              </View>
            </View>

            <Card style={styles.healthCard}>
              <View style={styles.healthRow}>
                <View style={styles.healthMeterWrapper}>
                  <Svg width="70" height="70">
                    <Circle
                      cx="35"
                      cy="35"
                      r="28"
                      stroke={isDark ? '#1E293B' : '#E2E8F0'}
                      strokeWidth="6"
                      fill="transparent"
                    />
                    <Circle
                      cx="35"
                      cy="35"
                      r="28"
                      stroke={healthData.statusColor}
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={(2 * Math.PI * 28) * (1 - healthData.score / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 35 35)"
                    />
                  </Svg>
                  <View style={styles.healthScoreCenter}>
                    <Text style={[styles.healthScoreValue, { color: colors.text }]}>{healthData.score}</Text>
                  </View>
                </View>

                <View style={styles.healthContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={[styles.healthTitleText, { color: colors.text }]}>Health Rating</Text>
                    <View style={[styles.healthStatusBadge, { backgroundColor: healthData.statusColor + '20' }]}>
                      <Text style={[styles.healthStatusText, { color: healthData.statusColor }]}>
                        {healthData.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.healthRecommendation, { color: colors.textSecondary }]}>
                    {healthData.recommendation}
                  </Text>
                </View>
              </View>
            </Card>

            {/* 3. Ultra Attractive Key Statistics Grid */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 10 }]}>Key Statistics</Text>
            <View style={styles.statsGrid}>
              <Card style={styles.gridCard}>
                <View style={[styles.statIconBg, { backgroundColor: colors.primaryLight }]}>
                  <Wallet size={18} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Average Transaction</Text>
                <Text style={[styles.cardVal, { color: colors.text }]}>
                  {currencySymbol}{averageSpend.toFixed(0)}
                </Text>
                <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>Per logged expense</Text>
              </Card>

              <Card style={styles.gridCard}>
                <View style={[styles.statIconBg, { backgroundColor: colors.primaryLight }]}>
                  <Award size={18} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Largest Expense</Text>
                <Text style={[styles.cardVal, { color: colors.text }]} numberOfLines={1}>
                  {currencySymbol}
                  {largestExpense ? convert(Number(largestExpense.amount), largestExpense.currency || 'INR', 'INR').toFixed(0) : '0'}
                </Text>
                {largestExpense && (
                  <Text style={[styles.gridCardSub, { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>
                    {largestExpense.merchant}
                  </Text>
                )}
              </Card>
            </View>

            <View style={styles.statsGrid}>
              <Card style={styles.gridCard}>
                <View style={[styles.statIconBg, { backgroundColor: colors.primaryLight }]}>
                  <Calendar size={18} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Highest Spend Day</Text>
                <Text style={[styles.cardVal, { color: colors.text }]} numberOfLines={1}>
                  {highestSpendingDay
                    ? `${currencySymbol}${highestSpendingDay.amount.toFixed(0)}`
                    : `${currencySymbol}0`}
                </Text>
                <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {highestSpendingDay ? highestSpendingDay.date : 'No spend recorded'}
                </Text>
              </Card>

              <Card style={styles.gridCard}>
                <View style={[styles.statIconBg, { backgroundColor: colors.primaryLight }]}>
                  <Sparkles size={18} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Top Merchant</Text>
                <Text style={[styles.cardVal, { color: colors.text }]} numberOfLines={1}>
                  {topMerchants.length > 0 ? topMerchants[0].merchant : 'None'}
                </Text>
                <Text style={[styles.gridCardSub, { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>
                  {topMerchants.length > 0 ? `${currencySymbol}${topMerchants[0].total.toFixed(0)} (${topMerchants[0].count} visits)` : '0'}
                </Text>
              </Card>
            </View>

            {/* 4. Weekly Spending Behavior Pattern */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Zap size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Spending Pattern</Text>
              </View>
            </View>

            <Card style={styles.patternCard}>
              <Text style={[styles.patternHeaderSub, { color: colors.textSecondary }]}>
                {peakDayPattern && peakDayPattern.amount > 0
                  ? `Peak volume occurs on ${peakDayPattern.dayName}s (${peakDayPattern.percentage}% of weekly transactions)`
                  : 'Spending distribution across days of the week'}
              </Text>
              <View style={styles.patternBarsRow}>
                {dayPatterns.map((dp, idx) => {
                  const maxDayAmt = Math.max(...dayPatterns.map((d) => d.amount), 1);
                  const barH = Math.max(8, (dp.amount / maxDayAmt) * 70);
                  const isPeak = dp.dayName === peakDayPattern?.dayName && dp.amount > 0;

                  return (
                    <View key={idx} style={styles.patternBarCol}>
                      <Text style={[styles.patternAmtText, { color: isPeak ? colors.primary : colors.textSecondary }]}>
                        {dp.amount > 0 ? `${dp.percentage}%` : ''}
                      </Text>
                      <View style={[styles.patternBarTrack, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                        <View
                          style={[
                            styles.patternBarFill,
                            {
                              height: barH,
                              backgroundColor: isPeak ? colors.primary : isDark ? '#475569' : '#94A3B8',
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.patternDayText,
                          { color: isPeak ? colors.primary : colors.textSecondary, fontWeight: isPeak ? '800' : '600' },
                        ]}
                      >
                        {dp.dayName}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* 5. Top Spending Places (No Overlap / No Text Overflow) */}
            {topMerchants.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={18} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Spending Places</Text>
                  </View>
                </View>

                <Card style={styles.merchantCard}>
                  {topMerchants.map((m, idx) => (
                    <View key={idx} style={styles.merchantRow}>
                      <View style={styles.merchantLeft}>
                        <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? '#FEF3C7' : idx === 1 ? '#E2E8F0' : '#FFEDD5' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: idx === 0 ? '#D97706' : idx === 1 ? '#475569' : '#C2410C' }}>
                            #{idx + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={[styles.merchantNameText, { color: colors.text }]}>
                            {m.merchant}
                          </Text>
                          <Text numberOfLines={1} style={[styles.merchantSubText, { color: colors.textSecondary }]}>
                            {m.count} {m.count === 1 ? 'visit' : 'visits'} • {m.category}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.merchantRight}>
                        <Text numberOfLines={1} style={[styles.merchantAmountText, { color: colors.text }]}>
                          {currencySymbol}{m.total.toFixed(0)}
                        </Text>
                        <Text numberOfLines={1} style={[styles.merchantPctText, { color: colors.textSecondary }]}>
                          {m.percentage}% of total
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* 6. Category Distribution List */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <PieChart size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Category Distribution</Text>
              </View>
            </View>

            <Card style={styles.categoryDistCard}>
              {categorySpending.map((cat, idx) => (
                <View key={idx} style={styles.catDistItem}>
                  <View style={styles.catHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={[styles.catColorCircle, { backgroundColor: cat.color }]}>
                        <MaterialCommunityIcons name={(cat.icon || 'dots-horizontal') as any} size={14} color="#FFF" />
                      </View>
                      <Text numberOfLines={1} style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                    </View>
                    <Text style={[styles.catAmount, { color: colors.text }]}>
                      {currencySymbol}
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

            {/* 7. Payment Method Share (6 Options: UPI, Cash, Debit Card, Credit Card, Online (Netbanking), Other) - Directly Above AI Insights */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CreditCard size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Method Share</Text>
              </View>
            </View>

            <Card style={styles.paymentCard}>
              {paymentBreakdown.map((item, idx) => (
                <View key={idx} style={styles.paymentRow}>
                  <View style={styles.paymentLeft}>
                    <View style={[styles.paymentIconCircle, { backgroundColor: colors.primaryLight }]}>
                      {renderPaymentIcon(item.method)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.paymentMethodTitle, { color: colors.text }]}>{item.method}</Text>
                      <Text style={[styles.paymentTxnSub, { color: colors.textSecondary }]}>
                        {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', minWidth: 100 }}>
                    <Text style={[styles.paymentAmount, { color: colors.text }]}>
                      {currencySymbol}{item.amount.toFixed(0)} ({item.percentage}%)
                    </Text>
                    <View style={[styles.paymentBarBg, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                      <View
                        style={[
                          styles.paymentBarFill,
                          { backgroundColor: colors.primary, width: `${item.percentage}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </Card>

            {/* 8. AI Smart Insights Deck (Ultra Attractive & Beautiful Design) */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Smart Insights</Text>
              </View>
            </View>

            <View style={{ gap: 12, marginBottom: 40 }}>
              {insightsList.map((item) => (
                <Card 
                  key={item.id} 
                  style={[
                    styles.aiInsightCard,
                    { 
                      borderColor: item.type === 'warning' ? colors.danger + '40' : colors.primary + '30',
                      backgroundColor: item.type === 'warning'
                        ? (isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2')
                        : (isDark ? 'rgba(99, 102, 241, 0.08)' : '#EEF2FF')
                    }
                  ]}
                >
                  <View style={styles.aiInsightHeaderRow}>
                    <View style={[styles.aiInsightIconPill, { backgroundColor: item.type === 'warning' ? colors.danger : colors.primary }]}>
                      {item.type === 'warning' ? (
                        <AlertTriangle size={14} color="#FFF" />
                      ) : (
                        <Lightbulb size={14} color="#FFF" />
                      )}
                    </View>
                    <Text style={[styles.aiInsightTitleText, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <View style={[styles.aiInsightTagPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#FFF' }]}>
                      <Sparkles size={10} color={colors.primary} style={{ marginRight: 3 }} />
                      <Text style={[styles.aiInsightTagText, { color: colors.primary }]}>
                        {item.type === 'warning' ? 'ALERT' : 'AI TIP'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.aiInsightDescText, { color: colors.textSecondary }]}>
                    {item.description}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        )}
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
  heroCard: {
    padding: 18,
    marginBottom: 16,
    borderRadius: 20,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSuperTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroDivider: {
    height: 1,
    marginVertical: 14,
    opacity: 0.6,
  },
  heroSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  heroSubValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  periodSelector: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
  },
  periodBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '800',
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
  selectedDetailsContainer: {
    alignItems: 'center',
    marginBottom: 12,
    height: 44,
    justifyContent: 'center',
  },
  selectedDetailsPeriod: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedDetailsAmount: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  healthCard: {
    padding: 16,
    marginBottom: 12,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthMeterWrapper: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  healthContent: {
    flex: 1,
  },
  healthTitleText: {
    fontSize: 14,
    fontWeight: '800',
  },
  healthStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  healthStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  healthRecommendation: {
    fontSize: 12,
    lineHeight: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    padding: 14,
    marginVertical: 0,
    borderRadius: 16,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  gridCardSub: {
    fontSize: 11,
    marginTop: 3,
  },
  paymentCard: {
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  paymentIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentTxnSub: {
    fontSize: 11,
  },
  paymentAmount: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  paymentBarBg: {
    width: 90,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  paymentBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  patternCard: {
    padding: 16,
    marginBottom: 12,
  },
  patternHeaderSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  patternBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 110,
  },
  patternBarCol: {
    alignItems: 'center',
    width: 32,
  },
  patternAmtText: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  patternBarTrack: {
    width: 14,
    height: 70,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  patternBarFill: {
    width: '100%',
    borderRadius: 7,
  },
  patternDayText: {
    fontSize: 11,
    marginTop: 6,
  },
  merchantCard: {
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  merchantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  merchantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  merchantSubText: {
    fontSize: 11,
  },
  merchantRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  merchantAmountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  merchantPctText: {
    fontSize: 10,
  },
  categoryDistCard: {
    padding: 16,
    marginBottom: 12,
  },
  catDistItem: {
    marginVertical: 8,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catColorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  aiInsightCard: {
    padding: 16,
    marginVertical: 0,
    borderRadius: 18,
    borderWidth: 1,
  },
  aiInsightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiInsightIconPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightTitleText: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  aiInsightTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiInsightTagText: {
    fontSize: 9,
    fontWeight: '900',
  },
  aiInsightDescText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
