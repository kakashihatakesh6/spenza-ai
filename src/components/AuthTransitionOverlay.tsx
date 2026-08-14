import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

const { width, height } = Dimensions.get('window');

interface AuthTransitionOverlayProps {
  visible: boolean;
  text?: string;
}

export const AuthTransitionOverlay: React.FC<AuthTransitionOverlayProps> = ({
  visible,
  text = 'Processing...',
}) => {
  const { colors, isDark } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);

  // Reanimated Shared Values
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const logoScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);

      // Fade in backdrop
      backdropOpacity.value = withTiming(0.65, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });

      // Scale and fade in the card
      cardScale.value = withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.back(1.2)),
      });
      cardOpacity.value = withTiming(1, {
        duration: 250,
      });

      // Infinite Spinner Rotation
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1200,
          easing: Easing.linear,
        }),
        -1,
        false
      );

      // Infinite Logo Pulsing
      logoScale.value = 1;
      logoScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      // Fade out and scale down
      backdropOpacity.value = withTiming(0, {
        duration: 250,
        easing: Easing.in(Easing.quad),
      });
      cardScale.value = withTiming(0.85, {
        duration: 250,
        easing: Easing.in(Easing.quad),
      });
      cardOpacity.value = withTiming(
        0,
        { duration: 200 },
        (finished) => {
          if (finished) {
            runOnJS(setShouldRender)(false);
          }
        }
      );
    }
  }, [visible]);

  // Animated Styles
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  if (!shouldRender) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
      {/* Dimmed/Blurred Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          backdropAnimatedStyle,
          { backgroundColor: isDark ? '#020617' : '#0B0F19' },
        ]}
      />

      {/* Centered Modal Card Container */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.card,
            cardAnimatedStyle,
            {
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        >
          <View style={styles.spinnerWrapper}>
            {/* Spinning Arc Orbit */}
            <Animated.View
              style={[
                styles.spinnerOrbit,
                spinnerAnimatedStyle,
                {
                  borderColor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
                  borderTopColor: '#6366F1', // Primary Spendly Indigo Color
                  borderRightColor: '#6366F1',
                },
              ]}
            />

            {/* Spendly Icon Container */}
            <Animated.View
              style={[
                styles.logoContainer,
                logoAnimatedStyle,
                {
                  backgroundColor: '#FFFFFF',
                  shadowColor: '#6366F1',
                  shadowOpacity: isDark ? 0.35 : 0.15,
                },
              ]}
            >
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* Loading status message */}
          <Text
            style={[
              styles.statusText,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
            numberOfLines={2}
          >
            {text}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999990,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999991,
  },
  card: {
    width: 200,
    height: 200,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  spinnerWrapper: {
    width: 116,
    height: 116,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  spinnerOrbit: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
  },
  logoContainer: {
    width: 82,
    height: 82,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  logoImage: {
    width: 58,
    height: 58,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 18,
    letterSpacing: 0.3,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
});
