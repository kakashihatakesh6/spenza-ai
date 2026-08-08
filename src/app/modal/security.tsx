import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { supabase } from '../../lib/supabase';
import { Header } from '../../components/Header';
import { logger } from '../../services/logger';
import {
  ArrowLeft,
  Shield,
  Smartphone,
  Globe,
  Trash2,
  Lock,
  CheckCircle,
  Eye,
  EyeOff,
  Globe as GoogleIcon,
} from 'lucide-react-native';

interface SessionItem {
  id: string;
  device: string;
  location: string;
  ip: string;
  time: string;
  isCurrent: boolean;
  type: 'mobile' | 'desktop';
}

export default function SecurityScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);

  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

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

  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: '1',
      device: 'iPhone 15 Pro (Current)',
      location: 'Mumbai, India',
      ip: '192.168.1.42',
      time: 'Active now',
      isCurrent: true,
      type: 'mobile',
    },
    {
      id: '2',
      device: 'macOS Chrome Browser',
      location: 'Mumbai, India',
      ip: '103.88.22.12',
      time: '2 hours ago',
      isCurrent: false,
      type: 'desktop',
    },
    {
      id: '3',
      device: 'Windows Edge Browser',
      location: 'Delhi, India',
      ip: '49.36.88.94',
      time: '3 days ago',
      isCurrent: false,
      type: 'desktop',
    },
  ]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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
          onPress: () => {
            setSessions(prev => prev.filter(s => s.isCurrent));
            useAlertStore.getState().showAlert('Success', 'Successfully terminated all other sessions.', 'success');
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
              <Text style={[styles.switchTitle, { color: colors.text }]}>Face ID / Biometrics</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Unlock Spendly immediately using system biometrics.
              </Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
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
            <TouchableOpacity onPress={terminateOtherSessions}>
              <Text style={[styles.actionLinkText, { color: colors.danger }]}>Sign Out Others</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 8 }]}>
          {sessions.map((session, index) => (
            <View key={session.id}>
              {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 6 }]} />}
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
              </View>
            </View>
          ))}
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
