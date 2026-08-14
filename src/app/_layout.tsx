import '../utils/suppressWarnings';
import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../database/database';
import { useSettingsStore } from '../store/settingsStore';
import { useExpenseStore } from '../store/expenseStore';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { useTheme } from '../hooks/useTheme';
import { useCurrencyStore } from '../store/currencyStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, View, Text, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationStore, subscribeRealtimeNotifications } from '../store/notificationStore';
import { SplashScreen } from '../components/SplashScreen';
import { BiometricLockScreen } from '../components/BiometricLockScreen';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { CustomAlertModal } from '../components/CustomAlertModal';
import { AuthTransitionOverlay } from '../components/AuthTransitionOverlay';
import { logger } from '../services/logger';
import { networkMonitor } from '../services/logger/networkMonitor';

// Prevent the native splash screen from auto-hiding before the custom splash screen is mounted
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { colors, theme } = useTheme();
  const [splashVisible, setSplashVisible] = useState(true);

  // Hide the native splash screen once the custom splash overlay has mounted
  useEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);
  
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const fetchExpenses = useExpenseStore((state) => state.fetchExpenses);
  const fetchCategories = useExpenseStore((state) => state.fetchCategories);
  const fetchBudgets = useExpenseStore((state) => state.fetchBudgets);
  
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const isAuthTransitioning = useAuthStore((state) => state.isAuthTransitioning);
  const authTransitionText = useAuthStore((state) => state.authTransitionText);

  const alertVisible = useAlertStore((state) => state.visible);
  const alertTitle = useAlertStore((state) => state.title);
  const isCriticalAuthAlert = alertVisible && (alertTitle === 'Session Expired' || alertTitle === 'Session Terminated');

  const segments = useSegments();
  const router = useRouter();

  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const initialLockSet = useRef<boolean>(false);
  const [appReadyLogged, setAppReadyLogged] = useState(false);
  const prevSegments = useRef<string[]>([]);

  useEffect(() => {
    logger.info('App launched');

    // 1. Initialize SQLite Database
    initDatabase();
    
    // 2. Fetch cache from SQLite to stores
    fetchSettings();
    fetchExpenses();
    fetchCategories();
    fetchBudgets();

    // Fetch dynamic exchange rates from API
    useCurrencyStore.getState().fetchRates();

    // 3. Initialize Supabase Auth session
    initializeAuth().then(() => {
      fetchBudgets();
    });

    // 4. Load persisted notification history
    useNotificationStore.getState().loadNotifications();
  }, []);

  // Check biometrics lock state on cold start app launch once authentication is loaded
  useEffect(() => {
    if (!authLoading && !initialLockSet.current) {
      initialLockSet.current = true;
      if (useSettingsStore.getState().settings.biometricsEnabled && user) {
        setIsAppLocked(true);
      }
    }
  }, [authLoading, user]);

  // Real-time multi-device notifications listener
  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeRealtimeNotifications(user.id);
      return unsubscribe;
    }
  }, [user?.id]);

  // Periodic active device session revocation check (every 10 seconds)
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      useAuthStore.getState().validateSession();
    }, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    // AppState listener
    const prevAppState = { current: AppState.currentState };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        logger.info('App resumed');
        useAuthStore.getState().validateSession();

        // Lock app on resume from background if biometrics are enabled and user is logged in
        if (prevAppState.current === 'background') {
          if (useSettingsStore.getState().settings.biometricsEnabled && useAuthStore.getState().user) {
            setIsAppLocked(true);
          }
        }
      } else if (nextAppState === 'background') {
        logger.info('App moved to background');
      }
      prevAppState.current = nextAppState;
    };
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Network status listener
    let wasOffline = false;
    const unsubscribeNetwork = networkMonitor.addListener((isOnline) => {
      if (isOnline) {
        logger.info('Internet restored');
        useAuthStore.getState().validateSession();
        if (wasOffline) {
          wasOffline = false;
          useNotificationStore.getState().addNotification({
            title: 'Offline Expenses Synced ☁️',
            message: 'Your offline transactions have synced with cloud database.',
            type: 'success',
            categoryName: 'SYNC',
          });
        }
      } else {
        wasOffline = true;
        logger.info('Offline detected');
      }
    });

    if (Platform.OS === 'web') {
      return () => {
        appStateSubscription.remove();
        unsubscribeNetwork();
      };
    }

    return () => {
      appStateSubscription.remove();
      unsubscribeNetwork();
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !appReadyLogged) {
      logger.info('App ready');
      setAppReadyLogged(true);
    }
  }, [authLoading, appReadyLogged]);

  // Route change logger
  useEffect(() => {
    const segs = segments as string[];
    if (segs.length === 0) return;

    const currentPath = segs.join('/');
    const prevPath = prevSegments.current.join('/');
    if (currentPath === prevPath) return;
    prevSegments.current = segs;

    if (segs[0] === '(tabs)') {
      if (segs[1] === undefined || segs[1] === '') {
        logger.info('Home screen opened');
      } else if (segs[1] === 'settings') {
        logger.info('Settings opened');
      }
    }
  }, [segments]);

  useEffect(() => {
    if (authLoading) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === 'auth';

    if (!user && !inAuthGroup && !isCriticalAuthAlert) {
      // Redirect to login if not authenticated and not in auth screens
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // Redirect to dashboard if authenticated but in auth screens (except when resetting password on forgot-password screen)
      const isForgotPasswordScreen = segs[1] === 'forgot-password' || segs[1] === 'reset-password';
      if (!isForgotPasswordScreen) {
        router.replace('/(tabs)');
      }
    }
  }, [user, authLoading, segments, isCriticalAuthAlert]);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack 
        screenOptions={{ 
          headerShown: false, 
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="auth/login" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="auth/register" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="auth/forgot-password" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="auth/reset-password" options={{ contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="auth/callback" options={{ contentStyle: { backgroundColor: colors.background } }} />
        
        {/* Explicitly registered modal & sub-screens */}
        <Stack.Screen 
          name="modal/edit-profile" 
          options={{ 
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.background },
          }} 
        />
        
        <Stack.Screen 
          name="modal/security" 
          options={{ 
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.background },
          }} 
        />

        <Stack.Screen 
          name="modal/subscription" 
          options={{ 
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.background },
          }} 
        />

        <Stack.Screen 
          name="modal/add-expense" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'New Transaction',
            headerStyle: {
              backgroundColor: colors.card,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }} 
        />
        
        <Stack.Screen 
          name="modal/scan" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'OCR Scan Receipt',
            headerStyle: {
              backgroundColor: colors.card,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }} 
        />

        <Stack.Screen 
          name="modal/screenshot" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'UPI Screenshot Detection',
            headerStyle: {
              backgroundColor: colors.card,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }} 
        />

        <Stack.Screen 
          name="modal/budget" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'Manage Budget',
            headerStyle: {
              backgroundColor: colors.card,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }} 
        />
      </Stack>

      {splashVisible && (
        <SplashScreen
          onAnimationEnd={() => setSplashVisible(false)}
          isLoading={authLoading}
        />
      )}

      {isAppLocked && user && !splashVisible && (
        <BiometricLockScreen onUnlockSuccess={() => setIsAppLocked(false)} />
      )}

      <CustomAlertModal />

      <AuthTransitionOverlay visible={isAuthTransitioning} text={authTransitionText} />
    </>
  );
}

export default function RootLayout() {
  const { colors } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
        <RootLayoutNav />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

