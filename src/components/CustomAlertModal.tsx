import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAlertStore } from '../store/alertStore';

export const CustomAlertModal: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { visible, title, message, type, buttons, hideAlert } = useAlertStore();

  if (!visible) return null;

  // Helper to determine color schemes for alert types
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle-outline' as const,
          iconBg: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
          iconColor: '#22C55E',
        };
      case 'error':
        return {
          icon: 'close-circle-outline' as const,
          iconBg: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
          iconColor: '#EF4444',
        };
      case 'warning':
        return {
          icon: 'warning-outline' as const,
          iconBg: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
          iconColor: '#F59E0B',
        };
      case 'info':
      default:
        return {
          icon: 'information-circle-outline' as const,
          iconBg: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
          iconColor: '#3B82F6',
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
      animationType="fade"
      onRequestClose={hideAlert}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={hideAlert} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
              borderColor: isDark ? '#1F293D' : '#E5E7EB',
            },
          ]}
        >
          {/* Header Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
            <Ionicons name={config.icon} size={36} color={config.iconColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {buttons && buttons.length > 0 ? (
              buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                
                let btnBg = colors.primary;
                let textColor = '#FFFFFF';
                let borderColor = 'transparent';
                let borderWidth = 0;

                if (isDestructive) {
                  btnBg = '#EF4444';
                } else if (isCancel) {
                  btnBg = isDark ? '#151D30' : '#F3F4F6';
                  textColor = colors.text;
                  borderColor = isDark ? '#1F293D' : '#E2E8F0';
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
                        flex: buttons.length > 2 ? 0 : 1, // stack buttons if > 2, otherwise row side-by-side
                        width: buttons.length > 2 ? '100%' : 'auto',
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.btnText, { color: textColor }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Default OK button if none supplied
              <TouchableOpacity
                onPress={() => handleButtonPress()}
                style={[styles.btn, { backgroundColor: colors.primary, width: '100%' }]}
                activeOpacity={0.8}
              >
                <Text style={styles.btnText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    minWidth: 100,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
