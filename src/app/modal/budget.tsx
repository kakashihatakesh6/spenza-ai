import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated as RNAnimated,
  Easing,
  Dimensions,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Header } from '../../components/Header';
import { useExpenseStore } from '../../store/expenseStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAlertStore } from '../../store/alertStore';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../components/Card';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  Settings,
  Target,
  TrendingUp,
  Sparkles,
  X,
  Layers,
  AlertTriangle,
  Zap,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { expenseRepository } from '../../database/repositories/expenseRepository';
import { Budget } from '../../types';

const { width } = Dimensions.get('window');

// Skeleton Loader Component for ultra-fast perceived screen opening speed
const BudgetSkeleton = ({ colors, isDark }: { colors: any; isDark: boolean }) => {
  const opacityAnim = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 700,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  const skeletonBg = isDark ? '#1E293B' : '#E2E8F0';

  return (
    <View style={styles.skeletonContainer}>
      {/* Form Card Skeleton */}
      <View style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <RNAnimated.View style={[styles.skeletonTitle, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '45%' }]} />
        
        {/* Category Pills Skeleton */}
        <View style={styles.skeletonPillRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <RNAnimated.View
              key={i}
              style={[styles.skeletonPill, { backgroundColor: skeletonBg, opacity: opacityAnim }]}
            />
          ))}
        </View>

        <RNAnimated.View style={[styles.skeletonDivider, { backgroundColor: colors.border }]} />

        <RNAnimated.View style={[styles.skeletonTitle, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '40%' }]} />
        <RNAnimated.View style={[styles.skeletonInput, { backgroundColor: skeletonBg, opacity: opacityAnim }]} />

        <RNAnimated.View style={[styles.skeletonDivider, { backgroundColor: colors.border }]} />

        <RNAnimated.View style={[styles.skeletonTitle, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '30%' }]} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3].map((i) => (
            <RNAnimated.View
              key={i}
              style={[styles.skeletonPeriodBtn, { backgroundColor: skeletonBg, opacity: opacityAnim }]}
            />
          ))}
        </View>

        <RNAnimated.View style={[styles.skeletonButton, { backgroundColor: colors.primary, opacity: opacityAnim }]} />
      </View>

      {/* Active Goals Skeleton */}
      <RNAnimated.View style={[styles.skeletonTitle, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '50%', marginBottom: 12 }]} />
      {[1, 2].map((i) => (
        <View key={i} style={[styles.skeletonGoalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <RNAnimated.View style={[styles.skeletonIcon, { backgroundColor: skeletonBg, opacity: opacityAnim }]} />
            <View style={{ flex: 1 }}>
              <RNAnimated.View style={[styles.skeletonLine, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '60%' }]} />
              <RNAnimated.View style={[styles.skeletonLine, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '35%', marginTop: 6 }]} />
            </View>
          </View>
          <RNAnimated.View style={[styles.skeletonBar, { backgroundColor: skeletonBg, opacity: opacityAnim }]} />
        </View>
      ))}
    </View>
  );
};

// Goals Specific Skeleton Component
const GoalsSkeleton = ({ colors, isDark }: { colors: any; isDark: boolean }) => {
  const opacityAnim = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 700,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  const skeletonBg = isDark ? '#1E293B' : '#E2E8F0';

  return (
    <View style={{ gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeletonGoalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <RNAnimated.View style={[styles.skeletonIcon, { backgroundColor: skeletonBg, opacity: opacityAnim }]} />
              <View style={{ flex: 1 }}>
                <RNAnimated.View style={[styles.skeletonLine, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '55%' }]} />
                <RNAnimated.View style={[styles.skeletonLine, { backgroundColor: skeletonBg, opacity: opacityAnim, width: '35%', marginTop: 6 }]} />
              </View>
            </View>
            <RNAnimated.View style={{ width: 44, height: 22, borderRadius: 8, backgroundColor: skeletonBg, opacity: opacityAnim }} />
          </View>
          <RNAnimated.View style={[styles.skeletonBar, { backgroundColor: skeletonBg, opacity: opacityAnim }]} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <RNAnimated.View style={{ width: 80, height: 10, borderRadius: 5, backgroundColor: skeletonBg, opacity: opacityAnim }} />
            <RNAnimated.View style={{ width: 100, height: 10, borderRadius: 5, backgroundColor: skeletonBg, opacity: opacityAnim }} />
          </View>
        </View>
      ))}
    </View>
  );
};

export default function BudgetModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const { budgets, categories, expenses, saveBudget, deleteBudget, fetchBudgets, fetchExpenses } = useExpenseStore();
  const { settings } = useSettingsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isGoalsLoading, setIsGoalsLoading] = useState(true);

  // Form states
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });

    let isMounted = true;

    const loadBudgetScreenData = async () => {
      setIsLoading(true);
      setIsGoalsLoading(true);

      try {
        // 1. Read cached SQLite budgets & expenses immediately
        const localBudgets = expenseRepository.getAllBudgets();
        const localExpenses = expenseRepository.getAllExpenses();
        const localCategories = expenseRepository.getAllCategories();

        useExpenseStore.setState({
          budgets: localBudgets,
          expenses: localExpenses,
          categories: localCategories.length > 0 ? localCategories : useExpenseStore.getState().categories,
        });

        // 2. Smooth screen transition for form (~120ms)
        await new Promise((resolve) => setTimeout(resolve, 120));
      } catch (err) {
        console.error('Error loading local budget data:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }

      // 3. Await store/remote fetch for Active Budget Goals so skeleton loader remains active in goals section until data is fully loaded
      try {
        await Promise.all([
          fetchBudgets(),
          fetchExpenses(),
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
      } catch (err) {
        console.error('Error syncing remote budget data:', err);
      } finally {
        if (isMounted) {
          setIsGoalsLoading(false);
        }
      }
    };

    loadBudgetScreenData();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  // Helper to get category metadata
  const getCatMeta = (catName: string) => {
    if (catName === 'All') {
      return {
        name: 'All Categories',
        color: colors.primary,
        icon: 'layers-triple',
      };
    }
    return expenseHelpers.getCategoryMeta(catName, categories);
  };

  // Calculate current period spending for a category
  const calculateSpending = (catName: string, selectedPeriod: 'weekly' | 'monthly' | 'yearly') => {
    const now = new Date();
    return expenses.reduce((acc, curr) => {
      // Category match
      if (catName !== 'All' && curr.category.toLowerCase() !== catName.toLowerCase()) {
        return acc;
      }

      const expDate = new Date(curr.date);
      if (isNaN(expDate.getTime())) return acc;

      if (selectedPeriod === 'weekly') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        if (expDate >= oneWeekAgo && expDate <= now) {
          return acc + curr.amount;
        }
      } else if (selectedPeriod === 'monthly') {
        if (expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear()) {
          return acc + curr.amount;
        }
      } else if (selectedPeriod === 'yearly') {
        if (expDate.getFullYear() === now.getFullYear()) {
          return acc + curr.amount;
        }
      }
      return acc;
    }, 0);
  };

  const handleSaveBudget = async () => {
    const parsedAmount = parseFloat(limitAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      useAlertStore.getState().showAlert('Invalid Amount', 'Please set a valid positive budget limit.', 'warning');
      return;
    }

    const budgetId = editingBudgetId || `${selectedCategory.toLowerCase()}_${period}`;
    try {
      await saveBudget({
        id: budgetId,
        category: selectedCategory,
        amount: parsedAmount,
        period,
      });

      setLimitAmount('');
      setEditingBudgetId(null);
      useAlertStore.getState().showAlert(
        'Success',
        editingBudgetId
          ? `Budget updated for ${selectedCategory}!`
          : `Spending limit set for ${selectedCategory}!`,
        'success'
      );
    } catch (err) {
      useAlertStore.getState().showAlert('Error', 'Failed to save budget.', 'error');
    }
  };

  const handleEditBudget = (budget: Budget) => {
    setSelectedCategory(budget.category);
    setPeriod(budget.period);
    setLimitAmount(budget.amount.toString());
    setEditingBudgetId(budget.id);

    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleCancelEdit = () => {
    setEditingBudgetId(null);
    setLimitAmount('');
  };

  const handleDeleteBudget = (id: string, name: string) => {
    useAlertStore.getState().showAlert(
      'Delete Budget',
      `Are you sure you want to delete the spending limit for ${name}?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudget(id);
              if (editingBudgetId === id) {
                handleCancelEdit();
              }
            } catch (err) {
              useAlertStore.getState().showAlert('Error', 'Failed to delete budget.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleQuickAddAmount = (addValue: number) => {
    const current = parseFloat(limitAmount) || 0;
    setLimitAmount((current + addValue).toString());
  };

  // Render Right Actions when Swiping Left on a Budget Item Card
  const renderRightSwipeActions = (budget: Budget) => {
    return (
      <View style={styles.swipeActionContainer}>
        <TouchableOpacity
          style={[styles.swipeEditBtn, { backgroundColor: colors.primary }]}
          onPress={() => handleEditBudget(budget)}
          activeOpacity={0.8}
        >
          <Edit3 size={18} color="#FFFFFF" />
          <Text style={styles.swipeBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeDeleteBtn, { backgroundColor: '#EF4444' }]}
          onPress={() => handleDeleteBudget(budget.id, budget.category)}
          activeOpacity={0.8}
        >
          <Trash2 size={18} color="#FFFFFF" />
          <Text style={styles.swipeBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const selectedCatMeta = getCatMeta(selectedCategory);
  const currentCategorySpend = calculateSpending(selectedCategory, period);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          title="Manage Budget"
          showBackButton={true}
          onBackPress={() => router.back()}
          hideRightAction={true}
        />

        {isLoading ? (
          <BudgetSkeleton colors={colors} isDark={isDark} />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={[styles.container, { backgroundColor: colors.background }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>

              {/* Editing Banner Notification */}
              {editingBudgetId && (
                <Animated.View entering={FadeInDown.duration(300)}>
                  <View style={[styles.editingBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Edit3 size={16} color={colors.primary} />
                      <Text style={[styles.editingBannerText, { color: colors.primary }]}>
                        Editing <Text style={{ fontWeight: '800' }}>{selectedCategory}</Text> Budget
                      </Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelEditBtn}>
                      <X size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {/* Set budget limits form */}
              <Card style={[styles.formCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                
                {/* Category Selection Header */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>CHOOSE CATEGORY</Text>
                  {selectedCategory !== 'All' && (
                    <View style={[styles.selectedTagBadge, { backgroundColor: selectedCatMeta.color + '20' }]}>
                      <MaterialCommunityIcons name={selectedCatMeta.icon as any} size={12} color={selectedCatMeta.color} />
                      <Text style={[styles.selectedTagText, { color: selectedCatMeta.color }]}>{selectedCategory}</Text>
                    </View>
                  )}
                </View>

                {/* Category Icon Pills Horizontal Grid / Scroll */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScrollContainer}
                >
                  {['All', ...categories.map((c) => c.name)].map((catName) => {
                    const isSelected = selectedCategory === catName;
                    const catMeta = getCatMeta(catName);
                    const pillBg = isSelected
                      ? catMeta.color
                      : (isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.9)');
                    const pillBorder = isSelected
                      ? catMeta.color
                      : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)');
                    const iconColor = isSelected ? '#FFFFFF' : catMeta.color;

                    return (
                      <TouchableOpacity
                        key={catName}
                        style={[
                          styles.categoryCardPill,
                          {
                            backgroundColor: pillBg,
                            borderColor: pillBorder,
                            shadowColor: isSelected ? catMeta.color : '#000',
                            shadowOpacity: isSelected ? 0.3 : 0,
                            shadowRadius: 6,
                            elevation: isSelected ? 3 : 0,
                          },
                        ]}
                        onPress={() => setSelectedCategory(catName)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.categoryIconBadge,
                            { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(15,23,42,0.4)' : '#FFFFFF') },
                          ]}
                        >
                          <MaterialCommunityIcons name={catMeta.icon as any} size={15} color={iconColor} />
                        </View>
                        <Text
                          style={[
                            styles.categoryPillText,
                            { color: isSelected ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {catName}
                        </Text>
                        {isSelected && (
                          <View style={styles.checkBadge}>
                            <Check size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Spending Preview Insight */}
                <View style={[styles.spendingInsightBox, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#F8FAFC' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={14} color={selectedCatMeta.color} />
                    <Text style={[styles.insightText, { color: colors.textSecondary }]}>
                      Current {period} spending for <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedCategory}</Text>:
                    </Text>
                  </View>
                  <Text style={[styles.insightAmount, { color: selectedCatMeta.color }]}>
                    {expenseHelpers.getCurrencySymbol(settings.currency)}
                    {currentCategorySpend.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Budget Limit Input */}
                <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>BUDGET LIMIT AMOUNT</Text>
                <View style={[styles.amountInputRow, { borderColor: colors.border, backgroundColor: isDark ? '#0F172A' : '#FAFAFA' }]}>
                  <Text style={[styles.currencyPrefix, { color: colors.primary }]}>
                    {expenseHelpers.getCurrencySymbol(settings.currency)}
                  </Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={limitAmount}
                    onChangeText={setLimitAmount}
                  />
                  {limitAmount.length > 0 && (
                    <TouchableOpacity onPress={() => setLimitAmount('')} style={{ padding: 4 }}>
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Add Presets */}
                <View style={styles.quickPresetRow}>
                  <Text style={[styles.quickPresetLabel, { color: colors.textSecondary }]}>Quick add:</Text>
                  {[50, 100, 500, 1000].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.quickPresetBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                      onPress={() => handleQuickAddAmount(val)}
                    >
                      <Text style={[styles.quickPresetText, { color: colors.text }]}>+{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.divider} />

                {/* Period Selection */}
                <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>BUDGET PERIOD</Text>
                <View style={styles.periodRow}>
                  {(['weekly', 'monthly', 'yearly'] as const).map((p) => {
                    const isSelected = period === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.periodBtn,
                          {
                            backgroundColor: isSelected ? colors.primary : (isDark ? '#1E293B' : '#F1F5F9'),
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setPeriod(p)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.periodText,
                            { color: isSelected ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Submit Action Button */}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveBudget}
                  activeOpacity={0.85}
                >
                  {editingBudgetId ? (
                    <>
                      <Check size={18} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.saveBtnText}>Update Spending Limit</Text>
                    </>
                  ) : (
                    <>
                      <Plus size={18} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.saveBtnText}>Set Spending Limit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Card>

              {/* Active Budget Goals Header */}
              <View style={styles.activeHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Target size={16} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>ACTIVE BUDGET GOALS</Text>
                </View>
                {!isGoalsLoading && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.countBadgeText, { color: colors.primary }]}>{budgets.length}</Text>
                  </View>
                )}
              </View>

              {isGoalsLoading ? (
                <GoalsSkeleton colors={colors} isDark={isDark} />
              ) : budgets.length === 0 ? (
                <Card style={[styles.emptyCard, { borderColor: colors.border }]}>
                  <View style={[styles.emptyIconBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                    <Settings size={32} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Spending Limits Set</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Create your first category or overall budget goal using the form above.
                  </Text>
                </Card>
              ) : (
                <View style={styles.budgetsList}>
                  {budgets.map((b, idx) => {
                    const catMeta = getCatMeta(b.category);
                    const spentAmount = calculateSpending(b.category, b.period);
                    const limit = b.amount;
                    const percent = Math.min(Math.round((spentAmount / limit) * 100), 999);
                    const isOverBudget = spentAmount > limit;
                    const isEditingThisBudget = editingBudgetId === b.id;

                    let progressColor = '#10B981'; // Green
                    if (percent > 95) {
                      progressColor = '#EF4444'; // Red
                    } else if (percent > 75) {
                      progressColor = '#F59E0B'; // Amber
                    }

                    return (
                      <Animated.View key={b.id} entering={FadeInUp.duration(350).delay(idx * 50)}>
                        <Swipeable
                          renderRightActions={() => renderRightSwipeActions(b)}
                          friction={2}
                          rightThreshold={40}
                        >
                          <Card
                            style={[
                              styles.budgetListItem,
                              {
                                borderColor: isEditingThisBudget
                                  ? colors.primary
                                  : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                                backgroundColor: isEditingThisBudget
                                  ? (isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF')
                                  : colors.card,
                              },
                            ]}
                          >
                            <View style={styles.budgetCardTop}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={[styles.goalIconBadge, { backgroundColor: catMeta.color + '20' }]}>
                                  <MaterialCommunityIcons name={catMeta.icon as any} size={20} color={catMeta.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={[styles.budgetName, { color: colors.text }]} numberOfLines={1}>
                                      {b.category === 'All'
                                        ? `Overall ${b.period.charAt(0).toUpperCase() + b.period.slice(1)}`
                                        : b.category}
                                    </Text>
                                    <View style={[styles.periodTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                                      <Text style={[styles.periodTagText, { color: colors.textSecondary }]}>
                                        {b.period.toUpperCase()}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={[styles.budgetSub, { color: colors.textSecondary }]}>
                                    {expenseHelpers.getCurrencySymbol(settings.currency)}
                                    {spentAmount.toFixed(0)} of {expenseHelpers.getCurrencySymbol(settings.currency)}
                                    {limit.toFixed(0)} spent
                                  </Text>
                                </View>
                              </View>

                              {/* Right Action Icons & Percentage Badge */}
                              <View style={styles.cardRightContainer}>
                                <View
                                  style={[
                                    styles.percentBadge,
                                    { backgroundColor: progressColor + '20' },
                                  ]}
                                >
                                  <Text style={[styles.percentBadgeText, { color: progressColor }]}>
                                    {percent}%
                                  </Text>
                                </View>

                                <View style={styles.inlineActionRow}>
                                  <TouchableOpacity
                                    style={[styles.miniActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                                    onPress={() => handleEditBudget(b)}
                                  >
                                    <Edit3 size={14} color={colors.primary} />
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[styles.miniActionBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2' }]}
                                    onPress={() => handleDeleteBudget(b.id, b.category)}
                                  >
                                    <Trash2 size={14} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>

                            {/* Spending Progress Bar */}
                            <View style={styles.progressTrackBg}>
                              <View
                                style={[
                                  styles.progressFill,
                                  {
                                    width: `${Math.min(percent, 100)}%`,
                                    backgroundColor: progressColor,
                                  },
                                ]}
                              />
                            </View>

                            {/* Over budget or remaining info footer */}
                            <View style={styles.budgetFooterRow}>
                              {isOverBudget ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <AlertTriangle size={12} color="#EF4444" />
                                  <Text style={styles.overBudgetText}>
                                    Exceeded limit by {expenseHelpers.getCurrencySymbol(settings.currency)}
                                    {(spentAmount - limit).toFixed(0)}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={[styles.remainingText, { color: colors.textSecondary }]}>
                                  {expenseHelpers.getCurrencySymbol(settings.currency)}
                                  {(limit - spentAmount).toFixed(0)} left in this {b.period}
                                </Text>
                              )}
                              <Text style={styles.swipeHintText}>Swipe left to delete/edit</Text>
                            </View>
                          </Card>
                        </Swipeable>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  editingBannerText: {
    fontSize: 13,
  },
  cancelEditBtn: {
    padding: 4,
  },
  formCard: {
    padding: 16,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  selectedTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  selectedTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryScrollContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  categoryCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  categoryIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  checkBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  spendingInsightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  insightText: {
    fontSize: 11,
  },
  insightAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 14,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginTop: 8,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    height: '100%',
  },
  quickPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  quickPresetLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginRight: 2,
  },
  quickPresetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickPresetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  activeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  emptyIconBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  budgetsList: {
    gap: 12,
  },
  budgetListItem: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  budgetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontSize: 14,
    fontWeight: '800',
  },
  periodTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  periodTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  budgetSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  cardRightContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  inlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrackBg: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingText: {
    fontSize: 10,
    fontWeight: '600',
  },
  overBudgetText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  swipeHintText: {
    fontSize: 9,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  swipeActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 8,
  },
  swipeEditBtn: {
    width: 64,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginRight: 4,
  },
  swipeDeleteBtn: {
    width: 64,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  swipeBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },

  // Skeleton Styles
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  skeletonTitle: {
    height: 14,
    borderRadius: 6,
    marginBottom: 14,
  },
  skeletonPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  skeletonPill: {
    width: 70,
    height: 32,
    borderRadius: 12,
  },
  skeletonDivider: {
    height: 1,
    marginVertical: 14,
  },
  skeletonInput: {
    height: 48,
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonPeriodBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
  },
  skeletonButton: {
    height: 46,
    borderRadius: 12,
    marginTop: 8,
  },
  skeletonGoalCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
});
