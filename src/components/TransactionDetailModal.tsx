import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Expense } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useSettingsStore } from '../store/settingsStore';
import { expenseHelpers } from '../utils/expenseHelpers';
import {
  X,
  Calendar,
  Clock,
  CreditCard,
  Tag,
  FileText,
  Edit2,
  Image as ImageIcon,
} from 'lucide-react-native';
import { logger } from '../services/logger';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface TransactionDetailModalProps {
  transaction: Expense | null;
  onClose: () => void;
}

const getReceiptImageSource = (imagePath: string) => {
  const path = imagePath.toLowerCase();
  if (path.includes('starbucks')) {
    return require('../../assets/images/starbucks_receipt.png');
  }
  if (path.includes('walmart') || path.includes('vmart') || path.includes('mart')) {
    return require('../../assets/images/walmart_receipt.png');
  }
  if (
    path.includes('gpay') ||
    path.includes('phonepe') ||
    path.includes('paytm') ||
    path.includes('screenshot') ||
    path.includes('upi')
  ) {
    return require('../../assets/images/gpay_screenshot.png');
  }
  return { uri: imagePath };
};

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
}) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { settings } = useSettingsStore();
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.8, savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translationX.value = savedTranslationX.value + e.translationX;
        translationY.value = savedTranslationY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value > 1) {
        savedTranslationX.value = translationX.value;
        savedTranslationY.value = translationY.value;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  useEffect(() => {
    if (!isImageViewerOpen) {
      scale.value = 1;
      savedScale.value = 1;
      translationX.value = 0;
      translationY.value = 0;
      savedTranslationX.value = 0;
      savedTranslationY.value = 0;
    }
  }, [isImageViewerOpen]);

  useEffect(() => {
    if (transaction) {
      logger.info('Expense details opened', { transactionId: transaction.id });
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleEdit = () => {
    onClose();
    router.push({
      pathname: '/modal/add-expense',
      params: { id: transaction.id },
    });
  };

  const hasImage = !!transaction.receiptImage;
  const imageSource = hasImage ? getReceiptImageSource(transaction.receiptImage!) : null;

  return (
    <Modal
      visible={!!transaction}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              shadowColor: isDark ? '#000' : 'rgba(99, 102, 241, 0.15)',
            },
          ]}
        >
          {/* Top Grab Indicator */}
          <View style={[styles.grabIndicator, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              Transaction Details
            </Text>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
              onPress={onClose}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Amount & Merchant Hero Section */}
            <View style={styles.heroSection}>
              <Text style={[styles.amountText, { color: colors.text }]}>
                {expenseHelpers.getCurrencySymbol(transaction.currency || settings.currency)}
                {Number(transaction.amount).toFixed(2)}
              </Text>
              <Text style={[styles.merchantText, { color: colors.text }]} numberOfLines={2}>
                {transaction.merchant}
              </Text>
            </View>

            {/* Info Grid */}
            <View style={[styles.infoGrid, { borderColor: colors.border }]}>
              {/* Category */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Tag size={16} color={colors.primary} />
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Category</Text>
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.categoryText, { color: colors.primary }]}>
                    {transaction.category}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Date */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Calendar size={16} color={colors.primary} />
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date</Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>{transaction.date}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Time */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Clock size={16} color={colors.primary} />
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time</Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>{transaction.time}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Payment Method */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <CreditCard size={16} color={colors.primary} />
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {transaction.paymentMethod}
                </Text>
              </View>
            </View>

            {/* Notes Section */}
            {transaction.notes ? (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <FileText size={16} color={colors.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notes</Text>
                </View>
                <Text style={[styles.notesText, { color: colors.text, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                  {transaction.notes}
                </Text>
              </View>
            ) : null}

            {/* Receipt Image Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <ImageIcon size={16} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Receipt Attachment
                </Text>
              </View>

              {hasImage ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.imageWrapper, { borderColor: colors.border }]}
                  onPress={() => setIsImageViewerOpen(true)}
                >
                  <Image
                    source={imageSource!}
                    style={styles.receiptImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.noImagePlaceholder,
                    {
                      borderColor: colors.border,
                      backgroundColor: isDark ? '#151d30' : '#f8fafc',
                    },
                  ]}
                >
                  <Text style={[styles.noImageText, { color: colors.textSecondary }]}>
                    No receipt image attached to this transaction.
                  </Text>
                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: colors.primaryLight }]}
                    onPress={handleEdit}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                      Attach Receipt
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Action Area */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={handleEdit}
              activeOpacity={0.8}
            >
              <Edit2 size={16} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.editBtnText}>Edit Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Fullscreen Image Viewer Modal */}
      {hasImage && (
        <Modal
          visible={isImageViewerOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsImageViewerOpen(false)}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.viewerOverlay}>
              <Pressable style={styles.viewerBackdrop} onPress={() => setIsImageViewerOpen(false)} />
              
              {/* Top Header */}
              <View style={styles.viewerHeader}>
                <View style={styles.viewerTitleContainer}>
                  <Text style={styles.viewerTitle} numberOfLines={1}>
                    {transaction.merchant}
                  </Text>
                  <Text style={styles.viewerSubtitle}>
                    {transaction.date} • {expenseHelpers.getCurrencySymbol(transaction.currency || settings.currency)}
                    {Number(transaction.amount).toFixed(2)}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.viewerCloseBtn}
                  onPress={() => setIsImageViewerOpen(false)}
                >
                  <X size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Zoomable Image Container */}
              <View style={styles.viewerImageContainer}>
                <GestureDetector gesture={composedGesture}>
                  <Animated.Image
                    source={imageSource!}
                    style={[styles.viewerImage, animatedStyle]}
                    resizeMode="contain"
                  />
                </GestureDetector>
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 10,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  scrollView: {
    flexShrink: 1,
  },
  grabIndicator: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  merchantText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
  },
  infoGrid: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  sectionContainer: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
    padding: 12,
    borderRadius: 12,
    fontStyle: 'italic',
  },
  imageWrapper: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  attachBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  editBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  editBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.98)',
    justifyContent: 'center',
  },
  viewerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
    zIndex: 10,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewerTitleContainer: {
    flex: 1,
    marginRight: 15,
  },
  viewerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  viewerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  viewerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  viewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 180,
  },
});
