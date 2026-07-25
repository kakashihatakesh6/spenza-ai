import React, { useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationEnd: () => void;
  isLoading: boolean; // Indicates if auth or DB is still loading
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationEnd, isLoading }) => {
  // Animation Shared Values
  const splashOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(20);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  
  // Loading Dots Shared Values
  const dot1Scale = useSharedValue(0.6);
  const dot2Scale = useSharedValue(0.6);
  const dot3Scale = useSharedValue(0.6);

  useEffect(() => {
    // 1. Logo Animation (Scale up and fade in)
    logoScale.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.back(1.5)),
    });
    logoOpacity.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.quad),
    });
    logoTranslateY.value = withTiming(0, {
      duration: 1000,
      easing: Easing.out(Easing.back(1.5)),
    });

    // 2. Title and Tagline Animation (Slide up and fade in)
    textOpacity.value = withDelay(
      400,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.quad),
      })
    );
    textTranslateY.value = withDelay(
      400,
      withTiming(0, {
        duration: 800,
        easing: Easing.out(Easing.quad),
      })
    );

    // 3. Loading Indicator Dots Pulse Loop
    dot1Scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    dot2Scale.value = withDelay(
      150,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    dot3Scale.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const triggerExit = useCallback(() => {
    splashOpacity.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.quad),
    }, (finished) => {
      if (finished) {
        runOnJS(onAnimationEnd)();
      }
    });
  }, [onAnimationEnd, splashOpacity]);

  // Monitor loading status to trigger exit transition
  useEffect(() => {
    // Minimum 2 second display time
    const timer = setTimeout(() => {
      if (!isLoading) {
        triggerExit();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoading, triggerExit]);

  // When isLoading changes to false later, check if we can exit
  useEffect(() => {
    if (!isLoading) {
      // Small buffer to ensure visual smoothness
      const timer = setTimeout(() => {
        triggerExit();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, triggerExit]);

  // Animated Styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { translateY: logoTranslateY.value }
    ],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const dot1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }],
  }));

  const dot2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }],
  }));

  const dot3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]} pointerEvents="none">
      {/* Background Gradient */}
      <View style={StyleSheet.absoluteFillObject}>
        <Svg height="100%" width="100%">
          <Defs>
            <LinearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#0B0F19" stopOpacity="1" />
              <Stop offset="50%" stopColor="#111827" stopOpacity="1" />
              <Stop offset="100%" stopColor="#1E293B" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grad)" />
        </Svg>
      </View>

      {/* Decorative Glow Circles */}
      <View style={[styles.glowCircle, { top: height * 0.2, left: -width * 0.2, backgroundColor: '#312E81', opacity: 0.15 }]} />
      <View style={[styles.glowCircle, { bottom: height * 0.1, right: -width * 0.2, backgroundColor: '#1E1B4B', opacity: 0.2 }]} />

      <View style={styles.content}>
        {/* Animated App Logo Mascot */}
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Text Elements */}
        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
          <Text style={styles.title}>SPENDLY</Text>
          <Text style={styles.tagline}>Smart Expense Tracker</Text>
        </Animated.View>
      </View>

      {/* Modern Dots Loading Indicator */}
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.dot, dot1AnimatedStyle]} />
        <Animated.View style={[styles.dot, dot2AnimatedStyle]} />
        <Animated.View style={[styles.dot, dot3AnimatedStyle]} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999, // Ensure it sits on top of everything
  },
  glowCircle: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  logo: {
    width: 140,
    height: 140,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    textAlign: 'center',
  },
  tagline: {
    color: '#94A3B8', // Soft slate
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1', // Primary brand color
    marginHorizontal: 5,
  },
});
