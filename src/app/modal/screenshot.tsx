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
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ocrService, OcrResult } from '../../services/ocrService';
import { aiService } from '../../services/aiService';
import { useExpenseStore } from '../../store/expenseStore';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../services/logger';
import { useAlertStore } from '../../store/alertStore';
import { Card } from '../../components/Card';
import { Image as ImageIcon, Check, RefreshCw, Smartphone, Sparkles } from 'lucide-react-native';
import { Header } from '../../components/Header';

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
      setCategory(categoryResult.category);
      setDate(ocrResult.date);
      setTax(ocrResult.tax ? ocrResult.tax.toString() : '0');
      setTransactionId(ocrResult.transactionId || 'N/A');
      
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
      category,
      date,
      time: result?.time || new Date().toTimeString().slice(0, 5),
      paymentMethod: result?.paymentMethod || 'UPI',
      currency: result?.currency || 'INR',
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
            <Text style={[styles.previewHeading, { color: colors.text }]}>Review Extracted Details</Text>
            <Text style={[styles.previewSubText, { color: colors.textSecondary }]}>
              Double check and adjust values computed from payment screenshot below.
            </Text>

            {/* Form Fields */}
            <Card style={styles.previewCard}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>RECEIVER / MERCHANT</Text>
              <TextInput
                style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                value={merchant}
                onChangeText={setMerchant}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AMOUNT</Text>
              <TextInput
                style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AI CATEGORY</Text>
                  <View style={styles.aiTagRow}>
                    <TextInput
                      style={[styles.previewInput, { color: colors.text, borderColor: colors.border, flex: 1, marginBottom: 0 }]}
                      value={category}
                      onChangeText={setCategory}
                    />
                    <View style={[styles.sparkBg, { backgroundColor: colors.primaryLight }]}>
                      <Sparkles size={14} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>TRANSACTION ID</Text>
              <TextInput
                style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                value={transactionId}
                onChangeText={setTransactionId}
              />

              <View style={[styles.rowFields, { marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DATE</Text>
                  <TextInput
                    style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                    value={date}
                    onChangeText={setDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TAX</Text>
                  <TextInput
                    style={[styles.previewInput, { color: colors.text, borderColor: colors.border }]}
                    value={tax}
                    onChangeText={setTax}
                  />
                </View>
              </View>
            </Card>

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
});
