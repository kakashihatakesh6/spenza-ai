import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Bot } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

export interface BotAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'glow' | 'gradient' | 'filled' | 'outline' | 'fab';
  showPulse?: boolean;
  pulseColor?: string;
  iconColor?: string;
  style?: any;
}

export const BotAvatar: React.FC<BotAvatarProps> = ({
  size = 'md',
  variant = 'gradient',
  showPulse = true,
  pulseColor = '#10B981',
  iconColor,
  style,
}) => {
  const { colors, isDark } = useTheme();

  // Calculate sizes
  let containerSize = 44;
  let iconSize = 24;
  let pulseSize = 10;

  if (typeof size === 'number') {
    containerSize = size;
    iconSize = Math.round(size * 0.55);
    pulseSize = Math.max(6, Math.round(size * 0.22));
  } else {
    switch (size) {
      case 'xs':
        containerSize = 28;
        iconSize = 15;
        pulseSize = 7;
        break;
      case 'sm':
        containerSize = 36;
        iconSize = 20;
        pulseSize = 8;
        break;
      case 'md':
        containerSize = 44;
        iconSize = 24;
        pulseSize = 10;
        break;
      case 'lg':
        containerSize = 56;
        iconSize = 30;
        pulseSize = 12;
        break;
      case 'xl':
        containerSize = 72;
        iconSize = 40;
        pulseSize = 14;
        break;
    }
  }

  const effectiveIconColor =
    iconColor ||
    (variant === 'outline'
      ? colors.primary
      : variant === 'glow'
      ? isDark
        ? '#818CF8'
        : '#4F46E5'
      : '#FFFFFF');

  // Variant styling
  const getVariantStyles = () => {
    switch (variant) {
      case 'fab':
        return {
          backgroundColor: isDark ? '#6366F1' : '#4F46E5',
          borderColor: isDark ? '#818CF8' : 'rgba(255, 255, 255, 0.6)',
          borderWidth: 1.5,
          shadowColor: isDark ? '#818CF8' : '#4F46E5',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.6 : 0.35,
          shadowRadius: 10,
          elevation: 10,
        };
      case 'glow':
        return {
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF',
          borderColor: isDark ? '#818CF8' : '#6366F1',
          borderWidth: 1.5,
          shadowColor: isDark ? '#818CF8' : '#4F46E5',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.45 : 0.25,
          shadowRadius: 8,
          elevation: 6,
        };
      case 'gradient':
        return {
          backgroundColor: isDark ? '#312E81' : '#4F46E5',
          borderColor: isDark ? '#818CF8' : 'rgba(255, 255, 255, 0.4)',
          borderWidth: 1.5,
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 7,
          elevation: 5,
        };
      case 'outline':
        return {
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)',
          borderColor: colors.primary,
          borderWidth: 1.5,
        };
      case 'filled':
      default:
        return {
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 4,
        };
    }
  };

  return (
    <View
      style={[
        styles.baseContainer,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: Math.round(containerSize * 0.36),
        },
        getVariantStyles(),
        style,
      ]}
    >
      <Bot size={iconSize} color={effectiveIconColor} />

      {showPulse && (
        <View
          style={[
            styles.pulseDotRing,
            {
              width: pulseSize + 4,
              height: pulseSize + 4,
              borderRadius: (pulseSize + 4) / 2,
              backgroundColor: pulseColor + '33',
              top: Math.max(0, Math.round(containerSize * 0.01) - 2),
              right: Math.max(0, Math.round(containerSize * 0.01) - 2),
            },
          ]}
        >
          <View
            style={[
              styles.pulseDot,
              {
                width: pulseSize,
                height: pulseSize,
                borderRadius: pulseSize / 2,
                backgroundColor: pulseColor,
                borderColor: isDark ? '#0F172A' : '#FFFFFF',
                borderWidth: Math.max(1, Math.round(pulseSize * 0.2)),
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseDotRing: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 3,
  },
});
