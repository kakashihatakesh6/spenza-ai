import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Header } from '../../components/Header';
import { useExpenseStore } from '../../store/expenseStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAlertStore } from '../../store/alertStore';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../components/Card';
import { Plus, Trash, Check, Settings } from 'lucide-react-native';
import { expenseHelpers } from '../../utils/expenseHelpers';

export default function BudgetModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const { budgets, categories, saveBudget, deleteBudget } = useExpenseStore();
  const { settings } = useSettingsStore();

  // Form states
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const handleSaveBudget = async () => {
    const parsedAmount = parseFloat(limitAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      useAlertStore.getState().showAlert('Invalid Amount', 'Please set a positive budget limit.', 'warning');
      return;
    }

    const budgetId = `${selectedCategory.toLowerCase()}_${period}`;
    try {
      await saveBudget({
        id: budgetId,
        category: selectedCategory,
        amount: parsedAmount,
        period,
      });

      setLimitAmount('');
      useAlertStore.getState().showAlert('Success', `Spending limit set for ${selectedCategory}!`, 'success');
    } catch (err) {
      useAlertStore.getState().showAlert('Error', 'Failed to save budget.', 'error');
    }
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
            } catch (err) {
              useAlertStore.getState().showAlert('Error', 'Failed to delete budget.', 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="SET BUDGET"
        showBackButton={true}
        onBackPress={() => router.back()}
        rightIcon="check"
        onRightPress={handleSaveBudget}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        
        {/* Set budget limits form */}
        <Card style={styles.formCard}>
          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>CHOOSE CATEGORY</Text>
          <View style={styles.categoryPillRow}>
            {['All', ...categories.map((c) => c.name)].map((catName) => {
              const isSelected = selectedCategory === catName;
              return (
                <TouchableOpacity
                  key={catName}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isSelected ? colors.primary : (isDark ? '#1E293B' : '#F5F5F7'),
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(catName)}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {catName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>BUDGET LIMIT AMOUNT</Text>
          <View style={[styles.amountInputRow, { borderColor: colors.border }]}>
            <Text style={[styles.currencyPrefix, { color: colors.text }]}>
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
          </View>

          <View style={styles.divider} />

          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>PERIOD</Text>
          <View style={styles.periodRow}>
            {(['weekly', 'monthly', 'yearly'] as const).map((p) => {
              const isSelected = period === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.periodBtn,
                    {
                      backgroundColor: isSelected ? colors.primary : (isDark ? '#1E293B' : '#F5F5F7'),
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setPeriod(p)}
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

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveBudget}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.saveBtnText}>Set Spending Limit</Text>
          </TouchableOpacity>
        </Card>

        {/* List of active budget goals */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACTIVE BUDGET GOALS</Text>

        {budgets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Settings size={28} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 8 }]}>
              No active spending limits set. Configure one above.
            </Text>
          </Card>
        ) : (
          <View style={styles.budgetsList}>
            {budgets.map((b) => (
              <Card key={b.id} style={styles.budgetListItem}>
                <View style={styles.budgetInfoRow}>
                  <View>
                    <Text style={[styles.budgetName, { color: colors.text }]}>
                      {b.category === 'All' 
                        ? `Overall ${b.period.charAt(0).toUpperCase() + b.period.slice(1)} Budget` 
                        : `${b.category} Budget`}
                    </Text>
                    <Text style={[styles.budgetSub, { color: colors.textSecondary }]}>
                      Period: {b.period.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rightActionRow}>
                    <Text style={[styles.budgetLimitVal, { color: colors.text }]}>
                      {expenseHelpers.getCurrencySymbol(settings.currency)}
                      {b.amount.toFixed(0)}
                    </Text>
                    <TouchableOpacity
                      style={[styles.deleteBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}
                      onPress={() => handleDeleteBudget(b.id, b.category)}
                    >
                      <Trash size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  formCard: {
    padding: 16,
    marginBottom: 20,
  },
  inputHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoryPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginVertical: 14,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    height: '100%',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 10,
    fontWeight: '700',
  },
  saveBtn: {
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  budgetsList: {
    gap: 4,
  },
  budgetListItem: {
    padding: 12,
    marginVertical: 4,
  },
  budgetInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetName: {
    fontSize: 13,
    fontWeight: '700',
  },
  budgetSub: {
    fontSize: 11,
    marginTop: 2,
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetLimitVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
