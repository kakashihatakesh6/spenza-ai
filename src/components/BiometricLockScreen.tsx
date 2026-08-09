import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Fingerprint, ShieldCheck, Lock, RefreshCw, LogOut, Sparkles } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { biometricService } from '../services/biometric.service';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

interface BiometricLockScreenProps {
  onUnlockSuccess: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ onUnlockSuccess }) => {
  const { colors, isDark } = useTheme();
  const signOut = useAuthStore((state) => state.signOut);

  const [status, setStatus] = useState<'idle' | 'authenticating' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animated shared values
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.4);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0.2);
  const iconScale = useSharedValue(1);

  // Start continuous subtle glowing pulse rings
  useEffect(() => {
    pulseScale1.value = withRepeat(
      withTiming(1.35, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    pulseOpacity1.value = withRepeat(
      withTiming(0, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );

    pulseScale2.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 2200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
    pulseOpacity2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2200, easing: Easing.out(Easing.quad) }),
        withTiming(0.25, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const triggerAuth = useCallback(async () => {
    setStatus('authenticating');
    setErrorMessage(null);

    // Haptic feedback on tap
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // Bounce icon
    iconScale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1.05, { duration: 150 }),
      withTiming(1, { duration: 100 })
    );

    const res = await biometricService.authenticate('Scan fingerprint to verify identity');

    if (res.success) {
      setStatus('success');
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Short pause to show success animation before unlocking
      setTimeout(() => {
        onUnlockSuccess();
      }, 400);
    } else {
      setStatus('failed');
      setErrorMessage(res.error || 'Fingerprint match failed');
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  }, [onUnlockSuccess, iconScale]);

  // Auto trigger authentication when screen mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerAuth();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const animatedPulse1 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale1.value }],
    opacity: pulseOpacity1.value,
  }));

  const animatedPulse2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const getStatusBadgeColor = () => {
    if (status === 'success') return colors.success;
    if (status === 'failed') return colors.danger;
    return colors.primary;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background ambient glow shapes */}
      <View style={[styles.ambientGlowTop, { backgroundColor: colors.primary + '15' }]} />
      <View style={[styles.ambientGlowBottom, { backgroundColor: colors.primary + '10' }]} />

      {/* Main Glass Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Top Header / App Badge */}
        <View style={styles.headerRow}>
          <View style={[styles.appBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF' }]}>
            <Lock size={16} color={colors.primary} />
            <Text style={[styles.appBadgeText, { color: colors.primary }]}>SECURE APP LOCK</Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Spendly Guard</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Authentication required to view your financial records
        </Text>

        {/* Central Animated Fingerprint Scanner Target */}
        <View style={styles.scannerWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              { backgroundColor: getStatusBadgeColor(), borderColor: getStatusBadgeColor() },
              animatedPulse2,
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              { backgroundColor: getStatusBadgeColor(), borderColor: getStatusBadgeColor() },
              animatedPulse1,
            ]}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={triggerAuth}
            disabled={status === 'authenticating' || status === 'success'}
            style={styles.touchableScanner}
          >
            <Animated.View
              style={[
                styles.scannerCircle,
                {
                  backgroundColor: status === 'success'
                    ? colors.success
                    : status === 'failed'
                    ? colors.danger + '20'
                    : isDark
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(99, 102, 241, 0.1)',
                  borderColor: getStatusBadgeColor(),
                },
                animatedIconStyle,
              ]}
            >
              {status === 'authenticating' ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : status === 'success' ? (
                <ShieldCheck size={54} color="#FFF" />
              ) : (
                <Fingerprint
                  size={56}
                  color={status === 'failed' ? colors.danger : colors.primary}
                />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Dynamic Status Display */}
        <View style={styles.statusContainer}>
          {status === 'authenticating' ? (
            <Text style={[styles.statusText, { color: colors.primary }]}>Scanning fingerprint...</Text>
          ) : status === 'success' ? (
            <View style={styles.statusRow}>
              <Sparkles size={16} color={colors.success} />
              <Text style={[styles.statusText, { color: colors.success, fontWeight: '700' }]}>
                Identity Verified! Unlocking...
              </Text>
            </View>
          ) : status === 'failed' ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMessage || 'Verification Failed'}
              </Text>
              <Text style={[styles.tapHint, { color: colors.textSecondary }]}>
                Tap the fingerprint sensor to try again
              </Text>
            </View>
          ) : (
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Touch fingerprint sensor to unlock
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={triggerAuth}
            disabled={status === 'authenticating' || status === 'success'}
          >
            <RefreshCw size={16} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryBtnText}>Scan Fingerprint</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: colors.border }]}
            onPress={signOut}
          >
            <LogOut size={16} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={[styles.signOutBtnText, { color: colors.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 32,
    borderWidth: 1,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  headerRow: {
    marginBottom: 16,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  appBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 36,
  },
  scannerWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
  },
  touchableScanner: {
    zIndex: 10,
  },
  scannerCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  statusContainer: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  tapHint: {
    fontSize: 11,
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'column',
    gap: 10,
  },
  retryBtn: {
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  signOutBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
