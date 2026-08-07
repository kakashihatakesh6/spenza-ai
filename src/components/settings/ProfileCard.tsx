import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { SettingsCard } from './SettingsCard';
import { SettingsRow } from './SettingsRow';

interface ProfileCardProps {
  email: string;
  username: string;
  avatarUrl?: string;
  onEditPress?: () => void;
  onSubscriptionPress?: () => void;
  onSecurityPress?: () => void;
  colors: any;
}

export const ProfileCard: React.FC<ProfileCardProps> = React.memo(({
  email,
  username,
  avatarUrl,
  onEditPress,
  onSubscriptionPress,
  onSecurityPress,
}) => {
  const { colors, isDark } = useTheme();
  const initials = (username || 'US').slice(0, 2).toUpperCase();
  
  return (
    <SettingsCard>
      <View style={styles.profileHeader}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
        )}
        
        <View style={styles.profileInfo}>
          <Text style={[styles.usernameText, { color: colors.text }]} numberOfLines={1}>{username}</Text>
          <Text style={[styles.emailText, { color: colors.textSecondary }]} numberOfLines={1}>{email}</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: isDark ? '#1E293B' : '#F5F5F7' }]}
          onPress={onEditPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Edit profile information"
        >
          <Ionicons name="pencil" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      
      <SettingsRow
        icon="star-outline"
        iconBg="#E8F1F5"
        iconColor="#35B6D5"
        title="Manage Subscription"
        onPress={onSubscriptionPress}
      />
      
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      
      <SettingsRow
        icon="shield-checkmark-outline"
        iconBg="#E8F5E9"
        iconColor="#34C759"
        title="Security Center"
        onPress={onSecurityPress}
      />
    </SettingsCard>
  );
});

ProfileCard.displayName = 'ProfileCard';

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  emailText: {
    fontSize: 13,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});
