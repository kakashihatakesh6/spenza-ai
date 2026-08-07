import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ocrService, OcrResult } from '../../services/ocrService';
import { aiService } from '../../services/aiService';
import { useExpenseStore } from '../../store/expenseStore';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../services/logger';
import { useAlertStore } from '../../store/alertStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Card } from '../../components/Card';
import { ALL_CURRENCIES, QUICK_CURRENCIES, searchCurrencies } from '../../constants/currencies';
import { Image as ImageIcon, Check, RefreshCw, Smartphone, Sparkles, Calendar as CalendarIcon, X, ChevronDown, Search, Globe } from 'lucide-react-native';
import { Header } from '../../components/Header';

const EXPENSE_CATEGORIES = [
  { name: 'Food', icon: 'food-fork-drink', color: '#FF9500' },
  { name: 'Grocery', icon: 'cart', color: '#4CD964' },
  { name: 'Fuel', icon: 'gas-station', color: '#FFCC00' },
  { name: 'Shopping', icon: 'shopping', color: '#FF2D55' },
  { name: 'Bills', icon: 'file-document-outline', color: '#5856D6' },
  { name: 'Travel', icon: 'airplane', color: '#5AC8FA' },
  { name: 'Entertainment', icon: 'movie-roll', color: '#FF5E3A' },
  { name: 'Health', icon: 'heart-pulse', color: '#FF3B30' },
  { name: 'Rent', icon: 'home-variant', color: '#8E8E93' },
  { name: 'EMI', icon: 'bank', color: '#A4E786' },
  { name: 'Education', icon: 'school', color: '#007AFF' },
  { name: 'Other', icon: 'dots-horizontal', color: '#C7C7CC' },
];

const INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'cash-multiple', color: '#34C759' },
  { name: 'Freelance', icon: 'laptop', color: '#6366F1' },
  { name: 'Investment', icon: 'trending-up', color: '#32D74B' },
  { name: 'Gift', icon: 'gift', color: '#FF2D55' },
  { name: 'Refund', icon: 'rotate-left', color: '#FF9500' },
  { name: 'Other Income', icon: 'cash-plus', color: '#5856D6' },
];

const getCategoryIconName = (catName: string): string => {
  const found = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(
    (c) => c.name.toLowerCase() === (catName || '').toLowerCase()
  );
  if (found) return found.icon;
  const lower = (catName || '').toLowerCase();
  if (lower.includes('food') || lower.includes('dine') || lower.includes('cafe')) return 'food-fork-drink';
  if (lower.includes('grocer') || lower.includes('mart')) return 'cart';
  if (lower.includes('fuel') || lower.includes('gas') || lower.includes('petrol')) return 'gas-station';
  if (lower.includes('shop') || lower.includes('cloth') || lower.includes('store')) return 'shopping';
  if (lower.includes('bill') || lower.includes('electric') || lower.includes('water')) return 'file-document-outline';
  if (lower.includes('travel') || lower.includes('flight') || lower.includes('cab')) return 'airplane';
  if (lower.includes('movie') || lower.includes('entertain')) return 'movie-roll';
  if (lower.includes('health') || lower.includes('pharm') || lower.includes('med')) return 'heart-pulse';
  if (lower.includes('rent') || lower.includes('house')) return 'home-variant';
  if (lower.includes('bank') || lower.includes('emi') || lower.includes('loan')) return 'bank';
  if (lower.includes('school') || lower.includes('edu')) return 'school';
  if (lower.includes('salary') || lower.includes('pay')) return 'cash-multiple';
  return 'dots-horizontal';
};

export default function ScreenshotModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { addExpense } = useExpenseStore();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string | undefined>(undefined);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);

  // Editable preview values
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [tax, setTax] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [currency, setCurrency] = useState('INR');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState('');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const [isYearPickerView, setIsYearPickerView] = useState(false);

  const convert = useCurrencyStore((state) => state.convert);

  const pickScreenshot = async (selectedPreset?: string) => {
    try {
      let uri = 'mock_upi_screenshot.png';

      if (!selectedPreset) {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          useAlertStore.getState().showAlert('Permission Required', 'Cooperation needed to access gallery.', 'warning');
          return;
        }

        const pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });

        if (pickerResult.canceled || pickerResult.assets.length === 0) {
          return;
        }

        uri = pickerResult.assets[0].uri;
      } else {
        uri = `mock_${selectedPreset}_screenshot.png`;
      }

      setImageUri(uri);
      setPresetName(selectedPreset);
    } catch (e: any) {
      logger.error('Selection Failed', e);
      useAlertStore.getState().showAlert('Selection Failed', e.message || 'Unable to select screenshot.', 'error');
    }
  };

  const scanScreenshot = async () => {
    if (!imageUri) return;
    try {
      setIsScanning(true);

      // 1. Run OCR
      const detectedPreset = presetName || 'gpay_upi';
      const ocrResult = await ocrService.extractReceipt(imageUri, detectedPreset);
      
      // 2. Run AI Categorization on merchant name and items
      const itemsText = ocrResult.items.map((it) => it.name).join(' ');
      const categoryResult = await aiService.classifyExpense(ocrResult.merchant, itemsText);

      setResult(ocrResult);
      setMerchant(ocrResult.merchant);
      setAmount(ocrResult.amount.toString());
      setCategory(categoryResult.category || 'Food');
      setDate(ocrResult.date || expenseHelpers.getLocalDateString());
      setTax(ocrResult.tax ? ocrResult.tax.toString() : '0');
      setTransactionId(ocrResult.transactionId || 'N/A');
      setPaymentMethod(ocrResult.paymentMethod || 'Online');
      setCurrency(ocrResult.currency || 'INR');
      
      setIsScanning(false);
    } catch (e: any) {
      logger.error('Scan Failed', e);
      useAlertStore.getState().showAlert('Scan Failed', e.message || 'Failed to extract details from screenshot. Please try again.', 'error');
      setIsScanning(false);
      setImageUri(null);
      setResult(null);
    }
  };

  const handleSaveExtracted = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      useAlertStore.getState().showAlert('Invalid Amount', 'Please set a valid positive amount.', 'warning');
      return;
    }
    if (!merchant.trim()) {
      useAlertStore.getState().showAlert('Invalid Merchant', 'Merchant name is required.', 'warning');
      return;
    }

    addExpense({
      id: `exp_${Date.now()}`,
      amount: parsedAmount,
      merchant: merchant.trim(),
      category: category || 'Other',
      date: date || expenseHelpers.getLocalDateString(),
      time: result?.time || new Date().toTimeString().slice(0, 5),
      paymentMethod: paymentMethod || 'Online',
      currency: currency || 'INR',
      tax: tax ? parseFloat(tax) : 0,
      notes: `Extracted from screenshot. Txn ID: ${transactionId}`,
      receiptImage: imageUri || undefined,
    });

    useAlertStore.getState().showAlert('Success', 'Screenshot payment logged successfully!', 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="IMPORT UPI"
        showBackButton={true}
        onBackPress={() => router.back()}
        hideRightAction={true}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={[styles.container, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
        >
        {!imageUri && !isScanning ? (
          <View style={styles.pickerBox}>
            <View style={[styles.phoneIconBg, { backgroundColor: colors.primaryLight }]}>
              <Smartphone size={32} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>UPI Payment Screen</Text>
            <Text style={[styles.subText, { color: colors.textSecondary }]}>
              Import screenshots from Google Pay, PhonePe, Paytm or bank apps to extract transaction values instantly.
            </Text>

            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: colors.primary }]}
              onPress={() => pickScreenshot()}
              activeOpacity={0.8}
            >
              <ImageIcon size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.pickerBtnText}>Select Screenshot</Text>
            </TouchableOpacity>

            {/* Preset Demos */}
            <Text style={[styles.demoLabel, { color: colors.textSecondary }]}>CHOOSE PRESET SCREEN (MOCK)</Text>
            <View style={styles.demoRow}>
              {['gpay_upi', 'phonepe_upi', 'paytm_upi'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.demoBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    }
                  ]}
                  onPress={() => pickScreenshot(preset)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.demoText, { color: colors.text }]}>
                    {preset.split('_')[0].toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
      ) : isScanning ? (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.scanningText, { color: colors.text }]}>Analyzing Screenshot pixels...</Text>
          <Text style={[styles.scanningSub, { color: colors.textSecondary }]}>Extracting Transaction IDs and UPI details...</Text>
        </View>
      ) : !result ? (
        <View style={styles.previewContainer}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>Confirm UPI Screenshot</Text>
          <Text style={[styles.previewSubtitle, { color: colors.textSecondary }]}>
            Review the captured screenshot image before scanning it with the AI OCR engine.
          </Text>
          
          <View style={[styles.imageWrapper, { borderColor: colors.border }]}>
            {presetName ? (
              <Image 
                source={
                  presetName === 'gpay_upi' ? require('../../../assets/images/gpay_screenshot.png') :
                  presetName === 'phonepe_upi' ? require('../../../assets/images/gpay_screenshot.png') :
                  presetName === 'paytm_upi' ? require('../../../assets/images/gpay_screenshot.png') :
                  require('../../../assets/images/gpay_screenshot.png')
                }
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <Image 
                source={{ uri: imageUri || undefined }} 
                style={styles.previewImage} 
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.previewActionBtnRow}>
            <TouchableOpacity
              style={[styles.retakeBtn, { borderColor: colors.border }]}
              onPress={() => {
                setImageUri(null);
                setPresetName(undefined);
              }}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.retakeBtnText, { color: colors.text }]}>Discard / Reselect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={scanScreenshot}
              activeOpacity={0.8}
            >
              <Sparkles size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>Scan & Extract</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        result && (
          <View style={styles.resultsPanel}>
            <Text style={[styles.previewHeading, { color: colors.text }]}>AI Smart Verification ✨</Text>
            <Text style={[styles.previewSubText, { color: colors.textSecondary }]}>
              Our AI engine extracted these details with high precision. Give them a quick review and fine-tune your expense in seconds! 🚀
            </Text>

            {/* Form Fields */}
            <Card style={styles.previewCard}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>RECEIVER / MERCHANT</Text>
              <TextInput
                style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Receiver name"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Amount & Currency Conversion */}
              <View style={{ marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>AMOUNT & CURRENCY</Text>
                  
                  {/* Currency Options Aligned Right */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {['USD', 'INR', 'GBP'].map((curr) => (
                      <TouchableOpacity
                        key={curr}
                        onPress={() => setCurrency(curr)}
                        style={[
                          styles.currBadgePill,
                          currency === curr
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: colors.border }
                        ]}
                      >
                        <Text style={[styles.currBadgeText, currency === curr ? { color: '#FFF' } : { color: colors.textSecondary }]}>
                          {curr}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setShowCurrencyModal(true)}
                      style={[
                        styles.currBadgePill,
                        {
                          backgroundColor: ['USD', 'INR', 'GBP'].includes(currency)
                            ? (isDark ? '#1E293B' : '#F1F5F9')
                            : colors.primary,
                          borderColor: ['USD', 'INR', 'GBP'].includes(currency) ? colors.border : colors.primary,
                          paddingHorizontal: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                        }
                      ]}
                      activeOpacity={0.7}
                    >
                      {!['USD', 'INR', 'GBP'].includes(currency) && (
                        <Text style={[styles.currBadgeText, { color: '#FFF', marginRight: 2 }]}>
                          {currency}
                        </Text>
                      )}
                      <ChevronDown size={14} color={!['USD', 'INR', 'GBP'].includes(currency) ? '#FFF' : colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.amountInputWithConversionRow}>
                  <View style={[styles.amountInputBox, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>
                    <Text style={[styles.currencyPrefix, { color: colors.primary }]}>
                      {expenseHelpers.getCurrencySymbol(currency)}
                    </Text>
                    <TextInput
                      style={[styles.amountInput, { color: colors.text }]}
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  {/* Right-side Live INR Conversion Card */}
                  <View style={[styles.inrConversionCard, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF', borderColor: colors.primary + '44' }]}>
                    <View style={styles.inrConversionHeaderRow}>
                      <Sparkles size={11} color={colors.primary} />
                      <Text style={[styles.inrConversionLabel, { color: colors.primary }]}>LIVE INR CONVERSION</Text>
                    </View>
                    <Text style={[styles.inrConvertedValue, { color: colors.text }]} numberOfLines={1}>
                      ₹{convert(parseFloat(amount) || 0, currency, 'INR').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.inrRateSub, { color: colors.textSecondary }]}>
                      {currency === 'INR' ? 'Native Currency' : `1 ${currency} ≈ ₹${convert(1, currency, 'INR').toFixed(2)} INR`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* AI Category with Icon & Scroll Selection */}
              <View style={{ marginTop: 14 }}>
                <View style={styles.categoryHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.catIconCircle, { backgroundColor: colors.primary }]}>
                      <MaterialCommunityIcons name={getCategoryIconName(category) as any} size={15} color="#FFF" />
                    </View>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                      AI CATEGORY SELECTION
                    </Text>
                  </View>

                  {/* Type Filter Toggle: Expense / Income */}
                  <View style={styles.typeToggleRow}>
                    <TouchableOpacity
                      onPress={() => setTransactionType('expense')}
                      style={[
                        styles.typePill,
                        transactionType === 'expense'
                          ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                          : { borderColor: colors.border }
                      ]}
                    >
                      <Text style={[styles.typePillText, transactionType === 'expense' && { color: '#FFF' }]}>Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setTransactionType('income')}
                      style={[
                        styles.typePill,
                        transactionType === 'income'
                          ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                          : { borderColor: colors.border }
                      ]}
                    >
                      <Text style={[styles.typePillText, transactionType === 'income' && { color: '#FFF' }]}>Income</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Category Scroll Selection */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScrollContainer}
                  style={{ marginTop: 8 }}
                >
                  {(transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((item) => {
                    const isSelected = category.toLowerCase() === item.name.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={item.name}
                        onPress={() => setCategory(item.name)}
                        activeOpacity={0.7}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: isSelected
                              ? item.color + '22'
                              : isDark
                              ? '#1E293B'
                              : '#F1F5F9',
                            borderColor: isSelected ? item.color : colors.border,
                          },
                        ]}
                      >
                        <View style={[styles.chipIconBox, { backgroundColor: isSelected ? item.color : 'rgba(150,150,150,0.15)' }]}>
                          <MaterialCommunityIcons
                            name={item.icon as any}
                            size={14}
                            color={isSelected ? '#FFF' : colors.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.categoryChipText,
                            {
                              color: isSelected ? (isDark ? '#FFF' : '#0F172A') : colors.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {item.name}
                        </Text>
                        {isSelected && (
                          <Check size={12} color={item.color} style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>TRANSACTION ID</Text>
              <TextInput
                style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                value={transactionId}
                onChangeText={setTransactionId}
                placeholder="UPI / Bank Reference ID"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Date & Tax Input Row */}
              <View style={[styles.rowFields, { marginTop: 12 }]}>
                {/* Date Selection using react-native-calendars */}
                <View style={{ flex: 1.8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DATE</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCalendarDate(date || expenseHelpers.getLocalDateString());
                      setShowDatePicker(true);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.datePickerTrigger,
                      { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', justifyContent: 'space-between' }
                    ]}
                  >
                    <Text style={[styles.dateText, { color: date ? colors.text : colors.textSecondary }]}>
                      {date || 'Select Date'}
                    </Text>
                    <CalendarIcon size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Reduced Width Tax Input */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TAX</Text>
                  <View
                    style={[
                      styles.taxInputBox,
                      { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }
                    ]}
                  >
                    <TextInput
                      style={[styles.taxInput, { color: colors.text }]}
                      keyboardType="decimal-pad"
                      value={tax}
                      onChangeText={setTax}
                      placeholder="0.00"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <Text style={[styles.taxSuffix, { color: colors.textSecondary }]}>
                      {expenseHelpers.getCurrencySymbol(currency)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Payment Method Selection (Default: UPI) */}
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PAYMENT METHOD</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                  style={{ marginTop: 6 }}
                >
                  {[
                    'UPI',
                    'Online',
                    'Credit Card',
                    'Debit Card',
                    'Cash',
                    'Net Banking',
                  ].map((method) => {
                    const isSelected = (paymentMethod || 'UPI').toLowerCase() === method.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={method}
                        onPress={() => setPaymentMethod(method)}
                        activeOpacity={0.7}
                        style={[
                          styles.paymentChip,
                          isSelected
                            ? {
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                                shadowColor: colors.primary,
                                shadowOpacity: 0.35,
                                shadowRadius: 6,
                                elevation: 4,
                              }
                            : {
                                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                borderColor: colors.border,
                              },
                        ]}
                      >
                        <Text
                          style={[
                            styles.paymentChipText,
                            {
                              color: isSelected ? '#FFFFFF' : colors.textSecondary,
                              fontWeight: isSelected ? '800' : '500',
                            },
                          ]}
                        >
                          {method}
                        </Text>
                        {isSelected && <Check size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Card>

            {/* Calendar Modal with Vertical Scroll Year Picker */}
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <TouchableOpacity
                style={styles.calendarModalOverlay}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.calendarModalContent, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                >
                  <View style={styles.calendarModalHeader}>
                    <TouchableOpacity
                      onPress={() => setIsYearPickerView(!isYearPickerView)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={[styles.calendarModalTitle, { color: colors.text }]}>
                        {isYearPickerView ? 'Select Year' : 'Select Date'}
                      </Text>
                      <ChevronDown size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowDatePicker(false); setIsYearPickerView(false); }}>
                      <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {isYearPickerView ? (
                    <View style={{ height: 320 }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                        SCROLL TO CHOOSE YEAR (1990 - 2035)
                      </Text>
                      <ScrollView
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={{ gap: 6, paddingBottom: 16 }}
                      >
                        {Array.from({ length: 46 }, (_, i) => 1990 + i).map((yr) => {
                          const activeYear = parseInt((calendarDate || date || expenseHelpers.getLocalDateString()).split('-')[0]);
                          const isSelected = activeYear === yr;
                          return (
                            <TouchableOpacity
                              key={yr}
                              onPress={() => {
                                const base = calendarDate || date || expenseHelpers.getLocalDateString();
                                const parts = base.split('-');
                                const month = parts[1] || '01';
                                const day = parts[2] || '01';
                                setCalendarDate(`${yr}-${month}-${day}`);
                                setIsYearPickerView(false);
                              }}
                              style={[
                                styles.verticalYearRow,
                                {
                                  backgroundColor: isSelected
                                    ? colors.primary
                                    : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                                  borderColor: isSelected ? colors.primary : colors.border,
                                }
                              ]}
                            >
                              <Text style={[styles.verticalYearText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                                {yr}
                              </Text>
                              {isSelected && <Check size={16} color="#FFFFFF" />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        onPress={() => setIsYearPickerView(true)}
                        style={[styles.yearToggleBar, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}
                      >
                        <Text style={[styles.yearToggleBarText, { color: colors.primary }]}>
                          Year: {(calendarDate || date || expenseHelpers.getLocalDateString()).split('-')[0]} (Tap to change year vertically)
                        </Text>
                        <ChevronDown size={16} color={colors.primary} />
                      </TouchableOpacity>

                      <RNCalendar
                        key={calendarDate || date}
                        current={calendarDate || date || expenseHelpers.getLocalDateString()}
                        onDayPress={(day: DateData) => {
                          setDate(day.dateString);
                          setCalendarDate(day.dateString);
                          setShowDatePicker(false);
                          setIsYearPickerView(false);
                        }}
                        enableSwipeMonths={true}
                        markedDates={{
                          [date]: { selected: true, selectedColor: colors.primary }
                        }}
                        theme={{
                          calendarBackground: isDark ? '#1E293B' : '#FFFFFF',
                          textSectionTitleColor: colors.textSecondary,
                          selectedDayBackgroundColor: colors.primary,
                          selectedDayTextColor: '#FFFFFF',
                          todayTextColor: colors.primary,
                          dayTextColor: colors.text,
                          textDisabledColor: isDark ? '#475569' : '#CBD5E1',
                          monthTextColor: colors.text,
                          arrowColor: colors.primary,
                        }}
                      />
                    </>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            {/* Confidence Score info */}
            <View style={styles.confidenceRow}>
              <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
                OCR confidence score: {(result.confidence * 100).toFixed(0)}%
              </Text>
            </View>

            {/* Action Row */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.retakeBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setImageUri(null);
                  setResult(null);
                }}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={[styles.retakeBtnText, { color: colors.text }]}>Retake / Rescan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveExtracted}
                activeOpacity={0.8}
              >
                <Check size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>Save Expense</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      )}
        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Full Currency Picker Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <TouchableOpacity
          style={styles.calendarModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.currencyModalContent,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: colors.border }
            ]}
          >
            <View style={styles.calendarModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Globe size={18} color={colors.primary} />
                <Text style={[styles.calendarModalTitle, { color: colors.text }]}>Select Base Currency</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={[styles.currencySearchBox, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
              <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.currencySearchInput, { color: colors.text }]}
                value={currencySearchQuery}
                onChangeText={setCurrencySearchQuery}
                placeholder="Search currency code or name..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
              {currencySearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCurrencySearchQuery('')}>
                  <X size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Currency List */}
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={true}>
              {searchCurrencies(currencySearchQuery).map((c) => {
                const isSelected = currency === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => {
                      setCurrency(c.code);
                      setShowCurrencyModal(false);
                      setCurrencySearchQuery('');
                    }}
                    style={[
                      styles.currencyRowItem,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + '15'
                          : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.currencyCodeBadge, { backgroundColor: isSelected ? colors.primary : (isDark ? '#0F172A' : '#E2E8F0') }]}>
                        <Text style={[styles.currencyCodeBadgeText, { color: isSelected ? '#FFF' : colors.text }]}>
                          {c.code}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.currencyNameText, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                          {c.name}
                        </Text>
                        <Text style={[styles.currencySymbolText, { color: colors.textSecondary }]}>
                          Symbol: {c.symbol}
                        </Text>
                      </View>
                    </View>

                    {isSelected && <Check size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pickerBox: {
    alignItems: 'center',
    padding: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 24,
  },
  pickerBtn: {
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  pickerBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  demoLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 40,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  demoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scanningOverlay: {
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  scanningText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
  },
  scanningSub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  previewContainer: {
    padding: 16,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  imageWrapper: {
    width: '100%',
    height: 420,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActionBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  resultsPanel: {
    padding: 16,
  },
  previewHeading: {
    fontSize: 20,
    fontWeight: '700',
  },
  previewSubText: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  previewCard: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewInput: {
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  phoneIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  aiTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  retakeBtn: {
    flex: 1,
    borderWidth: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  amountInputWithConversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  amountInputBox: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  inrConversionCard: {
    flex: 1.3,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  inrConversionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inrConversionLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inrConvertedValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  inrRateSub: {
    fontSize: 9,
    fontWeight: '600',
  },
  currBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  currBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  categoryScrollContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 12,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  taxInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
  },
  taxInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  taxSuffix: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  paymentChipText: {
    fontSize: 12,
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  yearToggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  yearToggleBarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verticalYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  verticalYearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  currencyModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  currencySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  currencySearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  currencyRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  currencyCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currencyCodeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  currencyNameText: {
    fontSize: 13,
  },
  currencySymbolText: {
    fontSize: 11,
  },
});
