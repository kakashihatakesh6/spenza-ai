import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Header } from './Header';
import { useNotificationStore } from '../store/notificationStore';
import {
  AlertTriangle,
  CheckCircle,
  Shield,
  Lightbulb,
  Check,
  BellOff,
  Trash2,
  Clock,
} from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

interface NotificationSidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'success' | 'security' | 'info';
  categoryName: string;
  time: string;
  read: boolean;
}

export const NotificationSidebar: React.FC<NotificationSidebarProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  // Animation setup: Start offscreen to the right (screenWidth)
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(screenWidth);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const notifications = useNotificationStore((state) => state.notifications);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const toggleRead = useNotificationStore((state) => state.toggleRead);

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle size={18} color={isDark ? '#FBBF24' : '#D97706'} />;
      case 'success':
        return <CheckCircle size={18} color={isDark ? '#34D399' : '#059669'} />;
      case 'security':
        return <Shield size={18} color={isDark ? '#F87171' : '#DC2626'} />;
      default:
        return <Lightbulb size={18} color={isDark ? '#60A5FA' : '#2563EB'} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'warning':
        return isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.08)';
      case 'success':
        return isDark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(52, 211, 153, 0.08)';
      case 'security':
        return isDark ? 'rgba(248, 113, 113, 0.12)' : 'rgba(248, 113, 113, 0.08)';
      default:
        return isDark ? 'rgba(96, 165, 250, 0.12)' : 'rgba(96, 165, 250, 0.08)';
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'warning': return isDark ? '#FBBF24' : '#D97706';
      case 'success': return isDark ? '#34D399' : '#059669';
      case 'security': return isDark ? '#F87171' : '#DC2626';
      default: return isDark ? '#60A5FA' : '#2563EB';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        {/* Animated Container sliding from right */}
        <Animated.View
          style={[
            styles.fullscreenContainer,
            {
              backgroundColor: colors.background,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header matching main screen header */}
          <Header
            title="NOTIFICATIONS"
            showBackButton={true}
            onBackPress={handleClose}
            hideRightAction={true}
          />

          {/* Filter Selection Panel */}
          {notifications.length > 0 && (
            <View style={[styles.filterBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    filter === 'all' && [styles.activeTab, { borderBottomColor: colors.primary }],
                  ]}
                  onPress={() => setFilter('all')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: filter === 'all' ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    All Alerts
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tab,
                    filter === 'unread' && [styles.activeTab, { borderBottomColor: colors.primary }],
                  ]}
                  onPress={() => setFilter('unread')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: filter === 'unread' ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    Unread ({notifications.filter(n => !n.read).length})
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionIcons}>
                <TouchableOpacity
                  onPress={markAllAsRead}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Check size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Read All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={clearAll}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color={colors.danger} style={{ marginRight: 4 }} />
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Notifications Scroll list */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      shadowColor: isDark ? '#000000' : 'rgba(99, 102, 241, 0.04)',
                    },
                    !item.read && [styles.unreadCard, { borderLeftColor: colors.primary }],
                  ]}
                  onPress={() => toggleRead(item.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.iconWrapper,
                        { backgroundColor: getIconBg(item.type) },
                      ]}
                    >
                      {getIcon(item.type)}
                    </View>
                    
                    <View style={styles.categoryBadgeWrapper}>
                      <View style={[styles.categoryBadge, { backgroundColor: getIconBg(item.type) }]}>
                        <Text style={[styles.categoryBadgeText, { color: getBadgeColor(item.type) }]}>
                          {item.categoryName}
                        </Text>
                      </View>
                    </View>

                    {!item.read && (
                      <View style={[styles.unreadDotIndicator, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                  
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: colors.text },
                      !item.read && styles.unreadTitleText,
                    ]}
                  >
                    {item.title}
                  </Text>
                  
                  <Text style={[styles.cardMsg, { color: colors.textSecondary }]}>
                    {item.message}
                  </Text>
                  
                  <View style={[styles.cardFooter, { borderTopColor: isDark ? '#1F293D' : '#F9FAFB' }]}>
                    <Clock size={11} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
                      {item.time}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconBg, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <BellOff size={36} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  All Caught Up!
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  No new account notifications found. We will alert you here regarding budget parameters, scanning outputs, and security milestones.
                </Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 18, 0.45)',
  },
  fullscreenContainer: {
    width: '100%',
    height: '100%',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    paddingTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 20,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2.5,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionIcons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    bottom: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  notificationCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  unreadCard: {
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  iconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeWrapper: {
    flex: 1,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unreadDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 6,
  },
  unreadTitleText: {
    fontWeight: '800',
  },
  cardMsg: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  cardTime: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 140,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
