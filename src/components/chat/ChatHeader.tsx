import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  History,
  Trash2,
  Share2,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { BotAvatar } from '../BotAvatar';

interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  isOnline?: boolean;
  onOpenHistory?: () => void;
  onClearChat?: () => void;
  onExportChat?: () => void;
  showBackBtn?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = 'Spendly AI',
  subtitle = 'Online • Groq GPT-OSS 120B',
  isOnline = true,
  onOpenHistory,
  onClearChat,
  onExportChat,
  showBackBtn = true,
}) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.97)',
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      <View style={styles.headerLeft}>
        {showBackBtn && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
        )}

        <View style={styles.botAvatarWrapper}>
          <BotAvatar size={36} variant="glow" showPulse={isOnline} pulseColor={isOnline ? '#10B981' : '#EF4444'} />
        </View>

        <View style={styles.titleCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            <View style={[styles.modelBadge, { backgroundColor: isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.1)' }]}>
              <Zap size={9} color={colors.primary} />
              <Text style={[styles.modelBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
              {isOnline ? subtitle : 'Offline Mode'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.headerRight}>
        {onOpenHistory && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
            ]}
            onPress={onOpenHistory}
            activeOpacity={0.7}
          >
            <History size={17} color={colors.text} />
          </TouchableOpacity>
        )}

        {onExportChat && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
            ]}
            onPress={onExportChat}
            activeOpacity={0.7}
          >
            <Share2 size={17} color={colors.text} />
          </TouchableOpacity>
        )}

        {onClearChat && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              styles.clearBtn,
              { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)' },
            ]}
            onPress={onClearChat}
            activeOpacity={0.7}
          >
            <Trash2 size={17} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    overflow: 'hidden',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  clearBtn: {
    marginRight: 0,
  },
  botAvatarWrapper: {
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 5,
    gap: 2,
    flexShrink: 0,
  },
  modelBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
    flexShrink: 0,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
});
