import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Animated as RNAnimated,
  Easing,
  Dimensions,
  Pressable,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useNotificationStore, NotificationItem } from '../store/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  AlertTriangle,
  CheckCircle,
  Shield,
  Info,
  BellOff,
  Trash2,
  Clock,
  Music,
  Tv,
  Smartphone,
} from 'lucide-react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');

interface NotificationSidebarProps {
  visible: boolean;
  onClose: () => void;
}

// Skeleton Loader for Notifications
const NotificationSkeleton = ({ colors, isDark }: { colors: any; isDark: boolean }) => {
  const opacityAnim = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 700,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  const skeletonBg = isDark ? '#1E293B' : '#E2E8F0';

  return (
    <View style={styles.skeletonList}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.skeletonCard,
            { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F4F5FA' },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <RNAnimated.View
              style={[
                styles.skeletonIconCircle,
                { backgroundColor: skeletonBg, opacity: opacityAnim },
              ]}
            />
            <View style={{ flex: 1 }}>
              <RNAnimated.View
                style={[
                  styles.skeletonTextLine,
                  { backgroundColor: skeletonBg, opacity: opacityAnim, width: '65%' },
                ]}
              />
              <RNAnimated.View
                style={[
                  styles.skeletonTextLine,
                  { backgroundColor: skeletonBg, opacity: opacityAnim, width: '85%', marginTop: 8 },
                ]}
              />
              <RNAnimated.View
                style={[
                  styles.skeletonTextLine,
                  { backgroundColor: skeletonBg, opacity: opacityAnim, width: '40%', marginTop: 8 },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export const NotificationSidebar: React.FC<NotificationSidebarProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Animation setup: Start offscreen to the right (screenWidth)
  const slideAnim = useRef(new RNAnimated.Value(screenWidth)).current;

  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const deleteNotification = useNotificationStore((state) => state.deleteNotification);
  const loadNotifications = useNotificationStore((state) => state.loadNotifications);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      RNAnimated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      let isMounted = true;
      loadNotifications().then(() => {
        setTimeout(() => {
          if (isMounted) setIsLoading(false);
        }, 250);
      });

      return () => {
        isMounted = false;
      };
    } else {
      slideAnim.setValue(screenWidth);
    }
  }, [visible]);

  const handleClose = () => {
    RNAnimated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getNotificationIcon = (item: NotificationItem) => {
    const titleLower = item.title.toLowerCase();
    const msgLower = item.message.toLowerCase();

    if (titleLower.includes('song') || titleLower.includes('tune') || msgLower.includes('tune')) {
      return <Music size={18} color="#2563EB" />;
    }
    if (titleLower.includes('tv') || titleLower.includes('channel') || msgLower.includes('show')) {
      return <Tv size={18} color="#2563EB" />;
    }
    if (titleLower.includes('recharge') || item.type === 'warning') {
      return <Info size={18} color="#EF4444" />;
    }
    if (item.type === 'security') {
      return <Shield size={18} color="#EF4444" />;
    }
    if (item.type === 'success') {
      return <CheckCircle size={18} color="#10B981" />;
    }
    return <Smartphone size={18} color="#2563EB" />;
  };

  const getIconContainerBg = (item: NotificationItem) => {
    const titleLower = item.title.toLowerCase();
    if (titleLower.includes('recharge') || item.type === 'warning' || item.type === 'security') {
      return isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2';
    }
    if (item.type === 'success') {
      return isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5';
    }
    return isDark ? 'rgba(37, 99, 235, 0.15)' : '#DBEAFE';
  };

  const renderRightSwipeActions = (id: string) => {
    return (
      <TouchableOpacity
        style={styles.swipeDeleteActionBtn}
        onPress={() => deleteNotification(id)}
        activeOpacity={0.8}
      >
        <Trash2 size={20} color="#FFFFFF" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          {/* Animated Container sliding from right */}
          <RNAnimated.View
            style={[
              styles.fullscreenContainer,
              {
                backgroundColor: colors.background,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Header matching main screen header */}
            <View
              style={[
                styles.headerContainer,
                {
                  paddingTop: insets.top + 8,
                  height: 65 + insets.top,
                  backgroundColor: colors.card,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {/* Title Container (Centred) */}
              <View style={[styles.headerTitleContainer, { top: insets.top }]}>
                <Text style={[styles.headerTitleText, { color: colors.text }]}>NOTIFICATIONS</Text>
              </View>

              {/* Left Action Button (Back Button) */}
              <View style={styles.headerActionWrapper}>
                <Pressable
                  onPress={handleClose}
                  style={({ pressed }) => [
                    styles.headerBackButton,
                    { backgroundColor: isDark ? '#1E293B' : '#F3F4F6' },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Feather name="chevron-left" size={24} color={colors.text} style={{ marginRight: 2 }} />
                </Pressable>
              </View>

              {/* Right Action Wrapper */}
              <View style={styles.headerActionWrapper}>
                <View style={styles.headerPlaceholder} />
              </View>
            </View>

            {/* Filter Pill Tabs - ALWAYS PRESENT EVEN IF 0 NOTIFICATIONS */}
            <View style={[styles.pillTabsRow, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[
                  styles.pillTab,
                  filter === 'all'
                    ? [
                        styles.pillTabActive,
                        { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.18)' : '#E6F4F1' },
                      ]
                    : [
                        styles.pillTabInactive,
                        { borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#1E293B' },
                      ],
                ]}
                onPress={() => setFilter('all')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.pillTabText,
                    {
                      color: filter === 'all'
                        ? (isDark ? '#34D399' : '#046B5C')
                        : colors.text,
                    },
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pillTab,
                  filter === 'unread'
                    ? [
                        styles.pillTabActive,
                        { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.18)' : '#E6F4F1' },
                      ]
                    : [
                        styles.pillTabInactive,
                        { borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#1E293B' },
                      ],
                ]}
                onPress={() => setFilter('unread')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.pillTabText,
                    {
                      color: filter === 'unread'
                        ? (isDark ? '#34D399' : '#046B5C')
                        : colors.text,
                    },
                  ]}
                >
                  Unread
                </Text>
              </TouchableOpacity>
            </View>

            {/* Notifications Content */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {isLoading ? (
                <NotificationSkeleton colors={colors} isDark={isDark} />
              ) : filteredNotifications.length > 0 ? (
                filteredNotifications.map((item, index) => (
                  <Animated.View key={item.id} entering={FadeInUp.duration(300).delay(index * 40)}>
                    <Swipeable
                      renderRightActions={() => renderRightSwipeActions(item.id)}
                      friction={2}
                      rightThreshold={40}
                    >
                      <TouchableOpacity
                        style={[
                          styles.notificationCard,
                          {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F4F5FA',
                            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
                          },
                        ]}
                        onPress={() => markAsRead(item.id)}
                        activeOpacity={0.85}
                      >
                        {/* Red Dot Unread Indicator */}
                        {!item.read && <View style={styles.unreadRedDot} />}

                        <View style={styles.cardContentRow}>
                          <View
                            style={[
                              styles.iconCircleBadge,
                              { backgroundColor: getIconContainerBg(item) },
                            ]}
                          >
                            {getNotificationIcon(item)}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.cardTitle,
                                { color: colors.text },
                                !item.read && styles.unreadTitleBold,
                              ]}
                            >
                              {item.title}
                            </Text>

                            <Text style={[styles.cardMsg, { color: colors.textSecondary }]}>
                              {item.message}
                            </Text>

                            <View style={styles.cardTimeRow}>
                              <Clock size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
                              <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
                                {item.time}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Swipeable>
                  </Animated.View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconBg, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <BellOff size={36} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
                  </Text>
                  <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                    {filter === 'unread'
                      ? 'You have read all your alerts.'
                      : 'You have no notifications at this time.'}
                  </Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </RNAnimated.View>
        </View>
      </GestureHandlerRootView>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerTitleText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  headerActionWrapper: {
    zIndex: 2,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },

  // Pill Tabs (All, Unread) matching screenshot
  pillTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pillTab: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillTabActive: {
    borderWidth: 0,
  },
  pillTabInactive: {
    borderWidth: 1.5,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '700',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },

  // Notification Card matching screenshot
  notificationCard: {
    borderRadius: 18,
    padding: 16,
    position: 'relative',
  },
  unreadRedDot: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    zIndex: 2,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconCircleBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  unreadTitleBold: {
    fontWeight: '800',
  },
  cardMsg: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Swipe Action
  swipeDeleteActionBtn: {
    width: 80,
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },

  // Skeleton Styles
  skeletonList: {
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 18,
    padding: 16,
  },
  skeletonIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  skeletonTextLine: {
    height: 12,
    borderRadius: 6,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
