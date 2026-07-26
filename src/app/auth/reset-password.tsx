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
import { Card } from '../../components/Card';
import { authService } from '../../services/auth.service';
import { Key, Eye, EyeOff, Check, AlertCircle, LockOpen } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  // Input states
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Interactive focus states
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmNewPasswordFocused, setConfirmNewPasswordFocused] = useState(false);

  // Visibility states
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Password matching validation
  const doPasswordsMatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const doPasswordsMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await authService.updatePassword(newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Success',
        'Your password has been successfully updated.',
        [{ text: 'OK', onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.replace('/(tabs)');
        } }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Update Failed', error.message || 'Failed to update your password. Please try again.');
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

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 50 }]} 
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
            Set a secure new password for your account
          </Text>
        </View>

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
});
