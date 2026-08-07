import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAlertStore } from '../store/alertStore';

export const CustomAlertModal: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { visible, title, message, type, buttons, hideAlert } = useAlertStore();

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          bounciness: 6,
          speed: 14,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  // Helper to determine specific production error config based on title/message/type
  const getTypeConfig = () => {
    const combined = `${title || ''} ${message || ''}`.toLowerCase();

    if (combined.includes('daily token') || combined.includes('token limit') || combined.includes('token budget')) {
      return {
        badge: 'DAILY TOKEN LIMIT',
        icon: 'wallet' as const,
        accentColor: '#F59E0B',
        iconBg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
      };
    }
    
    if (combined.includes('rate limit')) {
      return {
        badge: 'RATE LIMIT EXCEEDED',
        icon: 'flash' as const,
        accentColor: '#EAB308',
        iconBg: isDark ? 'rgba(234, 179, 8, 0.16)' : '#FEF9C3',
      };
    }

    if (combined.includes('server busy') || combined.includes('overloaded') || combined.includes('heavy load')) {
      return {
        badge: 'SERVER BUSY',
        icon: 'cloud-offline' as const,
        accentColor: '#8B5CF6',
        iconBg: isDark ? 'rgba(139, 92, 246, 0.16)' : '#EDE9FE',
      };
    }

    if (combined.includes('offline') || combined.includes('network') || combined.includes('connection')) {
      return {
        badge: 'CONNECTION OFFLINE',
        icon: 'wifi' as const,
        accentColor: '#EF4444',
        iconBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
      };
    }

    switch (type) {
      case 'success':
        return {
          badge: 'SUCCESS',
          icon: 'checkmark-circle' as const,
          accentColor: '#10B981',
          iconBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#D1FAE5',
        };
      case 'warning':
        return {
          badge: 'NOTICE',
          icon: 'warning' as const,
          accentColor: '#F59E0B',
          iconBg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
        };
      case 'error':
        return {
          badge: 'SYSTEM ALERT',
          icon: 'alert-circle' as const,
          accentColor: '#EF4444',
          iconBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
        };
      case 'info':
      default:
        return {
          badge: 'INFORMATION',
          icon: 'information-circle' as const,
          accentColor: '#3B82F6',
          iconBg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#DBEAFE',
        };
    }
  };

  const config = getTypeConfig();

  const handleButtonPress = (onPress?: () => void) => {
    hideAlert();
    if (onPress) {
      setTimeout(() => {
        onPress();
      }, 100);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={hideAlert}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable style={styles.backdrop} onPress={hideAlert} />
        
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Pill Category Tag */}
          <View style={[styles.pillTag, { backgroundColor: config.iconBg, borderColor: config.accentColor + '40' }]}>
            <View style={[styles.pillDot, { backgroundColor: config.accentColor }]} />
            <Text style={[styles.pillText, { color: config.accentColor }]}>
              {config.badge}
            </Text>
          </View>

          {/* Header Glowing Icon Container */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconBg, borderColor: config.accentColor + '30' }]}>
            <Ionicons name={config.icon} size={36} color={config.accentColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Detailed Message Container */}
          <View style={[styles.messageBox, { backgroundColor: isDark ? '#151D30' : '#F9FAFB', borderColor: isDark ? '#1F293D' : '#F3F4F6' }]}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {buttons && buttons.length > 0 ? (
              buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                
                let btnBg = config.accentColor;
                let textColor = '#FFFFFF';
                let borderColor = 'transparent';
                let borderWidth = 0;

                if (isDestructive) {
                  btnBg = '#EF4444';
                } else if (isCancel) {
                  btnBg = isDark ? '#1E293B' : '#F1F5F9';
                  textColor = colors.text;
                  borderColor = isDark ? '#334155' : '#E2E8F0';
                  borderWidth = 1;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleButtonPress(btn.onPress)}
                    style={[
                      styles.btn,
                      {
                        backgroundColor: btnBg,
                        borderColor,
                        borderWidth,
                        flex: buttons.length > 2 ? 0 : 1,
                        width: buttons.length > 2 ? '100%' : 'auto',
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.btnText, { color: textColor }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Default Button
              <TouchableOpacity
                onPress={() => handleButtonPress()}
                style={[styles.btn, { backgroundColor: config.accentColor, width: '100%' }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Got It</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 22,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  messageBox: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btn: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    minWidth: 100,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
