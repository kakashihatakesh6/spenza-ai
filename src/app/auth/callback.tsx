import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { Card } from '../../components/Card';
import { supabase } from '../../lib/supabase';
import { logger } from '../../services/logger';

export default function AuthCallback() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const [statusMessage, setStatusMessage] = useState('Completing authentication...');

  useEffect(() => {
    let active = true;

    async function handleAuth(urlToParse: string) {
      try {
        // Convert hash fragment to query parameter separator if needed
        const formattedUrl = urlToParse.includes('#') ? urlToParse.replace('#', '?') : urlToParse;
        const { queryParams } = Linking.parse(formattedUrl);
        const { code, access_token, refresh_token, error, error_description } = queryParams || {};

        if (error) {
          throw new Error((error_description as string) || (error as string));
        }

        if (code) {
          setStatusMessage('Exchanging authorization code...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string);
          if (exchangeError) throw exchangeError;
          
          if (active) {
            router.replace('/(tabs)');
          }
          return;
        }

        if (access_token && refresh_token) {
          setStatusMessage('Setting session...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: access_token as string,
            refresh_token: refresh_token as string,
          });
          if (sessionError) throw sessionError;
          
          if (active) {
            router.replace('/(tabs)');
          }
          return;
        }

        // If Linking.parse did not extract the parameters (sometimes happens depending on path nesting),
        // try to fall back to the params extracted by Expo Router
        const routerCode = params.code || params['#code'];
        const routerAccessToken = params.access_token || params['#access_token'];
        const routerRefreshToken = params.refresh_token || params['#refresh_token'];

        if (routerCode) {
          setStatusMessage('Exchanging code...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(routerCode as string);
          if (exchangeError) throw exchangeError;
          if (active) router.replace('/(tabs)');
          return;
        }

        if (routerAccessToken && routerRefreshToken) {
          setStatusMessage('Establishing session...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: routerAccessToken as string,
            refresh_token: routerRefreshToken as string,
          });
          if (sessionError) throw sessionError;
          if (active) router.replace('/(tabs)');
          return;
        }

        // If no credentials found, check if session is already established
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (active) router.replace('/(tabs)');
          return;
        }

        // Check if there were any OAuth indicators in the URL/params
        const hasOAuthParams = !!(code || access_token || error || routerCode || routerAccessToken || params.error || params.error_description);

        if (!hasOAuthParams) {
          // Wait a short moment in case of a race condition with the WebBrowser flow setting the session
          await new Promise(resolve => setTimeout(resolve, 1500));
          const { data: { session: delayedSession } } = await supabase.auth.getSession();
          if (delayedSession) {
            if (active) router.replace('/(tabs)');
            return;
          }
          // Quietly redirect to login since this was a blank callback entry
          if (active) router.replace('/auth/login');
          return;
        }

        throw new Error('No authentication tokens or codes were found in the redirect URL.');
      } catch (err: any) {
        logger.error('Callback auth error', err);
        if (active) {
          useAlertStore.getState().showAlert('Authentication Failed', err.message || 'Could not verify your credentials.', 'error');
          router.replace('/auth/login');
        }
      }
    }

    // Process initial deep link parameters
    const initialUrl = Linking.createURL('auth/callback', {
      queryParams: params as any,
    });
    handleAuth(initialUrl);

    // Watch for incoming URLs if the redirection completes asynchronously
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuth(url);
    });

    // Timeout fallback: if we stay stuck on this page for 10s, redirect back to login
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (active) router.replace('/(tabs)');
      } else {
        if (active) {
          logger.warn('Callback page timed out without session');
          router.replace('/auth/login');
        }
      }
    }, 10000);

    return () => {
      active = false;
      subscription.remove();
      clearTimeout(timeout);
    };
  }, [params, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Decorative Glow Circles to match login aesthetics */}
      <View style={[styles.glowCircle, { top: -50, right: -80, backgroundColor: colors.primary, opacity: isDark ? 0.15 : 0.08 }]} />
      <View style={[styles.glowCircle, { bottom: -100, left: -80, backgroundColor: colors.accent, opacity: isDark ? 0.15 : 0.08 }]} />

      <Card style={styles.card} glassmorphism={true}>
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        <Text style={[styles.title, { color: colors.text }]}>Completing Login</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{statusMessage}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    filter: 'blur(60px)',
  },
  card: {
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderRadius: 24,
  },
  spinner: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
