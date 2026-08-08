import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { Header } from '../../components/Header';
import { logger } from '../../services/logger';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Lock,
  Zap,
} from 'lucide-react-native';

export default function SubscriptionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const isPro = !!user?.user_metadata?.is_pro;

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async () => {
    if (!isPro) {
      if (!cardNumber || !expiry || !cvv || !cardName) {
        useAlertStore.getState().showAlert('Validation Error', 'Please fill out all payment fields to proceed.', 'warning');
        return;
      }
    }

    try {
      setIsProcessing(true);
      
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Update store state with is_pro metadata
      const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
      const avatarUrl = user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url || '';
      
      // If already Pro, this toggles it back to Free (cancelling plan)
      await updateProfile(username, avatarUrl, { is_pro: !isPro });
      
      setIsProcessing(false);
      
      useAlertStore.getState().showAlert(
        isPro ? 'Subscription Cancelled' : 'Upgrade Complete!',
        isPro 
          ? 'Your Pro membership has been cancelled. You will retain access until the end of your billing cycle.'
          : 'Welcome to Spendly Pro Suite! Enjoy unlimited OCR scans and predictive accounting.',
        'success',
        [{ text: 'Great', onPress: () => router.back() }]
      );
    } catch (err) {
      setIsProcessing(false);
      logger.error('Failed to process transaction', err);
      useAlertStore.getState().showAlert('Error', 'Failed to process transaction. Please try again.', 'error');
    }
  };

  const planCost = billingCycle === 'yearly' ? '$6.99' : '$9.99';
  const planPeriod = billingCycle === 'yearly' ? 'billed yearly ($83.88)' : 'billed monthly';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Custom Header */}
      <Header
        title="MEMBERSHIP PLAN"
        showBackButton={true}
        onBackPress={() => router.back()}
        hideRightAction={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Intro Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIconBg, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2F6' }]}>
            <Zap size={32} color={colors.primary} fill={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {isPro ? 'You are a Pro Subscriber!' : 'Unlock Spendly Pro Suite'}
          </Text>
          <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
            {isPro 
              ? 'Enjoy unrestricted access to Gemini AI-powered ledger management and advanced analytics tools.' 
              : 'Automate your tracking with state-of-the-art OCR scan parsing and premium budget parameters.'}
          </Text>
        </View>

        {/* Current Plan Indicator */}
        <View style={[styles.statusBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Current Membership Status</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusVal, { color: colors.text }]}>
              {isPro ? 'PRO MEMBER' : 'FREE BASIC ACCOUNT'}
            </Text>
            <View style={[styles.badge, { backgroundColor: isPro ? 'rgba(16, 185, 129, 0.15)' : '#EEF2F6' }]}>
              <Text style={[styles.badgeText, { color: isPro ? colors.success : colors.textSecondary }]}>
                {isPro ? 'ACTIVE' : 'DEFAULT'}
              </Text>
            </View>
          </View>
        </View>

        {!isPro && (
          <>
            {/* Toggle Billing Cycle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleTab,
                  billingCycle === 'monthly' && [styles.activeToggleTab, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text style={[styles.toggleText, { color: billingCycle === 'monthly' ? colors.text : colors.textSecondary }]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.toggleTab,
                  billingCycle === 'yearly' && [styles.activeToggleTab, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
                onPress={() => setBillingCycle('yearly')}
              >
                <Text style={[styles.toggleText, { color: billingCycle === 'yearly' ? colors.text : colors.textSecondary }]}>
                  Yearly
                </Text>
                <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.discountText}>30% OFF</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Premium Card Overview */}
            <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={styles.pricingHeader}>
                <View>
                  <Text style={[styles.planTitle, { color: colors.text }]}>Pro Suite</Text>
                  <Text style={[styles.planPeriodText, { color: colors.textSecondary }]}>{planPeriod}</Text>
                </View>
                <View style={styles.pricingValWrapper}>
                  <Text style={[styles.planCostText, { color: colors.text }]}>{planCost}</Text>
                  <Text style={[styles.planMonthLabel, { color: colors.textSecondary }]}>/mo</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Benefits Checklist */}
              <View style={styles.checklist}>
                <View style={styles.checkRow}>
                  <CheckCircle size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.checkText, { color: colors.text }]}>Unlimited AI Receipt Scans (Gemini OCR)</Text>
                </View>
                <View style={styles.checkRow}>
                  <CheckCircle size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.checkText, { color: colors.text }]}>UPI Payments Auto-Categorization</Text>
                </View>
                <View style={styles.checkRow}>
                  <CheckCircle size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.checkText, { color: colors.text }]}>Advanced Analytics & Spending Predictions</Text>
                </View>
                <View style={styles.checkRow}>
                  <CheckCircle size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.checkText, { color: colors.text }]}>Export Reports to clean PDF and CSV sheets</Text>
                </View>
              </View>
            </View>

            {/* Payment Section */}
            <View style={styles.paymentSection}>
              <Text style={[styles.paymentHeader, { color: colors.textSecondary }]}>Simulated Secure Payment</Text>
              
              <View style={styles.form}>
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <CreditCard size={16} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    keyboardType="numeric"
                    placeholder="Card Number (4000 1234 5678 9010)"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputContainer, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      value={expiry}
                      onChangeText={setExpiry}
                      placeholder="MM/YY"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, { color: colors.text }]}
                    />
                  </View>
                  <View style={[styles.inputContainer, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      value={cvv}
                      onChangeText={setCvv}
                      keyboardType="numeric"
                      secureTextEntry
                      placeholder="CVV"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, { color: colors.text }]}
                    />
                  </View>
                </View>

                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="Cardholder Name"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>

              <View style={styles.secureBadge}>
                <Lock size={12} color={colors.textSecondary} />
                <Text style={[styles.secureText, { color: colors.textSecondary }]}>
                  Payments are simulated. Do not enter real credit card details.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isPro ? colors.danger : colors.primary },
          ]}
          onPress={handleUpgrade}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              {isPro ? (
                <Text style={styles.actionBtnText}>Cancel Subscription</Text>
              ) : (
                <>
                  <Sparkles size={16} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Upgrade Plan Now</Text>
                </>
              )}
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginTop: Platform.OS === 'ios' ? 44 : 0,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  heroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  statusBox: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeToggleTab: {
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  discountText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
  pricingCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 20,
    marginBottom: 24,
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  planPeriodText: {
    fontSize: 11,
    marginTop: 2,
  },
  pricingValWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planCostText: {
    fontSize: 26,
    fontWeight: '900',
  },
  planMonthLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  checklist: {
    gap: 12,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  checkText: {
    fontSize: 12.5,
    lineHeight: 16,
    flex: 1,
    fontWeight: '600',
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentHeader: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  form: {
    gap: 12,
  },
  inputContainer: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  secureText: {
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
  actionBtn: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
