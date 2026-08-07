import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useExpenseStore } from '../../store/expenseStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Card } from '../../components/Card';
import * as ImagePicker from 'expo-image-picker';
import { notificationService } from '../../services/notificationService';
import { Calendar, Clock, DollarSign, Image as ImageIcon, Check, Trash } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';

export default function AddExpenseModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  
  // Search parameters for Edit Mode
  const { id } = useLocalSearchParams<{ id?: string }>();
  
  const { expenses, categories, budgets, addExpense, updateExpense, deleteExpense } = useExpenseStore();
  const { settings } = useSettingsStore();

  // Form states
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(expenseHelpers.getLocalDateString());
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [notes, setNotes] = useState('');
  const [tax, setTax] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);

  const isEditMode = !!id;

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (isEditMode && id) {
      const existing = expenses.find((e) => e.id === id);
      if (existing) {
        setAmount(existing.amount.toString());
        setMerchant(existing.merchant);
        setCategory(existing.category);
        setDate(existing.date);
        setTime(existing.time);
        setPaymentMethod(existing.paymentMethod);
        setNotes(existing.notes ?? '');
        setTax(existing.tax ? existing.tax.toString() : '');
        setReceiptImage(existing.receiptImage);
        
        // Update navigation title for edit mode
        navigation.setOptions({ title: 'Edit Transaction' });
      }
    }
  }, [id, isEditMode, expenses]);

  const selectReceiptImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      useAlertStore.getState().showAlert('Permission Required', 'Cooperation needed to access gallery.', 'warning');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      setReceiptImage(pickerResult.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      useAlertStore.getState().showAlert('Invalid Input', 'Please enter a valid positive expense amount.', 'warning');
      return;
    }
    if (!merchant.trim()) {
      useAlertStore.getState().showAlert('Invalid Input', 'Please enter a merchant name.', 'warning');
      return;
    }

    const expensePayload = {
      amount: parsedAmount,
      merchant: merchant.trim(),
      category,
      date,
      time,
      paymentMethod,
      currency: settings.currency,
      tax: tax ? parseFloat(tax) : undefined,
      notes: notes.trim() || undefined,
      receiptImage,
    };

    if (isEditMode && id) {
      const original = expenses.find((e) => e.id === id)!;
      updateExpense({
        ...original,
        ...expensePayload,
      });
      useAlertStore.getState().showAlert('Success', 'Transaction successfully updated.', 'success');
    } else {
      const newId = `exp_${Date.now()}`;
      addExpense({
        id: newId,
        ...expensePayload,
      });
      
      // Perform Budget limit evaluations and push alerts
      _checkBudgetLimits(category, parsedAmount);
      useAlertStore.getState().showAlert('Success', 'Transaction successfully logged.', 'success');
    }

    router.back();
  };
  const _checkBudgetLimits = (itemCategory: string, itemAmount: number) => {
    const threshold = settings.budgetWarningThreshold || 80;
    const thresholdFrac = threshold / 100;

    // 1. Overall monthly budget check
    const overallBudget = budgets.find((b) => b.category === 'All' && b.period === 'monthly');
    if (overallBudget) {
      const monthlySpend = expenses
        .filter((e) => e.date.startsWith(expenseHelpers.getLocalDateString().slice(0, 7)))
        .reduce((sum, e) => sum + Number(e.amount), 0) + itemAmount;
      const oldMonthlySpend = monthlySpend - itemAmount;
      const warningLimit = overallBudget.amount * thresholdFrac;

      if (monthlySpend > overallBudget.amount) {
        notificationService.sendImmediateNotification(
          '🚨 Monthly Budget Exceeded!',
          `Your total spending (${expenseHelpers.getCurrencySymbol(settings.currency)}${monthlySpend.toFixed(2)}) has gone over your monthly budget limit of ${expenseHelpers.getCurrencySymbol(settings.currency)}${overallBudget.amount.toFixed(2)}.`
        );
      } else if (
        settings.budgetWarningEnabled &&
        oldMonthlySpend < warningLimit &&
        monthlySpend >= warningLimit
      ) {
        notificationService.sendImmediateNotification(
          '⚠️ Approaching Monthly Budget!',
          `You have spent ${threshold}% (${expenseHelpers.getCurrencySymbol(settings.currency)}${monthlySpend.toFixed(2)}) of your overall monthly budget limit of ${expenseHelpers.getCurrencySymbol(settings.currency)}${overallBudget.amount.toFixed(2)}.`
        );
      }
    }

    // 2. Specific category budget check
    const catBudget = budgets.find((b) => b.category === itemCategory && b.period === 'monthly');
    if (catBudget) {
      const catSpend = expenses
        .filter((e) => e.category === itemCategory && e.date.startsWith(expenseHelpers.getLocalDateString().slice(0, 7)))
        .reduce((sum, e) => sum + Number(e.amount), 0) + itemAmount;
      const oldCatSpend = catSpend - itemAmount;
      const catWarningLimit = catBudget.amount * thresholdFrac;

      if (catSpend > catBudget.amount) {
        notificationService.sendImmediateNotification(
          `🚨 Category Limit Exceeded: ${itemCategory}`,
          `Your ${itemCategory} spending (${expenseHelpers.getCurrencySymbol(settings.currency)}${catSpend.toFixed(2)}) has gone over your set category monthly limit (${expenseHelpers.getCurrencySymbol(settings.currency)}${catBudget.amount.toFixed(2)}).`
        );
      } else if (
        settings.budgetWarningEnabled &&
        oldCatSpend < catWarningLimit &&
        catSpend >= catWarningLimit
      ) {
        notificationService.sendImmediateNotification(
          `⚠️ Approaching Category Limit: ${itemCategory}`,
          `You have spent ${threshold}% (${expenseHelpers.getCurrencySymbol(settings.currency)}${catSpend.toFixed(2)}) of your monthly limit of ${expenseHelpers.getCurrencySymbol(settings.currency)}${catBudget.amount.toFixed(2)} for ${itemCategory}.`
        );
      }
    }
  };
  const handleDeleteExpense = () => {
    if (id) {
      useAlertStore.getState().showAlert(
        'Delete Transaction',
        'Are you sure you want to permanently delete this transaction?',
        'warning',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteExpense(id);
              router.back();
            },
          },
        ]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Header
        title={isEditMode ? 'EDIT TRANSACTION' : 'ADD TRANSACTION'}
        showBackButton={true}
        onBackPress={() => router.back()}
        hideRightAction={true}
      />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Amount Input Card */}
        <Card style={[styles.amountCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>EXPENSE AMOUNT</Text>
          <View style={styles.amountInputRow}>
            <Text style={[styles.currencyPrefix, { color: colors.text }]}>
              {expenseHelpers.getCurrencySymbol(settings.currency)}
            </Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              autoFocus={!isEditMode}
            />
          </View>
        </Card>

        {/* Transaction details card */}
        <Card style={styles.formCard}>
          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>MERCHANT / WHO</Text>
          <TextInput
            style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="e.g. Starbucks, Walmart, Uber"
            placeholderTextColor={colors.textSecondary}
            value={merchant}
            onChangeText={setMerchant}
          />

          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>DATE</Text>
              <View style={[styles.textInputRow, { borderColor: colors.border }]}>
                <Calendar size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.iconInput, { color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={date}
                  onChangeText={setDate}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>TIME</Text>
              <View style={[styles.textInputRow, { borderColor: colors.border }]}>
                <Clock size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.iconInput, { color: colors.text }]}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textSecondary}
                  value={time}
                  onChangeText={setTime}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Categories selector */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const isSelected = category === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor: isSelected ? cat.color : colors.card,
                    borderColor: isSelected ? cat.color : colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  },
                ]}
                onPress={() => setCategory(cat.name)}
              >
                <MaterialCommunityIcons 
                  name={cat.icon as any} 
                  size={16} 
                  color={isSelected ? '#FFFFFF' : (isDark ? '#818CF8' : cat.color)} 
                />
                <Text
                  style={[
                    styles.categoryText,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Additional fields */}
        <Card style={styles.formCard}>
          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>PAYMENT METHOD</Text>
          <View style={styles.paymentMethodGrid}>
            {['Credit Card', 'Debit Card', 'Cash', 'Google Pay', 'PhonePe', 'Paytm', 'UPI'].map((method) => {
              const isSelected = paymentMethod === method;
              return (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentPill,
                    {
                      backgroundColor: isSelected ? colors.primary : (isDark ? '#1E293B' : '#F5F5F7'),
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text
                    style={[
                      styles.paymentPillText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>TAX (OPTIONAL)</Text>
          <TextInput
            style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={tax}
            onChangeText={setTax}
          />

          <View style={styles.divider} />

          <Text style={[styles.inputHeading, { color: colors.textSecondary }]}>NOTES</Text>
          <TextInput
            style={[styles.textArea, { color: colors.text, borderColor: colors.border }]}
            placeholder="Add transaction notes or descriptions..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </Card>

        {/* Attachment Card */}
        <Card style={styles.attachmentCard}>
          <TouchableOpacity style={styles.attachmentBtn} onPress={selectReceiptImage}>
            <ImageIcon size={20} color={colors.primary} />
            <Text style={[styles.attachmentText, { color: colors.primary }]}>
              {receiptImage ? 'Change Attached Receipt' : 'Attach Receipt Image / Gallery'}
            </Text>
          </TouchableOpacity>
          {receiptImage && (
            <View style={styles.attachedImageRow}>
              <Text style={[styles.attachedImageLabel, { color: colors.text }]} numberOfLines={1}>
                ✓ Receipt: {receiptImage.split('/').pop()}
              </Text>
              <TouchableOpacity onPress={() => setReceiptImage(undefined)}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Action Button Row */}
        <View style={styles.actionBtnRow}>
          {isEditMode && (
            <TouchableOpacity
              style={[
                styles.deleteBtn, 
                { 
                  borderColor: colors.danger, 
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' 
                }
              ]}
              onPress={handleDeleteExpense}
            >
              <Trash size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Check size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.saveBtnText}>{isEditMode ? 'Update Expense' : 'Log Expense'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
  },
  amountCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 38,
    fontWeight: '800',
    flex: 1,
  },
  inputHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formCard: {
    padding: 16,
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    marginBottom: 14,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  iconInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    height: '100%',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  categoryBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  paymentPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  paymentPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginVertical: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  attachmentCard: {
    padding: 14,
    marginBottom: 18,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  attachmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attachedImageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 8,
    borderRadius: 8,
  },
  attachedImageLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
