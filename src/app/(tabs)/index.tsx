import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useExpenseStore } from '../../store/expenseStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { useCurrencyStore } from '../../store/currencyStore';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import Svg, { Circle, Rect } from 'react-native-svg';
import {
  Plus,
  Scan,
  Image as ImageIcon,
  Compass,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Info,
  CheckCircle,
  AlertTriangle,
  User,
  LogOut,
  X,
  ChevronRight,
  Mail,
  Lightbulb,
  Calendar,
  Target,
  Trophy,
} from 'lucide-react-native';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { UserProfileModal } from '../../components/UserProfileModal';
import { Expense } from '../../types';

export default function Dashboard() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  
  const { expenses, budgets, categories, fetchExpenses, fetchCategories, fetchBudgets, addExpense, saveBudget } =
    useExpenseStore();
  const { settings } = useSettingsStore();

  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [selectedTransaction, setSelectedTransaction] = useState<Expense | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchBudgets();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const todaySpend = expenseHelpers.getTodaySpend(expenses);
  const weeklySpend = expenseHelpers.getWeeklySpend(expenses);
  const monthlySpend = expenseHelpers.getMonthlySpend(expenses);
  const yearlySpend = expenseHelpers.getYearlySpend(expenses);

  const activeSpend =
    activeTab === 'today'
      ? todaySpend
      : activeTab === 'week'
      ? weeklySpend
      : activeTab === 'month'
      ? monthlySpend
      : yearlySpend;

  const getFilteredExpensesForActiveTab = () => {
    const todayStr = expenseHelpers.getLocalDateString();
    if (activeTab === 'today') {
      return expenses.filter((e) => e.date === todayStr);
    }
    if (activeTab === 'week') {
      const today = new Date();
      const currentDay = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - currentDay);
      const startStr = expenseHelpers.getLocalDateString(sunday);
      return expenses.filter((e) => e.date >= startStr);
    }
    if (activeTab === 'month') {
      const currentMonth = todayStr.slice(0, 7); // YYYY-MM
      return expenses.filter((e) => e.date.startsWith(currentMonth));
    }
    // year
    const currentYear = todayStr.slice(0, 4); // YYYY
    return expenses.filter((e) => e.date.startsWith(currentYear));
  };



  const weeklyBudget = budgets.find((b) => b.category === 'All' && b.period === 'weekly');
  const monthlyBudget = budgets.find((b) => b.category === 'All' && b.period === 'monthly');
  const yearlyBudget = budgets.find((b) => b.category === 'All' && b.period === 'yearly');
  const hasAnyBudget = !!(weeklyBudget || monthlyBudget || yearlyBudget);

  const renderBudgetRing = (
    label: string,
    spend: number,
    limit: number,
    IconComponent: any,
    iconColor: string
  ) => {
    const ratio = limit > 0 ? spend / limit : 0;
    const percentage = Math.min(1, ratio);
    const radius = 28;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - percentage * circumference;
    const isExceeded = spend > limit;
    const progressColor = isExceeded ? colors.danger : colors.success;

    return (
      <View style={styles.ringColumn}>
        <View style={styles.ringWrapper}>
          <Svg width="74" height="74">
            {/* Background Circle */}
            <Circle
              cx="37"
              cy="37"
              r={radius}
              stroke={isDark ? '#1e293b' : '#F3F4F6'}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Circle */}
            <Circle
              cx="37"
              cy="37"
              r={radius}
              stroke={progressColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 37 37)"
            />
          </Svg>
          <View style={styles.ringIconCenter}>
            <IconComponent size={20} color={iconColor} />
          </View>
        </View>
        <Text style={[styles.ringLabel, { color: isDark ? '#F1F5F9' : '#220f2aff' }]} numberOfLines={1}>{label}</Text>
        <Text style={styles.ringValue} numberOfLines={1}>
          <Text style={{ color: isExceeded ? colors.danger : colors.text, fontWeight: '700' }}>
            {expenseHelpers.getCurrencySymbol(settings.currency)}{spend.toFixed(0)}
          </Text>
          <Text style={{ color: isDark ? '#64748B' : '#94A3B8', fontWeight: '500' }}>
            /{limit.toFixed(0)}
          </Text>
        </Text>
      </View>
    );
  };

  const recentExpenses = expenses.slice(0, 4);
  const insights = expenseHelpers.getSpendingInsights(expenses, budgets, settings.currency);


  const seedSampleData = () => {
    Alert.alert(
      'Seed Sample Data',
      'This will populate your database with 8 mock transactions and a monthly budget of ₹1200 so you can test all features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          onPress: async () => {
            const today = new Date().toISOString().split('T')[0];
            const getPastDate = (daysAgo: number) => {
              const d = new Date();
              d.setDate(d.getDate() - daysAgo);
              return d.toISOString().split('T')[0];
            };

             // Seed budget
            await saveBudget({
              id: 'all_monthly',
              category: 'All',
              amount: 1200,
              period: 'monthly',
            });
 
             // Seed category budgets
             await saveBudget({
              id: 'food_monthly',
              category: 'Food',
              amount: 300,
              period: 'monthly',
            });

            // Seed expenses
            const mockItems = [
              { id: 'm1', amount: 8.75, merchant: 'Starbucks Coffee', category: 'Food', date: today, time: '08:45', paymentMethod: 'Credit Card', currency: settings.currency, notes: 'Caffe Latte & Scone', receiptImage: 'mock_starbucks.jpg' },
              { id: 'm2', amount: 24.50, merchant: 'Uber Ride', category: 'Travel', date: getPastDate(1), time: '18:30', paymentMethod: 'Google Pay', currency: settings.currency, notes: 'Office to home', receiptImage: 'mock_gpay_upi_screenshot.png' },
              { id: 'm3', amount: 85.20, merchant: 'Walmart Grocery', category: 'Grocery', date: getPastDate(1), time: '11:15', paymentMethod: 'Debit Card', currency: settings.currency, notes: 'Weekly groceries', receiptImage: 'mock_walmart.jpg' },
              { id: 'm4', amount: 45.00, merchant: 'Shell Gas Station', category: 'Fuel', date: getPastDate(2), time: '07:30', paymentMethod: 'Cash', currency: settings.currency, notes: 'Fuel fillup', receiptImage: 'mock_shell.jpg' },
              { id: 'm5', amount: 15.49, merchant: 'Netflix Subscription', category: 'Entertainment', date: getPastDate(3), time: '00:00', paymentMethod: 'Credit Card', currency: settings.currency, notes: 'Monthly standard plan' },
              { id: 'm6', amount: 19.99, merchant: 'Amazon Charger', category: 'Shopping', date: getPastDate(4), time: '14:20', paymentMethod: 'Google Pay', currency: settings.currency, notes: 'Wireless charging pad', receiptImage: 'mock_amazon.jpg' },
              { id: 'm7', amount: 79.99, merchant: 'Comcast Broadband', category: 'Bills', date: getPastDate(5), time: '10:00', paymentMethod: 'UPI (GPay)', currency: settings.currency, notes: 'WiFi bill', receiptImage: 'mock_gpay_upi_screenshot.png' },
              { id: 'm8', amount: 125.00, merchant: 'CVS Pharmacy', category: 'Health', date: getPastDate(6), time: '16:45', paymentMethod: 'Credit Card', currency: settings.currency, notes: 'Vitamins & meds' },
            ];

            for (const item of mockItems) {
              addExpense(item);
            }

            Alert.alert('Success', 'Sample data successfully seeded! Restarting views.');
            fetchExpenses();
            fetchBudgets();
          },
        },
      ]
    );
  };

  // Render Category Pie Chart via custom SVG for robust, light styling
  const renderMiniCategoryChart = () => {
    const filteredExpenses = getFilteredExpensesForActiveTab();
    const data = expenseHelpers.getCategorySpending(filteredExpenses, categories);
    
    let chartData = data;
    let isZeroState = false;

    const convert = useCurrencyStore.getState().convert;
    const totalFilteredSpend = filteredExpenses.reduce((sum, e) => {
      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      return sum + amt;
    }, 0);

    if (totalFilteredSpend === 0) {
      isZeroState = true;
      const fallbackCats = categories.length >= 4 ? categories.slice(0, 4) : [
        { name: 'Food', color: '#FF6B81', icon: 'food' },
        { name: 'Travel', color: '#4EA8DE', icon: 'car' },
        { name: 'Shopping', color: '#FFB703', icon: 'cart' },
        { name: 'Bills', color: '#72EFDD', icon: 'bill' }
      ];
      chartData = fallbackCats.map((cat) => ({
        name: cat.name,
        amount: 1, // equal weight
        color: cat.color,
        percentage: 0, // display 0%
        icon: cat.icon || 'help'
      }));
    }

    let accumulatedAngle = 0;
    const radius = 40;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    const totalWeight = isZeroState ? 4 : totalFilteredSpend;

    return (
      <View style={styles.chartContainer}>
        <Svg height="110" width="110" viewBox="0 0 110 110">
          <Circle cx="55" cy="55" r={radius} stroke={isDark ? '#1e293b' : '#EAEAEA'} strokeWidth={strokeWidth} fill="transparent" />
          {chartData.map((cat, idx) => {
            const percentage = totalWeight > 0 ? (cat.amount / totalWeight) : 0;
            const strokeDashoffset = circumference - percentage * circumference;
            const rotation = (accumulatedAngle * 360) / circumference - 90;
            accumulatedAngle += percentage * circumference;

            return (
              <Circle
                key={idx}
                cx="55"
                cy="55"
                r={radius}
                stroke={isZeroState ? `${cat.color}66` : cat.color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(${rotation} 55 55)`}
              />
            );
          })}
        </Svg>
        <View style={styles.chartLegend}>
          {chartData.slice(0, 4).map((cat, idx) => (
            <View key={idx} style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: cat.color }]} />
              <Text style={[styles.legendText, { color: colors.text }]} numberOfLines={1}>
                {cat.name} ({cat.percentage}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const getInsightIcon = (type: string) => {
    if (type === 'warning') {
      return <Lightbulb size={20} color={isDark ? '#FCA5A5' : '#EF4444'} />;
    }
    if (type === 'success') {
      return <Lightbulb size={20} color={isDark ? '#34D399' : '#10B981'} />;
    }
    return <Lightbulb size={20} color={isDark ? '#93C5FD' : '#3B82F6'} />;
  };

  const getInsightBg = (type: string) => {
    if (type === 'warning') {
      return isDark ? '#2e1818' : '#FEF2F2'; // Soft red/orange
    }
    if (type === 'success') {
      return isDark ? '#142921' : '#ECFDF5'; // Soft green
    }
    return isDark ? '#172554' : '#EFF6FF'; // Soft blue
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="SPENDLY"
        onMenuPress={() => setProfileModalVisible(true)}
        onNotificationPress={() => {
          Alert.alert(
            'Notifications',
            'No new spending alerts. All budget parameters are running within optimal limits.'
          );
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Spending Summary Card */}
      <View style={styles.summaryHeader}>
        <View style={styles.tabContainer}>
          {(['today', 'week', 'month', 'year'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabItem,
                activeTab === tab && { backgroundColor: colors.primary },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? '#FFF' : colors.textSecondary },
                ]}
              >
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.spendCard} glassmorphism>
          <Text style={[styles.spendLabel, { color: colors.textSecondary }]}>
            TOTAL SPENDING ({activeTab.toUpperCase()})
          </Text>
          <Text style={[styles.spendAmount, { color: colors.text }]}>
            {expenseHelpers.getCurrencySymbol(settings.currency)}
            {activeSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {renderMiniCategoryChart()}
        </Card>
      </View>

      {/* 2. Quick Actions Deck */}
      <View style={styles.actionsDeck}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push('/modal/scan')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: colors.primaryLight }]}>
            <Scan size={20} color={colors.primary} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>Scan Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push('/modal/screenshot')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: colors.primaryLight }]}>
            <ImageIcon size={20} color={colors.primary} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>Import UPI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push('/modal/add-expense')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: colors.primaryLight }]}>
            <Plus size={20} color={colors.primary} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>Manual Add</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Budget Status Progress */}
      {hasAnyBudget ? (
        <Card style={[styles.budgetCard, { borderColor: colors.border }]}>
          <View style={styles.budgetHeader}>
            <Text style={[styles.budgetTitle, { color: colors.text }]}>Budget Goals</Text>
            <TouchableOpacity onPress={() => router.push('/modal/budget')}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Manage</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ringsRow}>
            {weeklyBudget && renderBudgetRing('Weekly', weeklySpend, weeklyBudget.amount, Calendar, '#3B82F6')}
            {monthlyBudget && renderBudgetRing('Monthly', monthlySpend, monthlyBudget.amount, Target, '#10B981')}
            {yearlyBudget && renderBudgetRing('Yearly', yearlySpend, yearlyBudget.amount, Trophy, '#F59E0B')}
          </View>
        </Card>
      ) : (
        <Card style={styles.budgetEmptyCard}>
          <Text style={[styles.budgetEmptyText, { color: colors.text }]}>No overall budgets configured</Text>
          <TouchableOpacity
            style={[styles.budgetSetupBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => router.push('/modal/budget')}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Set Budget Goal</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* 4. Spending Insights */}
      <View style={styles.sectionHeader}>
        <Sparkles size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Spending Insights</Text>
      </View>
      <View style={styles.insightsList}>
        {insights.map((insight) => (
          <View
            key={insight.id}
            style={[
              styles.insightItem,
              { backgroundColor: getInsightBg(insight.type) },
            ]}
          >
            <View style={styles.insightIconColumn}>{getInsightIcon(insight.type)}</View>
            <View style={styles.insightContent}>
              <Text style={[styles.insightDesc, { color: isDark ? '#F9FAFB' : '#1F2937' }]}>
                {insight.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 5. Recent Transactions */}
      <View style={styles.sectionHeader}>
        <TrendingUp size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
        
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => router.push('/(tabs)/expenses')}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>See All</Text>
          <ArrowRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {recentExpenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={Compass}
            title="No Transactions Logged"
            description="You have not added any transactions yet. Populate the app with sample data to preview the full layout."
            actionLabel="Seed Sample Data"
            onAction={seedSampleData}
          />
        </View>
      ) : (
        <View style={styles.recentList}>
          {recentExpenses.map((expense) => (
            <TransactionCard
              key={expense.id}
              transaction={expense}
              onPress={() => setSelectedTransaction(expense)}
              currencySymbol={expenseHelpers.getCurrencySymbol(expense.currency || settings.currency)}
            />
          ))}
        </View>
      )}
      <View style={{ height: 40 }} />
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  summaryHeader: {
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    padding: 2,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  spendCard: {
    padding: 20,
  },
  spendLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  spendAmount: {
    fontSize: 32,
    fontWeight: '800',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  chartLegend: {
    flex: 1,
    marginLeft: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsDeck: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  budgetCard: {
    padding: 16,
    marginBottom: 20,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  budgetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  budgetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetAlertTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  budgetAlertText: {
    fontSize: 12,
    fontWeight: '600',
  },
  budgetEmptyCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  budgetEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  budgetSetupBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  insightsList: {
    marginBottom: 20,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginVertical: 6,
  },
  insightIconColumn: {
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightDesc: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
  },
  recentList: {
    marginBottom: 20,
  },
  transactionItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txCategoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
    marginRight: 8,
  },
  txMerchant: {
    fontSize: 14,
    fontWeight: '700',
  },
  txSub: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  headerTitleContainer: {
    paddingLeft: 4,
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.75,
  },
  headerSubtitleText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  headerProfileBtn: {
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerProfilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  profileModalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    elevation: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileModalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: {
    alignItems: 'center',
    marginVertical: 10,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileStatsBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    marginVertical: 16,
  },
  profileStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  profileStatVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  profileStatDivider: {
    width: 1,
    height: '100%',
  },
  profileMenu: {
    marginBottom: 20,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileMenuItemInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  menuItemIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  menuItemVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  menuItemInteractiveText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  profileMenuDivider: {
    height: 1,
    width: '100%',
  },
  profileLogoutBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLogoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCommonAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
  },
  ringColumn: {
    alignItems: 'center',
    flex: 1,
  },
  ringWrapper: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ringIconCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ringValue: {
    fontSize: 11,
    fontWeight: '600',
  },
});
