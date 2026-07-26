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
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { Card } from '../../components/Card';
import { authService } from '../../services/auth.service';
import { Mail, Lock, UserPlus, Eye, EyeOff, Check, AlertCircle } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Focus and visibility states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email format validation
  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text.trim());
  };
  const isEmailValid = email.length > 0 && validateEmail(email);

  // Password matching validation
  const doPasswordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const doPasswordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Please fill in all credentials.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Passwords do not match.', 'warning');
      return;
    }

    if (password.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      useAlertStore.getState().showAlert('Validation Error', 'Password must be at least 6 characters long.', 'warning');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await authService.signUp(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      useAlertStore.getState().showAlert(
        'Registration Successful',
        'Please check your email to confirm your account, then log in.',
        'success',
        [{ text: 'OK', onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/auth/login');
        } }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      useAlertStore.getState().showAlert('Sign Up Failed', error.message || 'An error occurred during registration.', 'error');
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
            Sign up to securely sync your expenses in the cloud
          </Text>
        </View>

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

          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>PASSWORD</Text>
          <View style={[
            styles.inputRow, 
            { 
              borderColor: passwordFocused ? colors.primary : colors.border,
              backgroundColor: passwordFocused ? (isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.02)') : 'transparent',
              borderWidth: passwordFocused ? 1.5 : 1
            }
          ]}>
            <Lock size={18} color={passwordFocused ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity 
              onPress={() => {
                setShowPassword(!showPassword);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={styles.eyeIcon}
            >
              {showPassword ? (
                <EyeOff size={18} color={colors.textSecondary} />
              ) : (
                <Eye size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>CONFIRM PASSWORD</Text>
          <View style={[
            styles.inputRow, 
            { 
              borderColor: confirmPasswordFocused 
                ? (doPasswordsMatch ? colors.success : colors.primary) 
                : (doPasswordsMismatch ? colors.danger : colors.border),
              backgroundColor: confirmPasswordFocused ? (isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.02)') : 'transparent',
              borderWidth: confirmPasswordFocused ? 1.5 : 1
            }
          ]}>
            <Lock size={18} color={confirmPasswordFocused ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setConfirmPasswordFocused(true)}
              onBlur={() => setConfirmPasswordFocused(false)}
            />
            {doPasswordsMatch && (
              <Check size={18} color={colors.success} style={{ marginRight: 6 }} />
            )}
            {doPasswordsMismatch && !confirmPasswordFocused && (
              <AlertCircle size={18} color={colors.danger} style={{ marginRight: 6 }} />
            )}
            <TouchableOpacity 
              onPress={() => {
                setShowConfirmPassword(!showConfirmPassword);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={styles.eyeIcon}
            >
              {showConfirmPassword ? (
                <EyeOff size={18} color={colors.textSecondary} />
              ) : (
                <Eye size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.registerBtnText}>Sign Up</Text>
                <UserPlus size={18} color="#FFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </Card>

        {/* Back to Login Link */}
        <View style={styles.footerRow}>
          <Text style={{ color: colors.textSecondary }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push('/auth/login');
          }}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Log In</Text>
          </TouchableOpacity>
        </View>
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
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 40,
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
  registerBtn: {
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
  registerBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerLink: {
    fontWeight: '700',
  },
});
