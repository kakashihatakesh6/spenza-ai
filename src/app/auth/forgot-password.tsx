import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { Card } from '../../components/Card';
import { authService } from '../../services/auth.service';
import { Mail, Send, ChevronLeft, Check, AlertCircle, Key, Eye, EyeOff, LockOpen } from 'lucide-react-native';

type ResetStep = 'request' | 'verify' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  
  // Step control
  const [step, setStep] = useState<ResetStep>('request');

  // Input states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Interactive focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmNewPasswordFocused, setConfirmNewPasswordFocused] = useState(false);

  // Visibility states
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Email format validation
  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text.trim());
  };
  const isEmailValid = email.length > 0 && validateEmail(email);

  // Password matching validation
  const doPasswordsMatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const doPasswordsMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  // Step 1: Request reset link/OTP
  const handleRequestOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Please enter your email address.', 'warning');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Please enter a valid email address.', 'warning');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await authService.sendPasswordResetEmail(trimmedEmail);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('verify');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      useAlertStore.getState().showAlert('Request Failed', error.message || 'An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Please enter the 6-digit verification code.', 'warning');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await authService.verifyResetOtp(email.trim(), trimmedOtp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('reset');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      useAlertStore.getState().showAlert('Verification Failed', error.message || 'The OTP entered is incorrect or expired.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Password must be at least 6 characters long.', 'warning');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Passwords do not match.', 'warning');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await authService.updatePassword(newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      useAlertStore.getState().showAlert(
        'Success',
        'Your password has been successfully updated.',
        'success',
        [{ text: 'OK', onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.replace('/(tabs)');
        } }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      useAlertStore.getState().showAlert('Update Failed', error.message || 'Failed to update your password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Decorative Glow Circles */}
      <View style={[styles.glowCircle, { top: -50, right: -80, backgroundColor: colors.primary, opacity: isDark ? 0.15 : 0.08 }]} />
      <View style={[styles.glowCircle, { bottom: -100, left: -80, backgroundColor: colors.accent, opacity: isDark ? 0.15 : 0.08 }]} />

      {/* Floating Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (step === 'verify') {
              setStep('request');
            } else if (step === 'reset') {
              setStep('verify');
            } else {
              router.back();
            }
          }}
        >
          <View style={[styles.backIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
            <ChevronLeft size={20} color={colors.text} />
          </View>
          <Text style={[styles.backText, { color: colors.text }]}>
            {step === 'request' ? 'Back to Login' : 'Previous Step'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>SPENDLY</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {step === 'request' && 'Enter your email to receive a password reset code'}
            {step === 'verify' && `Enter the verification code sent to ${email}`}
            {step === 'reset' && 'Set a secure new password for your account'}
          </Text>
        </View>

        {/* STEP 1: Enter email */}
        {step === 'request' && (
          <Card style={styles.formCard} glassmorphism={true}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
            <View style={[
              styles.inputRow, 
              { 
                borderColor: emailFocused 
                  ? (isEmailValid ? colors.success : colors.primary) 
                  : (email.length > 0 && !validateEmail(email) ? colors.danger : colors.border),
                backgroundColor: emailFocused ? (isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.02)') : 'transparent',
                borderWidth: emailFocused ? 1.5 : 1
              }
            ]}>
              <Mail size={18} color={emailFocused ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="name@example.com"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              {isEmailValid && (
                <Check size={18} color={colors.success} style={{ marginLeft: 6 }} />
              )}
              {email.length > 0 && !validateEmail(email) && !emailFocused && (
                <AlertCircle size={18} color={colors.danger} style={{ marginLeft: 6 }} />
              )}
            </View>

            <TouchableOpacity
              style={[styles.resetBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
              onPress={handleRequestOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.resetBtnText}>Send Reset Code</Text>
                  <Send size={16} color="#FFF" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          </Card>
        )}

        {/* STEP 2: Verify OTP */}
        {step === 'verify' && (
          <Card style={styles.formCard} glassmorphism={true}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>6-DIGIT VERIFICATION CODE</Text>
            <View style={[
              styles.inputRow, 
              { 
                borderColor: otpFocused ? colors.primary : colors.border,
                backgroundColor: otpFocused ? (isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.02)') : 'transparent',
                borderWidth: otpFocused ? 1.5 : 1
              }
            ]}>
              <Key size={18} color={otpFocused ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, letterSpacing: 6, fontWeight: '700' }]}
                placeholder="••••••"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                onFocus={() => setOtpFocused(true)}
                onBlur={() => setOtpFocused(false)}
              />
            </View>

            <TouchableOpacity
              style={[styles.resetBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.resetBtnText}>Verify Code</Text>
                  <Check size={16} color="#FFF" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={{ color: colors.textSecondary }}>{"Didn't receive the code? "}</Text>
              <TouchableOpacity onPress={handleRequestOtp}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Resend Code</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* STEP 3: Reset password */}
        {step === 'reset' && (
          <Card style={styles.formCard} glassmorphism={true}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NEW PASSWORD</Text>
            <View style={[
              styles.inputRow, 
              { 
                borderColor: newPasswordFocused ? colors.primary : colors.border,
                backgroundColor: newPasswordFocused ? (isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.02)') : 'transparent',
                borderWidth: newPasswordFocused ? 1.5 : 1
              }
            ]}>
              <Key size={18} color={newPasswordFocused ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                value={newPassword}
                onChangeText={setNewPassword}
                onFocus={() => setNewPasswordFocused(true)}
                onBlur={() => setNewPasswordFocused(false)}
              />
              <TouchableOpacity 
                onPress={() => {
                  setShowNewPassword(!showNewPassword);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={styles.eyeIcon}
              >
                {showNewPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>CONFIRM NEW PASSWORD</Text>
            <View style={[
              styles.inputRow, 
              { 
                borderColor: confirmNewPasswordFocused 
                  ? (doPasswordsMatch ? colors.success : colors.primary) 
                  : (doPasswordsMismatch ? colors.danger : colors.border),
                backgroundColor: confirmNewPasswordFocused ? (isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.02)') : 'transparent',
                borderWidth: confirmNewPasswordFocused ? 1.5 : 1
              }
            ]}>
              <Key size={18} color={confirmNewPasswordFocused ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showConfirmNewPassword}
                autoCapitalize="none"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                onFocus={() => setConfirmNewPasswordFocused(true)}
                onBlur={() => setConfirmNewPasswordFocused(false)}
              />
              {doPasswordsMatch && (
                <Check size={18} color={colors.success} style={{ marginRight: 6 }} />
              )}
              {doPasswordsMismatch && !confirmNewPasswordFocused && (
                <AlertCircle size={18} color={colors.danger} style={{ marginRight: 6 }} />
              )}
              <TouchableOpacity 
                onPress={() => {
                  setShowConfirmNewPassword(!showConfirmNewPassword);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={styles.eyeIcon}
              >
                {showConfirmNewPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.resetBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.resetBtnText}>Update Password</Text>
                  <LockOpen size={16} color="#FFF" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  formCard: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  eyeIcon: {
    padding: 8,
  },
  resetBtn: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resetBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});
