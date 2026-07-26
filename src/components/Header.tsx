import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { NotificationSidebar } from './NotificationSidebar';
import { useNotificationStore } from '../store/notificationStore';

interface HeaderProps {
  title?: string;
  // Left action options
  showBackButton?: boolean;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  leftIcon?: keyof typeof Feather.glyphMap;
  onLeftPress?: () => void;

  // Right action options
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
  onNotificationPress?: () => void;
  notificationCount?: number;
  hideRightAction?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'SPENDLY',
  showBackButton = false,
  onBackPress,
  onMenuPress,
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  onNotificationPress,
  notificationCount,
  hideRightAction = false,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const user = useAuthStore((state) => state.user);
  const avatarUrl = user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url;
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  const unreadCount = useNotificationStore((state) => state.notifications.filter(n => !n.read).length);
  const badgeCount = notificationCount !== undefined ? notificationCount : unreadCount;
  const initials = username
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const btnStyle = [
    styles.iconButton,
    { backgroundColor: isDark ? '#1E293B' : '#F3F4F6' },
  ];

  const renderLeftAction = () => {
    if (showBackButton) {
      return (
        <Pressable
          onPress={onBackPress}
          style={({ pressed }) => [
            ...btnStyle,
            pressed && styles.buttonPressed,
          ]}
        >
          <Feather name="chevron-left" size={24} color={colors.text} style={{ marginRight: 2 }} />
        </Pressable>
      );
    }

    if (leftIcon && onLeftPress) {
      return (
        <Pressable
          onPress={onLeftPress}
          style={({ pressed }) => [
            ...btnStyle,
            pressed && styles.buttonPressed,
          ]}
        >
          <Feather name={leftIcon} size={20} color={colors.text} />
        </Pressable>
      );
    }

    if (onMenuPress) {
      return (
        <Pressable
          onPress={onMenuPress}
          style={({ pressed }) => [
            ...btnStyle,
            pressed && styles.buttonPressed,
            { padding: 0, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.primary },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                {initials}
              </Text>
            </View>
          )}
        </Pressable>
      );
    }

    return <View style={styles.placeholder} />;
  };

  const renderRightAction = () => {
    if (hideRightAction) {
      return <View style={styles.placeholder} />;
    }

    if (rightIcon && onRightPress) {
      return (
        <Pressable
          onPress={onRightPress}
          style={({ pressed }) => [
            ...btnStyle,
            pressed && styles.buttonPressed,
          ]}
        >
          <Feather name={rightIcon} size={20} color={colors.text} />
        </Pressable>
      );
    }

    // Default notifications bell triggers sliding sidebar
    return (
      <Pressable
        onPress={() => setSidebarVisible(true)}
        style={({ pressed }) => [
          ...btnStyle,
          pressed && styles.buttonPressed,
        ]}
      >
        <Feather name="bell" size={20} color={colors.text} />
        
        {/* Glowing Red Notification Badge */}
        {badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]} />
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          height: 65 + insets.top,
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Title Container (Absolutely Centered) */}
      <View style={[styles.titleContainer, { top: insets.top }]}>
        <Text style={[styles.titleText, { color: colors.text }]}>{title}</Text>
      </View>

      {/* Left Action Button */}
      <View style={styles.actionWrapper}>{renderLeftAction()}</View>

      {/* Right Action Button */}
      <View style={styles.actionWrapper}>{renderRightAction()}</View>

      {/* Sliding Notification Sidebar */}
      <NotificationSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  actionWrapper: {
    zIndex: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  buttonPressed: {
    opacity: 0.7,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
