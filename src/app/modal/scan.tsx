import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { useRouter, useNavigation } from 'expo-router';
import { Header } from '../../components/Header';
import { ocrService, OcrResult } from '../../services/ocrService';
import { aiService } from '../../services/aiService';
import { useExpenseStore } from '../../store/expenseStore';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { useSettingsStore } from '../../store/settingsStore';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Card } from '../../components/Card';
import { Camera as CameraIcon, Check, RefreshCw, Sparkles, X, Image as ImageIcon, ZapOff, Zap, RotateCw } from 'lucide-react-native';

export default function OCRScanModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  
  const { addExpense } = useExpenseStore();
  const { settings } = useSettingsStore();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string | undefined>(undefined);
  const [isScanning, setIsScanning] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Animation values
  const shutterScale = useRef(new Animated.Value(1)).current;
  const blinkOpacity = useRef(new Animated.Value(0)).current;

  const triggerShutterPressAnimation = () => {
    Animated.sequence([
      Animated.timing(shutterScale, {
        toValue: 0.82,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shutterScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerShutterBlink = () => {
    blinkOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(blinkOpacity, {
        toValue: 0.85,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(blinkOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Editable preview values
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [tax, setTax] = useState('');

  // Camera Settings
  const [flash, setFlash] = useState<'on' | 'off' | 'fill'>('off');
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  const toggleFlash = () => {
    setFlash((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'fill';
      return 'off';
    });
  };

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const getCameraFlashProp = (mode: 'on' | 'off' | 'fill'): 'on' | 'off' | 'auto' => {
    if (mode === 'fill') return 'off';
    return mode;
  };

  const cameraRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      if (!Device.isDevice) {
        setHasPermission(true);
        setIsCameraReady(true);
        return;
      }
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (err) {
        console.warn('Failed to get camera permission, assuming denied:', err);
        setHasPermission(false);
      }
    })();
  }, []);

  const capturePhoto = async (demoPreset?: string) => {
    // 1. Immediately trigger haptic click feedback for native tactile feel
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Non-fatal if device doesn't support haptics
    }

    // 2. Fire button press shrink-grow animation and screen shutter blink overlay
    triggerShutterPressAnimation();
    triggerShutterBlink();

    // 3. Mark state as capturing immediately to block further clicks
    setIsCapturing(true);

    if (demoPreset) {
      // Simulate brief delay for mock selection
      await new Promise((resolve) => setTimeout(resolve, 300));
      setPhotoUri(`mock_${demoPreset}.jpg`);
      setPresetName(demoPreset);
      setIsCapturing(false);
      return;
    }

    if (!Device.isDevice) {
      // Simulation Mode: pick random preset after a quick delay
      await new Promise((resolve) => setTimeout(resolve, 400));
      const presets = ['starbucks', 'walmart', 'shell', 'amazon', 'vmart'];
      const randomPreset = presets[Math.floor(Math.random() * presets.length)];
      setPhotoUri(`mock_${randomPreset}.jpg`);
      setPresetName(randomPreset);
      setIsCapturing(false);
      return;
    }

    if (cameraRef.current) {
      try {
        // Give camera hardware a slightly smaller stabilized focus delay
        // Having animations and spinner active makes this delay feel smooth rather than frozen.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        setPhotoUri(photo.uri);
        setPresetName(undefined);
      } catch (captureError: any) {
        console.warn('Camera capture failed, prompting gallery/demo fallback:', captureError);
        useAlertStore.getState().showAlert(
          'Camera Capture Failed',
          'Your device camera was unable to capture the image. You can use a demo receipt or pick one from your gallery to test the scanner.',
          'error',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use Demo Receipt', onPress: () => capturePhoto('starbucks') },
            { text: 'Open Gallery', onPress: () => pickFromGallery() }
          ]
        );
      } finally {
        setIsCapturing(false);
      }
    } else {
      useAlertStore.getState().showAlert(
        'Camera Not Ready',
        'The camera component is not initialized yet. Please try again in a moment, or use a demo receipt.',
        'warning',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Demo Receipt', onPress: () => capturePhoto('starbucks') }
        ]
      );
      setIsCapturing(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        useAlertStore.getState().showAlert('Permission Required', 'Gallery access permission is needed to import receipts.', 'warning');
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

      const uri = pickerResult.assets[0].uri;
      setPhotoUri(uri);
      setPresetName(undefined);
    } catch (e: any) {
      console.error(e);
      useAlertStore.getState().showAlert('Gallery Selection Failed', e.message || 'Failed to select image from gallery.', 'error');
    }
  };

  const scanPhoto = async () => {
    if (!photoUri) return;
    try {
      setIsScanning(true);

      // 1. Run OCR
      const result = await ocrService.extractReceipt(photoUri, presetName);
      
      // 2. Run AI Categorization on merchant name and item names
      const itemsText = result.items.map((it) => it.name).join(' ');
      const categoryResult = await aiService.classifyExpense(result.merchant, itemsText);

      setOcrResult(result);
      setMerchant(result.merchant);
      setAmount(result.amount.toString());
      setCategory(categoryResult.category);
      setDate(result.date);
      setTax(result.tax.toString());
      
      setIsScanning(false);
    } catch (e: any) {
      console.error(e);
      useAlertStore.getState().showAlert('OCR Failed', e.message || 'Failed to extract text from image. Please try again.', 'error');
      setIsScanning(false);
      setPhotoUri(null);
      setOcrResult(null);
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
      time: ocrResult?.time || new Date().toTimeString().slice(0, 5),
      paymentMethod: ocrResult?.paymentMethod || 'Credit Card',
      currency: ocrResult?.currency || 'INR',
      tax: tax ? parseFloat(tax) : 0,
      notes: 'Logged via Receipt Scanner OCR',
      receiptImage: photoUri || undefined,
    });

    useAlertStore.getState().showAlert('Success', 'Extracted expense logged successfully!', 'success');
    router.back();
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Requesting Camera Permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <X size={44} color={colors.danger} />
        <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>Camera Access Denied</Text>
        <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
          Please allow camera access in your system preferences to scan invoices and receipts.
        </Text>
      </View>
    );
  }

  if (!photoUri && !isScanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#090D16' }}>
        <Header
          title="SCAN RECEIPT"
          showBackButton={true}
          onBackPress={() => router.back()}
        />
        <View style={[styles.fullScreenContainer, { backgroundColor: '#090D16' }]}>
          {/* Viewfinder Area (Top 68% approximately) */}
          <View style={styles.viewfinderContainer}>
          {Device.isDevice ? (
            <CameraView 
              style={StyleSheet.absoluteFillObject} 
              ref={cameraRef} 
              flash={getCameraFlashProp(flash)}
              enableTorch={flash === 'fill'}
              facing={facing}
              onCameraReady={() => setIsCameraReady(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.simulatedCameraContainer]}>
              <View style={styles.simulatedCameraBackground}>
                <Sparkles size={48} color={colors.primary} style={styles.simulatedCameraIcon} />
                <Text style={[styles.simulatedCameraTitle, { color: '#FFF' }]}>Simulator Camera Active</Text>
                <Text style={[styles.simulatedCameraSubtitle, { color: 'rgba(255,255,255,0.6)' }]}>
                  Simulation Mode • Ready to Capture
                </Text>
              </View>
            </View>
          )}

          {/* Shutter blink overlay for flash feedback */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: '#FFF',
                opacity: blinkOpacity,
                zIndex: 15,
              },
            ]}
            pointerEvents="none"
          />

          {/* Viewfinder Header Overlays */}
          <View style={styles.headerControls}>
            <TouchableOpacity 
              style={[styles.headerControlBtn, { opacity: isCapturing ? 0.4 : 1 }]} 
              activeOpacity={0.7}
              onPress={toggleFlash}
              disabled={isCapturing}
            >
              {flash === 'on' ? (
                <Zap size={20} color="#34D399" />
              ) : flash === 'fill' ? (
                <Zap size={20} color="#FBBF24" />
              ) : (
                <ZapOff size={20} color="#FFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.headerControlBtn, { opacity: isCapturing ? 0.4 : 1 }]} 
              activeOpacity={0.7}
              onPress={toggleFacing}
              disabled={isCapturing}
            >
              <RotateCw size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Viewfinder Target Frame */}
          <View style={styles.frameContainer} pointerEvents="none">
            <Text style={styles.frameLabel}>Receipt Frame</Text>
            <View style={styles.targetFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <Text style={styles.frameInstructionText}>Align Receipt within frame...</Text>
            </View>
          </View>

          {/* Viewfinder Bottom controls (Shutter and Gallery) */}
          <View style={styles.viewfinderBottomRow}>
            {/* Shutter button centered with Scale animation */}
            <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
              <TouchableOpacity 
                style={[
                  styles.shutterBtn, 
                  { 
                    opacity: (isCameraReady && !isCapturing) ? 1 : 0.6,
                    borderColor: isCapturing ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
                  }
                ]} 
                onPress={() => capturePhoto()}
                disabled={!isCameraReady || isCapturing}
                activeOpacity={0.9}
              >
                {isCapturing ? (
                  <View style={[styles.shutterBtnInner, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E2E8F0' }]}>
                    <ActivityIndicator size="small" color="#0F172A" />
                  </View>
                ) : (
                  <View style={styles.shutterBtnInner} />
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Gallery button on the right */}
            <TouchableOpacity 
              style={[styles.galleryIconBtn, { opacity: isCapturing ? 0.4 : 1 }]} 
              onPress={pickFromGallery}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <ImageIcon size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Control Panel */}
        <View style={styles.bottomControlPanel}>
          {/* Capture Modes */}
          <View style={styles.modesToggleRow}>
            <View style={styles.modeSegmentActive}>
              <Text style={styles.modeSegmentTextActive}>Auto-Capture</Text>
            </View>
            <View style={styles.modeSegmentInactive}>
              <Text style={styles.modeSegmentTextInactive}>Manual Capture</Text>
            </View>
          </View>

          {/* AI Intro Feature Card */}
          <View style={styles.aiIntroCard}>
            <View style={styles.aiIntroHeaderRow}>
              <Sparkles size={14} color="#818CF8" style={{ marginRight: 6 }} />
              <Text style={styles.aiIntroSuperTitle}>POWERED BY SMART OCR</Text>
            </View>
            <Text style={styles.aiIntroTitle}>Instant Expense Logging</Text>
            <Text style={styles.aiIntroDesc}>
              Position your receipt inside the frame. The AI scanner automatically extracts details, dates, and matches categories in seconds.
            </Text>
            <View style={styles.highlightPillsRow}>
              <View style={styles.highlightPill}>
                <Text style={styles.highlightPillText}>🧾 Real-time OCR</Text>
              </View>
              <View style={styles.highlightPill}>
                <Text style={styles.highlightPillText}>🤖 AI Match</Text>
              </View>
              <View style={styles.highlightPill}>
                <Text style={styles.highlightPillText}>⚡ Instant Log</Text>
              </View>
            </View>
          </View>

          {/* Glowing AI Tab */}
          <View style={styles.aiGlowTab}>
            <Sparkles size={13} color="#818CF8" style={{ marginRight: 4 }} />
            <Text style={styles.aiGlowTabText}>AI</Text>
          </View>
        </View>
      </View>
    </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="SCAN RECEIPT"
        showBackButton={true}
        onBackPress={() => router.back()}
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
      {!photoUri && !isScanning ? (
        <View style={styles.cameraBox}>
          {Device.isDevice ? (
            <CameraView 
              style={styles.camera} 
              ref={cameraRef} 
              onCameraReady={() => setIsCameraReady(true)}
            />
          ) : (
            <View style={[styles.camera, styles.simulatedCameraContainer]}>
              <View style={styles.simulatedCameraBackground}>
                <Sparkles size={48} color={colors.primary} style={styles.simulatedCameraIcon} />
                <Text style={[styles.simulatedCameraTitle, { color: '#FFF' }]}>Simulator Camera Active</Text>
                <Text style={[styles.simulatedCameraSubtitle, { color: 'rgba(255,255,255,0.6)' }]}>
                  Simulation Mode • Ready to Capture
                </Text>
              </View>
            </View>
          )}
          <View style={styles.overlayGrid} pointerEvents="none">
            <View style={styles.scannerLine} />
            <Text style={styles.scanTargetText}>
              {!Device.isDevice 
                ? 'Simulation Mode: Tap capture to scan random receipt' 
                : 'Position Receipt inside framing box'}
            </Text>
          </View>

          {/* Trigger capture */}
          <TouchableOpacity 
            style={[styles.captureBtn, { backgroundColor: isCameraReady ? colors.primary : '#475569' }]} 
            onPress={() => capturePhoto()}
            disabled={!isCameraReady}
          >
            <CameraIcon size={24} color="#FFF" />
          </TouchableOpacity>

          {/* Gallery Pick */}
          <TouchableOpacity 
            style={[styles.galleryBtn, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]} 
            onPress={pickFromGallery}
          >
            <ImageIcon size={20} color="#FFF" />
          </TouchableOpacity>

          {/* Demos selector */}
          <View style={styles.demoBlock}>
            <Text style={[styles.demoTitle, { color: '#FFF' }]}>TEST OCR DEMOS (Non-Camera Mock)</Text>
            <View style={styles.demoGrid}>
              {['starbucks', 'walmart', 'shell', 'amazon', 'vmart'].map((demo) => (
                <TouchableOpacity
                  key={demo}
                  style={styles.demoPill}
                  onPress={() => capturePhoto(demo)}
                >
                  <Text style={styles.demoText}>{demo.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : isScanning ? (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.scanningText, { color: colors.text }]}>Scanning receipt with OCR Engine...</Text>
          <Text style={[styles.scanningSub, { color: colors.textSecondary }]}>Running AI category matching...</Text>
        </View>
      ) : !ocrResult ? (
        <View style={styles.previewContainer}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>Confirm Captured Receipt</Text>
          <Text style={[styles.previewSubtitle, { color: colors.textSecondary }]}>
            Review the captured receipt image before scanning it with the AI OCR engine.
          </Text>
          
          <View style={[styles.imageWrapper, { borderColor: colors.border }]}>
            {presetName ? (
              <Image 
                source={
                  presetName === 'starbucks' ? require('../../../assets/images/starbucks_receipt.png') :
                  presetName === 'vmart' ? require('../../../assets/images/walmart_receipt.png') :
                  presetName === 'walmart' ? require('../../../assets/images/walmart_receipt.png') :
                  presetName === 'amazon' ? require('../../../assets/images/walmart_receipt.png') :
                  require('../../../assets/images/starbucks_receipt.png')
                }
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <Image 
                source={{ uri: photoUri || undefined }} 
                style={styles.previewImage} 
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.previewActionBtnRow}>
            <TouchableOpacity
              style={[styles.retakeBtn, { borderColor: colors.border }]}
              onPress={() => {
                setPhotoUri(null);
                setPresetName(undefined);
              }}
            >
              <RefreshCw size={16} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.retakeBtnText, { color: colors.text }]}>Retake / Reselect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={scanPhoto}
            >
              <Sparkles size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>Scan & Extract</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        ocrResult && (
          <View style={styles.resultsPanel}>
            <Text style={[styles.previewHeading, { color: colors.text }]}>Review Extracted Details</Text>
            <Text style={[styles.previewSubText, { color: colors.textSecondary }]}>
              Double check and adjust values computed by OCR and AI engines below.
            </Text>

            {/* Merchant details */}
            <Card style={styles.previewCard}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>MERCHANT</Text>
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

            {/* List of items */}
            {ocrResult.items.length > 0 && (
              <Card style={styles.itemsCard}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EXTRACTED ITEMS</Text>
                {ocrResult.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                      {item.quantity}x {item.name}
                    </Text>
                    <Text style={[styles.itemPrice, { color: colors.text }]}>
                      {expenseHelpers.getCurrencySymbol(ocrResult?.currency || settings.currency)}
                      {(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Confidence Score info */}
            <View style={styles.confidenceRow}>
              <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
                OCR confidence score: {(ocrResult.confidence * 100).toFixed(0)}%
              </Text>
            </View>

            {/* Action Row */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.retakeBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setPhotoUri(null);
                  setOcrResult(null);
                }}
              >
                <RefreshCw size={16} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={[styles.retakeBtnText, { color: colors.text }]}>Retake / Rescan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveExtracted}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
  cameraBox: {
    height: 480,
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlayGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 24,
    borderColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  scanTargetText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  captureBtn: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  galleryBtn: {
    position: 'absolute',
    bottom: 95,
    right: 40,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 4,
  },
  demoBlock: {
    backgroundColor: '#1E293B',
    padding: 12,
  },
  demoTitle: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  demoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  demoPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  demoText: {
    color: '#FFF',
    fontSize: 10,
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
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
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
  itemsCard: {
    padding: 16,
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.02)',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
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
  simulatedCameraContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  simulatedCameraBackground: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  simulatedCameraIcon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  simulatedCameraTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  simulatedCameraSubtitle: {
    fontSize: 13,
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
    height: 380,
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
  fullScreenContainer: {
    flex: 1,
  },
  viewfinderContainer: {
    height: '68%',
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'visible',
  },
  headerControls: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameContainer: {
    position: 'absolute',
    top: '15%',
    left: 40,
    right: 40,
    bottom: '20%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  frameLabel: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  targetFrame: {
    width: '100%',
    height: '85%',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#34D399',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 8,
  },
  frameInstructionText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewfinderBottomRow: {
    position: 'absolute',
    bottom: -36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },
  galleryIconBtn: {
    position: 'absolute',
    right: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bottomControlPanel: {
    height: '32%',
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 48,
    alignItems: 'center',
  },
  modesToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 3,
    width: '80%',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1E293D',
  },
  modeSegmentActive: {
    flex: 1,
    height: 32,
    backgroundColor: '#1E293B',
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSegmentTextActive: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modeSegmentInactive: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSegmentTextInactive: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  aiIntroCard: {
    width: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  aiIntroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiIntroSuperTitle: {
    color: '#818CF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.75,
  },
  aiIntroTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  aiIntroDesc: {
    color: '#94A3B8',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  highlightPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  highlightPill: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  highlightPillText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  aiGlowTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172554',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 14,
    shadowColor: '#818CF8',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  aiGlowTabText: {
    color: '#818CF8',
    fontSize: 9,
    fontWeight: '800',
  },
});
