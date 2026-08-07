import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from 'react-native';

import { useRouter, useNavigation } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useExpenseStore } from '../store/expenseStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../hooks/useTheme';
import { useAlertStore } from '../store/alertStore';
import { useCurrencyStore } from '../store/currencyStore';
import { expenseHelpers } from '../utils/expenseHelpers';
import { Header } from '../components/Header';
import { MonthlySummaryCard } from '../components/transactions/MonthlySummaryCard';
import { TransactionCard } from '../components/transactions/TransactionCard';
import { Skeleton } from '../components/Skeleton';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Edit2, Trash2, Plus } from 'lucide-react-native';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import Animated, { FadeIn, FadeInDown, SlideInUp, FadeOut } from 'react-native-reanimated';
import { Expense } from '../types';

const CATEGORY_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  shopping: { bg: '#FFE5EC', color: '#FF6B81', icon: 'shopping-bag' },
  travel: { bg: '#E8F1F5', color: '#35B6D5', icon: 'compass' },
  bills: { bg: '#F0E6FF', color: '#8E7CF3', icon: 'file-text' },
  food: { bg: '#FFF3CD', color: '#FFB648', icon: 'coffee' },
  salary: { bg: '#E8F5E9', color: '#34C759', icon: 'dollar-sign' },
  transport: { bg: '#E0F7FA', color: '#35B6D5', icon: 'truck' },
  entertainment: { bg: '#FFFDE7', color: '#FFB648', icon: 'film' },
  all: { bg: '#EEF2FF', color: '#6366F1', icon: 'grid' },
  default: { bg: '#F3F4F6', color: '#6B7280', icon: 'tag' },
};

const getCategoryStyle = (category: string) => {
  const norm = (category || '').toLowerCase();
  if (norm === 'all') return CATEGORY_STYLES.all;
  if (norm.includes('shop') || norm.includes('cloth')) return CATEGORY_STYLES.shopping;
  if (norm.includes('travel') || norm.includes('flight') || norm.includes('trip') || norm.includes('cab') || norm.includes('taxi')) return CATEGORY_STYLES.travel;
  if (norm.includes('bill') || norm.includes('utility') || norm.includes('rent') || norm.includes('insurance')) return CATEGORY_STYLES.bills;
  if (norm.includes('food') || norm.includes('dine') || norm.includes('cafe') || norm.includes('eat') || norm.includes('grocer')) return CATEGORY_STYLES.food;
  if (norm.includes('salary') || norm.includes('income') || norm.includes('earn')) return CATEGORY_STYLES.salary;
  if (norm.includes('transport') || norm.includes('car') || norm.includes('fuel')) return CATEGORY_STYLES.transport;
  if (norm.includes('entertain') || norm.includes('movie') || norm.includes('show') || norm.includes('game') || norm.includes('music')) return CATEGORY_STYLES.entertainment;
  return CATEGORY_STYLES.default;
};

const getCategoryIcon = (category: string): string => {
  return getCategoryStyle(category).icon;
};

export const TransactionsScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();


  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  
  const { expenses, categories, fetchExpenses, deleteExpense, isLoading } = useExpenseStore();
  const { settings } = useSettingsStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [dateRange, setDateRange] = useState<'all' | 'july_12_18' | 'this_month' | 'last_30'>('all');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showCategoryPills, setShowCategoryPills] = useState(true);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Expense | null>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const convert = useCurrencyStore.getState().convert;
  
  // Calculate total monthly spending and compare to previous month
  const monthlyData = useMemo(() => {
    const currentMonthStr = expenseHelpers.getLocalDateString().slice(0, 7); // YYYY-MM
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthStr = expenseHelpers.getLocalDateString(lastMonthDate).slice(0, 7);

    const currentMonthSpend = expenses
      .filter((e) => e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => {
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        return sum + amt;
      }, 0);

    const lastMonthSpend = expenses
      .filter((e) => e.date.startsWith(lastMonthStr))
      .reduce((sum, e) => {
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        return sum + amt;
      }, 0);

    let changePercentage = 0;
    if (lastMonthSpend > 0) {
      changePercentage = ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100;
    } else if (currentMonthSpend > 0) {
      changePercentage = 100;
    }

    return {
      currentMonthSpend,
      changePercentage,
    };
  }, [expenses, convert]);

  const currencySymbol = useMemo(() => {
    return expenseHelpers.getCurrencySymbol(settings.currency);
  }, [settings.currency]);

  const filteredAndSortedExpenses = useMemo(() => {
    return expenses
      .filter((item) => {
        const matchSearch =
          item.merchant.toLowerCase().includes(search.toLowerCase()) ||
          (item.notes && item.notes.toLowerCase().includes(search.toLowerCase())) ||
          item.amount.toString().includes(search);
        
        const matchCategory = selectedCategory ? item.category === selectedCategory : true;
        
        const matchDateRange = (() => {
          if (dateRange === 'july_12_18') {
            return item.date >= '2026-07-12' && item.date <= '2026-07-18';
          }
          if (dateRange === 'this_month') {
            const monthPrefix = new Date().toISOString().slice(0, 7);
            return item.date.startsWith(monthPrefix);
          }
          if (dateRange === 'last_30') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            return item.date >= thirtyDaysAgo;
          }
          return true;
        })();

        return matchSearch && matchCategory && matchDateRange;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
        }
        if (sortBy === 'amount-desc') {
          return b.amount - a.amount;
        }
        if (sortBy === 'amount-asc') {
          return a.amount - b.amount;
        }
        return 0;
      });
  }, [expenses, search, selectedCategory, sortBy, dateRange]);

  const handleDelete = useCallback((id: string, merchant: string) => {
    const targetExpense = expenses.find(e => e.id === id);
    const symbol = expenseHelpers.getCurrencySymbol(targetExpense?.currency || settings.currency);
    useAlertStore.getState().showAlert(
      'Delete Transaction',
      `Are you sure you want to delete the expense of ${symbol}${targetExpense?.amount.toFixed(2)} at ${merchant}?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteExpense(id),
        },
      ]
    );
  }, [expenses, settings.currency, deleteExpense]);

  const handleEdit = useCallback((id: string) => {
    router.push({
      pathname: '/modal/add-expense',
      params: { id },
    });
  }, [router]);

  const renderRightSwipeActions = useCallback((id: string, merchant: string) => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: colors.primary }]}
        onPress={() => handleEdit(id)}
        activeOpacity={0.7}
      >
        <Edit2 size={20} color="#FFF" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: colors.danger }]}
        onPress={() => handleDelete(id, merchant)}
        activeOpacity={0.7}
      >
        <Trash2 size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  ), [colors, handleEdit, handleDelete]);

  const handleSelectCategory = useCallback((catName: string | null) => {
    setSelectedCategory(catName);
  }, []);

  const toggleSortOptions = useCallback(() => {
    setShowSortOptions(prev => !prev);
    setShowCategoryPills(false);
    setShowDateRangePicker(false);
  }, []);

  const toggleCategoryPills = useCallback(() => {
    setShowCategoryPills(prev => !prev);
    setShowSortOptions(false);
    setShowDateRangePicker(false);
  }, []);

  const toggleDateRangePicker = useCallback(() => {
    setShowDateRangePicker(prev => !prev);
    setShowCategoryPills(false);
    setShowSortOptions(false);
  }, []);

  const renderCategoryDropdown = () => {
    if (!showCategoryPills) return null;
    return (
      <Animated.View 
        entering={FadeInDown.duration(220)}
        exiting={FadeOut.duration(180)}
        style={[
          styles.dropdownContainer, 
          { 
            backgroundColor: isDark ? 'rgba(21, 29, 48, 0.65)' : 'rgba(255, 255, 255, 0.75)', 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' 
          }
        ]}
      >
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'All' }, ...categories]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoryScroll}
          renderItem={({ item, index }) => {
            const isSelected = item.name === 'All' ? selectedCategory === null : selectedCategory === item.name;
            const styleInfo = getCategoryStyle(item.name);
            const displayColor = isDark ? '#818CF8' : styleInfo.color;
            const displayBg = isDark ? 'rgba(30, 41, 59, 0.6)' : styleInfo.bg;

            return (
              <Animated.View entering={FadeIn.duration(200).delay(index * 25)}>
                <TouchableOpacity
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isSelected ? colors.primary : (isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)'),
                      borderColor: isSelected ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
                      shadowColor: isSelected ? colors.primary : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected ? 0.2 : 0,
                      shadowRadius: 4,
                      elevation: isSelected ? 3 : 0,
                    },
                  ]}
                  onPress={() => handleSelectCategory(item.name === 'All' ? null : item.name)}
                  activeOpacity={0.8}
                >
                  <View 
                    style={[
                      styles.categoryIconBadge, 
                      { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : displayBg }
                    ]}
                  >
                    <Feather 
                      name={styleInfo.icon as any} 
                      size={13} 
                      color={isSelected ? '#FFFFFF' : displayColor} 
                    />
                  </View>
                  <Text
                    style={[
                      styles.categoryCardText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      </Animated.View>
    );
  };

  const renderDateRangeDropdown = () => {
    if (!showDateRangePicker) return null;
    const ranges: { label: string; value: 'all' | 'july_12_18' | 'this_month' | 'last_30'; badge?: string }[] = [
      { label: 'All Dates', value: 'all' },
      { label: '12 July - 18 July', value: 'july_12_18', badge: 'PRESET' },
      { label: 'This Month', value: 'this_month' },
      { label: 'Last 30 Days', value: 'last_30' },
    ];

    return (
      <Animated.View 
        entering={FadeInDown.duration(220)}
        exiting={FadeOut.duration(180)}
        style={[
          styles.dropdownContainer, 
          { 
            backgroundColor: isDark ? 'rgba(21, 29, 48, 0.65)' : 'rgba(255, 255, 255, 0.75)', 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' 
          }
        ]}
      >
        <View style={styles.sortOptionsGrid}>
          {ranges.map((opt, index) => {
            const isSelected = dateRange === opt.value;
            return (
              <Animated.View key={opt.value} entering={FadeIn.duration(200).delay(index * 25)}>
                <TouchableOpacity
                  style={[
                    styles.sortOptItem,
                    { 
                      backgroundColor: isSelected ? colors.primary : (isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)'),
                      borderColor: isSelected ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
                      borderWidth: 1,
                      shadowColor: isSelected ? colors.primary : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected ? 0.15 : 0,
                      shadowRadius: 3,
                      elevation: isSelected ? 2 : 0,
                    }
                  ]}
                  onPress={() => {
                    setDateRange(opt.value);
                    setShowDateRangePicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="calendar-outline" 
                    size={14} 
                    color={isSelected ? '#FFFFFF' : colors.textSecondary} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text
                    style={[
                      styles.sortOptText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.badge && (
                    <View style={[styles.presetTag, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.primaryLight }]}>
                      <Text style={[styles.presetTagText, { color: isSelected ? '#FFFFFF' : colors.primary }]}>{opt.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderSortDropdown = () => {
    if (!showSortOptions) return null;
    return (
      <Animated.View 
        entering={FadeInDown.duration(220)}
        exiting={FadeOut.duration(180)}
        style={[
          styles.dropdownContainer, 
          { 
            backgroundColor: isDark ? 'rgba(21, 29, 48, 0.65)' : 'rgba(255, 255, 255, 0.75)', 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' 
          }
        ]}
      >
        <View style={styles.sortOptionsGrid}>
          {[
            { label: 'Date: Newest', value: 'date-desc', icon: 'arrow-down' },
            { label: 'Date: Oldest', value: 'date-asc', icon: 'arrow-up' },
            { label: 'Amount: High to Low', value: 'amount-desc', icon: 'trending-down' },
            { label: 'Amount: Low to High', value: 'amount-asc', icon: 'trending-up' },
          ].map((opt, index) => {
            const isSelected = sortBy === opt.value;
            return (
              <Animated.View key={opt.value} entering={FadeIn.duration(200).delay(index * 25)}>
                <TouchableOpacity
                  style={[
                    styles.sortOptItem,
                    { 
                      backgroundColor: isSelected ? colors.primary : (isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)'),
                      borderColor: isSelected ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
                      borderWidth: 1,
                      shadowColor: isSelected ? colors.primary : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected ? 0.15 : 0,
                      shadowRadius: 3,
                      elevation: isSelected ? 2 : 0,
                    }
                  ]}
                  onPress={() => {
                    setSortBy(opt.value as any);
                    setShowSortOptions(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather 
                    name={opt.icon as any} 
                    size={14} 
                    color={isSelected ? '#FFFFFF' : colors.textSecondary} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text
                    style={[
                      styles.sortOptText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }: { item: Expense; index: number }) => (
    <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
      <Swipeable
        renderRightActions={() => renderRightSwipeActions(item.id, item.merchant)}
        friction={2}
      >
        <TransactionCard
          transaction={item}
          onPress={() => setSelectedTransaction(item)}
          currencySymbol={currencySymbol}
        />
      </Swipeable>
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Header
          title="TRANSACTIONS"
          showBackButton={true}
          onBackPress={() => router.back()}
        />

        <Animated.View entering={SlideInUp.duration(400)} style={styles.searchFilterRow}>
          {/* Unified search input in the row */}
          <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.7)', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)', borderWidth: 1 }]}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search transactions..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search transactions input"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Date Range Trigger Button */}
          <TouchableOpacity
            style={[
              styles.iconFilterBtn,
              { 
                backgroundColor: dateRange !== 'all' ? colors.primaryLight : (isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.7)'),
                borderColor: dateRange !== 'all' ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'),
                borderWidth: 1
              }
            ]}
            onPress={toggleDateRangePicker}
            activeOpacity={0.7}
            accessibilityLabel="Filter by date range trigger"
          >
            <Ionicons 
              name="calendar" 
              size={18} 
              color={dateRange !== 'all' ? colors.primary : colors.textSecondary} 
            />
            {dateRange !== 'all' && (
              <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>

          {/* Category Trigger Button */}
          <TouchableOpacity
            style={[
              styles.iconFilterBtn,
              { 
                backgroundColor: selectedCategory ? colors.primaryLight : (isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.7)'),
                borderColor: selectedCategory ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'),
                borderWidth: 1
              }
            ]}
            onPress={toggleCategoryPills}
            activeOpacity={0.7}
            accessibilityLabel="Filter by category trigger"
          >
            <Feather 
              name={selectedCategory ? (getCategoryIcon(selectedCategory) as any) : "tag"} 
              size={18} 
              color={selectedCategory ? colors.primary : colors.textSecondary} 
            />
            {selectedCategory && (
              <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>

          {/* Sort Option Trigger Button */}
          <TouchableOpacity
            style={[
              styles.iconFilterBtn,
              { 
                backgroundColor: sortBy !== 'date-desc' ? colors.primaryLight : (isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.7)'),
                borderColor: sortBy !== 'date-desc' ? colors.primary : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'),
                borderWidth: 1
              }
            ]}
            onPress={toggleSortOptions}
            activeOpacity={0.7}
            accessibilityLabel="Sort options trigger"
          >
            <Feather 
              name="sliders" 
              size={18} 
              color={sortBy !== 'date-desc' ? colors.primary : colors.textSecondary} 
            />
            {sortBy !== 'date-desc' && (
              <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {renderDateRangeDropdown()}
        {renderSortDropdown()}
        {renderCategoryDropdown()}

        {isLoading ? (
          <View style={styles.listContainer}>
            <View style={{ height: 20 }} />
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={idx} style={[styles.cardSkeleton, { backgroundColor: colors.card }]}>
                <Skeleton width={44} height={44} borderRadius={22} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="60%" height={16} borderRadius={4} style={{ marginBottom: 4 }} />
                  <Skeleton width="40%" height={12} borderRadius={4} />
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Skeleton width={50} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
                  <Skeleton width={70} height={16} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={filteredAndSortedExpenses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPadding}
            renderItem={renderItem}
            ListHeaderComponent={
              <MonthlySummaryCard
                amount={monthlyData.currentMonthSpend}
                changePercentage={monthlyData.changePercentage}
                currencySymbol={currencySymbol}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrapper}>
                <View style={[styles.emptyStateContainer, { backgroundColor: colors.card }]}>
                  <Ionicons name="receipt-outline" size={64} color="#C7C7CC" style={{ marginBottom: 16 }} />
                   <Text style={[styles.emptyTitle, { color: colors.text }]}>No Transactions Yet</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Your scanned receipts and manual expenses will appear here.
                  </Text>
                  <TouchableOpacity
                    style={[styles.addExpenseBtn, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/modal/add-expense')}
                    activeOpacity={0.8}
                  >
                    <Plus size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.addExpenseBtnText}>Add Expense</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
          />
        )}

        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          onPress={() => router.push('/modal/add-expense')}
          activeOpacity={0.85}
          accessibilityLabel="Add new transaction"
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  iconFilterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dropdownContainer: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    zIndex: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
    gap: 8,
  },
  categoryIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCardText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sortOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  sortOptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  sortOptText: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetTag: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  presetTagText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listPadding: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    width: 140,
    marginBottom: 12,
    marginRight: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  swipeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  emptyWrapper: {
    paddingHorizontal: 16,
    marginTop: 40,
  },
  emptyStateContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
