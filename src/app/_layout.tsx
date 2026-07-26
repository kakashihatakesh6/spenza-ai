import '../utils/suppressWarnings';
import React, { useEffect, useState } from 'react';
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
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationStore } from '../store/notificationStore';
import { SplashScreen } from '../components/SplashScreen';
import * as ExpoSplashScreen from 'expo-splash-screen';

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

  useEffect(() => {
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

    if (Platform.OS === 'web') return;

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
      foregroundSubscription.remove();
      backgroundSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth screens
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // Redirect to dashboard if authenticated but in auth screens (except when resetting password on forgot-password screen)
      const isForgotPasswordScreen = segments[1] === 'forgot-password' || segments[1] === 'reset-password';
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
