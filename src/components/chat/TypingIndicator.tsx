import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { BotAvatar } from '../BotAvatar';

export const TypingIndicator: React.FC = () => {
  const { colors, isDark } = useTheme();

  // Animation values for three dots
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 350,
              useNativeDriver: true,
            }),
          ])
        ),
      ]);
    };

    const animGroup = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 180),
      animateDot(dot3, 360),
    ]);

    animGroup.start();

    return () => animGroup.stop();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.avatarCol}>
        <BotAvatar size={34} variant="glow" showPulse={true} pulseColor={colors.primary} />
      </View>

      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.chatBotBubble,
            borderColor: colors.chatBotBorder,
          },
        ]}
      >
        <View style={styles.indicatorRow}>
          <Sparkles size={13} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.typingLabel, { color: colors.textSecondary }]}>
            Analyzing ledger data...
          </Text>

          <View style={styles.dotsRow}>
            <Animated.View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.primary,
                  opacity: dot1,
                  transform: [
                    {
                      translateY: dot1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.accent,
                  opacity: dot2,
                  transform: [
                    {
                      translateY: dot2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.success,
                  opacity: dot3,
                  transform: [
                    {
                      translateY: dot3.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  avatarCol: {
    marginRight: 10,
  },
  bubble: {
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
