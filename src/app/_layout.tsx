import '../utils/suppressWarnings';
import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../database/database';
import { useSettingsStore } from '../store/settingsStore';
import { useExpenseStore } from '../store/expenseStore';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { useCurrencyStore } from '../store/currencyStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, View, Text, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationStore } from '../store/notificationStore';
import { SplashScreen } from '../components/SplashScreen';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { CustomAlertModal } from '../components/CustomAlertModal';
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

  const segments = useSegments();
  const router = useRouter();

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
    initializeAuth();

    // 4. Load persisted notification history
    useNotificationStore.getState().loadNotifications();

    // AppState listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        logger.info('App resumed');
      } else if (nextAppState === 'background') {
        logger.info('App moved to background');
      }
    };
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Network status listener
    const unsubscribeNetwork = networkMonitor.addListener((isOnline) => {
      if (isOnline) {
        logger.info('Internet restored');
      } else {
        logger.info('Offline detected');
      }
    });

    if (Platform.OS === 'web') {
      return () => {
        appStateSubscription.remove();
        unsubscribeNetwork();
      };
    }

    // 5. Foreground Notification Listener
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const type = (data?.type as any) || 'info';
      const categoryName = (data?.categoryName as string) || 'ALERT';

      useNotificationStore.getState().addNotification({
        title: title || 'Notification',
        message: body || '',
        type,
        categoryName,
      });
    });

    // 6. Background/Response Notification Listener (when tapped)
    const backgroundSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { title, body, data } = response.notification.request.content;
      const type = (data?.type as any) || 'info';
      const categoryName = (data?.categoryName as string) || 'ALERT';

      useNotificationStore.getState().addNotification({
        title: title || 'Notification',
        message: body || '',
        type,
        categoryName,
      });
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeNetwork();
      foregroundSubscription.remove();
      backgroundSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !appReadyLogged) {
      logger.info('App ready');
      setAppReadyLogged(true);
    }
  }, [authLoading, appReadyLogged]);

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

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth screens
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // Redirect to dashboard if authenticated but in auth screens (except when resetting password on forgot-password screen)
      const isForgotPasswordScreen = segs[1] === 'forgot-password' || segs[1] === 'reset-password';
      if (!isForgotPasswordScreen) {
        router.replace('/(tabs)');
      }
    }
  }, [user, authLoading, segments]);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {!authLoading && (
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="auth/reset-password" />
        <Stack.Screen name="auth/callback" />
        
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
          }} 
        />

        <Stack.Screen 
          name="modal/budget" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'Set Budgets',
            headerStyle: {
              backgroundColor: colors.card,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }} 
        />
      </Stack>
      )}
      {splashVisible && (
        <SplashScreen
          onAnimationEnd={() => setSplashVisible(false)}
          isLoading={authLoading}
        />
      )}
      {authLoading && !splashVisible && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: theme === 'dark' ? '#0B0F19' : '#FFFFFF', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.text, marginTop: 16, fontSize: 15, fontWeight: '700' }}>Signing out...</Text>
        </View>
      )}
      <CustomAlertModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootLayoutNav />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
