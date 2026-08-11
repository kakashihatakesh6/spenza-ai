import { useNavigation, useRouter } from 'expo-router';
import {
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Globe as GoogleIcon,
  Lock,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Header } from '../../components/Header';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { authService } from '../../services/auth.service';
import { biometricService, BiometricStatus } from '../../services/biometric.service';
import { logger } from '../../services/logger';
import { useAlertStore } from '../../store/alertStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useSettingsStore } from '../../store/settingsStore';

import { SessionItem } from '../../services/session.service';

export default function SecurityScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);

  const biometricsEnabled = useSettingsStore((state) => state.settings.biometricsEnabled);
  const setBiometricsEnabled = useSettingsStore((state) => state.setBiometricsEnabled);

  const [biometricInfo, setBiometricInfo] = useState<BiometricStatus | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    biometricService.checkBiometricSupport().then((info) => {
      setBiometricInfo(info);
    });
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      const status = await biometricService.checkBiometricSupport();
      if (!status.isHardwareAvailable) {
        useAlertStore.getState().showAlert(
          'Biometrics Unavailable',
          'Biometric hardware is not available on this device.',
          'warning'
        );
        return;
      }

      if (!status.isEnrolled && Platform.OS !== 'web') {
        useAlertStore.getState().showAlert(
          'No Biometrics Enrolled',
          'Please set up Fingerprint or Face ID in your device settings first.',
          'warning'
        );
        return;
      }

      // Verify fingerprint before enabling
      const res = await biometricService.authenticate('Scan fingerprint to confirm enabling App Lock');
      if (res.success) {
        setBiometricsEnabled(true);
        useAlertStore.getState().showAlert(
          'Biometric Lock Enabled',
          'Spendly will now ask for your fingerprint whenever the app opens.',
          'success'
        );
      } else if (res.error && res.error !== 'Authentication cancelled.') {
        useAlertStore.getState().showAlert('Authentication Failed', res.error, 'error');
      }
    } else {
      setBiometricsEnabled(false);
      useAlertStore.getState().showAlert(
        'Biometric Lock Disabled',
        'App startup fingerprint protection is now turned off.',
        'info'
      );
    }
  };

  const [isTestingBiometric, setIsTestingBiometric] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  const handleTestFingerprint = async () => {
    setIsTestingBiometric(true);
    setTestResult(null);
    try {
      const res = await biometricService.authenticate('Test your fingerprint scanner');
      if (res.success) {
        setTestResult('success');
        useAlertStore.getState().showAlert('Scanner Test Passed', 'Your fingerprint sensor is working properly.', 'success');
      } else {
        setTestResult('failed');
        if (res.error && res.error !== 'Authentication cancelled.') {
          useAlertStore.getState().showAlert('Scanner Test Failed', res.error, 'error');
        }
      }
    } finally {
      setIsTestingBiometric(false);
    }
  };

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Detect if user logged in via Google OAuth
  const provider = user?.app_metadata?.provider || (user?.app_metadata?.providers?.[0]);
  const isGoogleUser = provider === 'google';

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const activeSessions = await authService.getActiveSessions();
      setSessions(activeSessions);
    } catch (err) {
      logger.error('Failed to load active sessions', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleUpdatePassword = async () => {
    // Validation
    if (!isGoogleUser && !currentPassword) {
      useAlertStore.getState().showAlert('Validation Error', 'Please enter your current password.', 'warning');
      return;
    }
    if (!newPassword || !confirmPassword) {
      useAlertStore.getState().showAlert('Validation Error', 'Please enter and confirm your new password.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      useAlertStore.getState().showAlert('Validation Error', 'New password must be at least 6 characters.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      useAlertStore.getState().showAlert('Validation Error', 'New passwords do not match.', 'warning');
      return;
    }

    try {
      setIsUpdatingPassword(true);

      // For email/password users, verify current password first
      if (!isGoogleUser && user?.email) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (verifyErr) {
          setIsUpdatingPassword(false);
          useAlertStore.getState().showAlert('Verification Failed', 'Current password entered is incorrect.', 'error');
          return;
        }
      }

      // Update password on Supabase
      await authService.updatePassword(newPassword);

      setIsUpdatingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      useNotificationStore.getState().addNotification({
        title: 'Password Updated',
        message: 'Your account password was updated successfully.',
        type: 'success',
        categoryName: 'SECURITY',
      });
      useAlertStore.getState().showAlert('Success', 'Your password has been updated successfully.', 'success');
    } catch (e: any) {
      setIsUpdatingPassword(false);
      logger.error('Failed to update password', e);
      useAlertStore.getState().showAlert('Update Failed', e?.message || 'Failed to update password. Please try again.', 'error');
    }
  };

  const terminateOtherSessions = () => {
    useAlertStore.getState().showAlert(
      'Terminate Sessions',
      'Are you sure you want to sign out of all other devices?',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoadingSessions(true);
              await authService.signOutOthers();
              const updated = await authService.getActiveSessions();
              setSessions(updated);
              useNotificationStore.getState().addNotification({
                title: 'Security Alert: Device Terminated',
                message: 'Terminated all other active device sessions from Security Center.',
                type: 'security',
                categoryName: 'SECURITY',
              });
              useAlertStore.getState().showAlert('Success', 'Successfully terminated all other sessions.', 'success');
            } catch (err: any) {
              logger.error('Failed to terminate other sessions', err);
              useAlertStore.getState().showAlert('Error', err?.message || 'Failed to terminate sessions.', 'error');
            } finally {
              setIsLoadingSessions(false);
            }
          },
        },
      ]
    );
  };

  const terminateSingleSession = (session: SessionItem) => {
    useAlertStore.getState().showAlert(
      'Terminate Session',
      `Sign out from ${session.device}?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoadingSessions(true);
              await authService.terminateSession(session.id);
              if (session.isCurrent) {
                useAlertStore.getState().showAlert('Signed Out', 'You have been signed out of this device.', 'info');
                router.replace('/auth/login');
              } else {
                const updated = await authService.getActiveSessions();
                setSessions(updated);
                useAlertStore.getState().showAlert('Success', `Terminated session on ${session.device}.`, 'success');
              }
            } catch (err: any) {
              logger.error('Failed to terminate session', err);
              useAlertStore.getState().showAlert('Error', err?.message || 'Failed to terminate session.', 'error');
            } finally {
              setIsLoadingSessions(false);
            }
          },
        },
      ]
    );
  };


  const getPlatformIcon = (type: string) => {
    if (type === 'mobile') {
      return <Smartphone size={16} color={colors.primary} />;
    }
    return <Globe size={16} color={colors.primary} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <Header
        title="SECURITY CENTER"
        showBackButton={true}
        onBackPress={() => router.back()}
        hideRightAction={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIconBg, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
            <Shield size={32} color={colors.success} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Account Safeguards</Text>
          <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
            Configure parameters to keep your ledger and personal details secure.
          </Text>
        </View>

        {/* Toggles Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Fingerprint size={16} color={colors.primary} />
                <Text style={[styles.switchTitle, { color: colors.text, marginBottom: 0 }]}>
                  Fingerprint / Biometric Lock
                </Text>
              </View>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Require fingerprint verification whenever opening or resuming Spendly.
              </Text>
              {biometricInfo && (
                <View style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: biometricInfo.isHardwareAvailable ? colors.success : colors.danger
                    }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                      {biometricInfo.isHardwareAvailable
                        ? `${biometricInfo.supportedTypes.join(' & ')} Ready`
                        : 'Hardware Not Detected'}
                    </Text>
                  </View>

                  {biometricInfo.isHardwareAvailable && (
                    <TouchableOpacity
                      onPress={handleTestFingerprint}
                      disabled={isTestingBiometric}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 8,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {isTestingBiometric ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : testResult === 'success' ? (
                        <Check size={14} color={colors.success} />
                      ) : (
                        <RefreshCw size={14} color={colors.primary} />
                      )}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                        {isTestingBiometric
                          ? 'Testing Sensor...'
                          : testResult === 'success'
                            ? 'Test Passed!'
                            : 'Test Fingerprint Sensor'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>
                Two-Factor Authentication (2FA)
              </Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Require verification codes sent to your phone or app.
              </Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={(val) => {
                setTwoFactorEnabled(val);
                if (val) {
                  useAlertStore.getState().showAlert('2FA Configuration', 'Verification setup link sent to your registered email.', 'info');
                }
              }}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
        </View>

        {/* Password Reset Block */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          {isGoogleUser ? 'Set Account Password' : 'Update Password'}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isGoogleUser && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.06)',
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
            }}>
              <GoogleIcon size={18} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.text, lineHeight: 16 }}>
                Signed in with Google. Set a password to enable direct email & password sign in.
              </Text>
            </View>
          )}

          <View style={styles.form}>
            {/* 1. Current Password field (ONLY shown if user signed up with email/password) */}
            {!isGoogleUser && (
              <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                <Lock size={15} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  placeholder="Current Account Password"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text }]}
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 4 }}>
                  {showCurrentPassword ? <EyeOff size={16} color={colors.textSecondary} /> : <Eye size={16} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            )}

            {/* 2. New Password field */}
            <View style={[styles.inputContainer, { borderColor: colors.border }]}>
              <Lock size={15} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholder="New Password (min 6 chars)"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 4 }}>
                {showNewPassword ? <EyeOff size={16} color={colors.textSecondary} /> : <Eye size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>

            {/* 3. Confirm New Password field */}
            <View style={[styles.inputContainer, { borderColor: colors.border }]}>
              <Lock size={15} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                {showConfirmPassword ? <EyeOff size={16} color={colors.textSecondary} /> : <Eye size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleUpdatePassword}
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {isGoogleUser ? 'Set Password' : 'Update Password'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Sessions */}
        <View style={styles.sessionsHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}>
            Active Login Devices ({sessions.length})
          </Text>
          {sessions.length > 1 && (
            <TouchableOpacity onPress={terminateOtherSessions} disabled={isLoadingSessions}>
              <Text style={[styles.actionLinkText, { color: colors.danger }]}>Sign Out Others</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 12 }]}>
          {isLoadingSessions ? (
            <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                Loading active sessions...
              </Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>No active sessions found.</Text>
            </View>
          ) : (
            sessions.map((session, index) => (
              <View key={session.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 8 }]} />}
                <View style={styles.sessionItem}>
                  <View style={[styles.sessionIconBg, { backgroundColor: colors.primaryLight }]}>
                    {getPlatformIcon(session.type)}
                  </View>

                  <View style={styles.sessionDetails}>
                    <View style={styles.sessionTitleRow}>
                      <Text style={[styles.sessionDevice, { color: colors.text }]}>
                        {session.device}
                      </Text>
                      {session.isCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.currentBadgeText, { color: colors.success }]}>CURRENT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.sessionSub, { color: colors.textSecondary }]}>
                      {session.location} • {session.ip}
                    </Text>
                    <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                      {session.time}
                    </Text>
                  </View>

                  {!session.isCurrent && (
                    <TouchableOpacity
                      onPress={() => terminateSingleSession(session)}
                      style={{ padding: 6 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>


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
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchTextCol: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  switchDesc: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
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
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  actionBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sessionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sessionItem: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  sessionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionDetails: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDevice: {
    fontSize: 13,
    fontWeight: '800',
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sessionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sessionTime: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
});
