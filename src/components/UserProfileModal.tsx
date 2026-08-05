import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useExpenseStore } from '../store/expenseStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { useAlertStore } from '../store/alertStore';
import { expenseHelpers } from '../utils/expenseHelpers';
import {
  User,
  Sparkles,
  Mail,
  TrendingUp,
  ChevronRight,
  LogOut,
  X,
  CreditCard,
  TrendingDown,
  Shield,
} from 'lucide-react-native';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  onClose,
}) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const { expenses } = useExpenseStore();
  const { settings } = useSettingsStore();

  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshUser = useAuthStore((state) => state.refreshUser);

  useEffect(() => {
    if (visible) {
      refreshUser();
    }
  }, [visible]);

  const monthlySpend = expenseHelpers.getMonthlySpend(expenses);

  const username =
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'Expense User';
  const initials = username
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'US';

  const avatarUrl = user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url;
  const isPro = !!user?.user_metadata?.is_pro;

  const handleSignOut = () => {
    onClose();
    useAlertStore.getState().showAlert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        
        <View
          style={[
            styles.profileModalContainer,
            {
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#1F293D' : '#E5E7EB',
              shadowColor: isDark ? '#000000' : '#6366F1',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.profileModalHeader}>
            <Text style={[styles.profileModalHeaderTitle, { color: colors.text }]}>
              Account Overview
            </Text>
            <TouchableOpacity
              style={[
                styles.profileCloseBtn,
                { backgroundColor: isDark ? '#1F293D' : '#F3F4F6' },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Hero Section */}
          <View style={styles.profileHero}>
            <TouchableOpacity
              style={[
                styles.avatarContainer,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
              onPress={() => {
                onClose();
                router.push('/modal/edit-profile');
              }}
              activeOpacity={0.8}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 43 }} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {initials}
                </Text>
              )}
              <View
                style={[
                  styles.onlineIndicator,
                  { borderColor: isDark ? '#111827' : '#FFFFFF' },
                ]}
              />
            </TouchableOpacity>

            <Text style={[styles.profileName, { color: colors.text }]}>
              {username}
            </Text>

            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || ''}
            </Text>
            
            {isPro ? (
              <TouchableOpacity
                style={[styles.profileBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2F6' }]}
                onPress={() => {
                  onClose();
                  router.push('/modal/subscription');
                }}
              >
                <Sparkles size={11} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.profileBadgeText, { color: colors.primary }]}>
                  PRO SUITE ACTIVE
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.profileBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}
                onPress={() => {
                  onClose();
                  router.push('/modal/subscription');
                }}
              >
                <Sparkles size={11} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={[styles.profileBadgeText, { color: '#D97706' }]}>
                  FREE TIER (UPGRADE)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Premium Quick Stats */}
          <View style={[styles.profileStatsBox, { borderColor: isDark ? '#1F293D' : '#F3F4F6', backgroundColor: isDark ? '#151D30' : '#F9FAFB' }]}>
            <View style={styles.profileStatItem}>
              <View style={[styles.statIconWrapper, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)' }]}>
                <TrendingDown size={14} color={colors.primary} />
              </View>
              <Text style={[styles.profileStatVal, { color: colors.text }]}>
                {expenses.length}
              </Text>
              <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>
                Transactions
              </Text>
            </View>
            
            <View style={[styles.profileStatDivider, { backgroundColor: isDark ? '#1F293D' : '#E5E7EB' }]} />
            
            <View style={styles.profileStatItem}>
              <View style={[styles.statIconWrapper, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(10, 185, 129, 0.05)' }]}>
                <CreditCard size={14} color={colors.success} />
              </View>
              <Text style={[styles.profileStatVal, { color: colors.text }]}>
                {expenseHelpers.getCurrencySymbol(settings.currency)}
                {monthlySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>
                Spent This Month
              </Text>
            </View>
          </View>

          {/* Menu Options */}
          <View style={styles.profileMenu}>
            <TouchableOpacity
              style={[styles.profileMenuItemInteractive, { borderBottomColor: isDark ? '#1F293D' : '#F3F4F6' }]}
              onPress={() => {
                onClose();
                router.push('/modal/edit-profile');
              }}
              activeOpacity={0.6}
            >
              <View style={[styles.menuItemIconBg, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2F6' }]}>
                <User size={15} color={colors.primary} />
              </View>
              <Text style={[styles.menuItemInteractiveText, { color: colors.text }]}>
                Edit Account Profile
              </Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileMenuItemInteractive}
              onPress={() => {
                onClose();
                router.push('/modal/subscription');
              }}
              activeOpacity={0.6}
            >
              <View style={[styles.menuItemIconBg, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2F6' }]}>
                <CreditCard size={15} color={colors.primary} />
              </View>
              <Text style={[styles.menuItemInteractiveText, { color: colors.text }]}>
                Plan & Subscription
              </Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Sign Out Button (Futuristic, soft overlay styled red button) */}
          <TouchableOpacity
            style={[
              styles.profileLogoutBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
              },
            ]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <LogOut size={16} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.profileLogoutText, { color: colors.danger }]}>
              Sign Out Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 18, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  profileModalContainer: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileModalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  profileCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  profileBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  profileStatsBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  profileStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  profileStatVal: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  profileStatDivider: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
  },
  profileMenu: {
    marginBottom: 22,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  profileMenuItemInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuItemIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  menuItemVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  menuItemInteractiveText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  profileLogoutBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLogoutText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
