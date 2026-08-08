import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { logger } from './logger';
import { sessionService, SessionItem } from './session.service';

// Allow OAuth redirects to be completed
WebBrowser.maybeCompleteAuthSession();

export const authService = {
  // Email & Password Sign Up
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Email & Password Login
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Google Sign-In (OAuth Flow via expo-web-browser)
  async signInWithGoogle() {
    logger.info('Google Sign-In started');
    const redirectUrl = Platform.OS === 'web'
      ? Linking.createURL('auth/callback')
      : 'spendly://auth/callback';

    logger.info('Supabase OAuth Redirect URL', { redirectUrl });

    // On Web platforms, redirect the window directly
    if (Platform.OS === 'web') {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) {
          logger.error('Google Sign-In failed', error);
          throw error;
        }
        return data;
      } catch (err) {
        logger.error('Google Sign-In failed', err);
        throw err;
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        logger.error('Google Sign-In failed', error);
        throw error;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          // Supabase returns tokens in the URL hash fragment (e.g., #access_token=xxx&refresh_token=yyy) or 'code' (PKCE).
          // We convert '#' to '?' so Linking.parse can parse them as query parameters.
          const urlToParse = result.url.includes('#') ? result.url.replace('#', '?') : result.url;
          const { queryParams } = Linking.parse(urlToParse);
          const { access_token, refresh_token, code } = queryParams || {};
          
          if (code) {
            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code as string);
            if (sessionError) {
              logger.error('Google Sign-In failed', sessionError);
              throw sessionError;
            }
            logger.info('Google Sign-In successful', { userId: sessionData.user?.id });
            return sessionData;
          } else if (access_token && refresh_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: access_token as string,
              refresh_token: refresh_token as string,
            });
            if (sessionError) {
              logger.error('Google Sign-In failed', sessionError);
              throw sessionError;
            }
            logger.info('Google Sign-In successful', { userId: sessionData.user?.id });
            return sessionData;
          } else {
            const err = new Error('Authentication tokens or authorization code were not found in the response.');
            logger.error('Google Sign-In failed', err);
            throw err;
          }
        }
      }
      return null;
    } catch (err) {
      logger.error('Google Sign-In failed', err);
      throw err;
    }
  },

  // Google Sign-In with ID Token (from expo-auth-session)
  async signInWithGoogleIdToken(idToken: string, accessToken?: string, nonce?: string) {
    try {
      logger.info('Google Sign-In started');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        access_token: accessToken,
        nonce,
      });
      if (error) {
        logger.error('Google Sign-In failed', error);
        throw error;
      }
      logger.info('Google Sign-In successful', { userId: data.user?.id });
      return data;
    } catch (err) {
      logger.error('Google Sign-In failed', err);
      throw err;
    }
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Reset Password Request
  async sendPasswordResetEmail(email: string) {
    const redirectUrl = Linking.createURL('auth/reset-password');
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    if (error) {
      logger.error('Failed to send password reset email', { message: error.message, status: error.status, name: error.name });
      throw error;
    }
    return data;
  },

  async resetPassword(email: string) {
    return this.sendPasswordResetEmail(email);
  },

  // Verify OTP for Password Reset
  async verifyResetOtp(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'recovery',
    });
    if (error) {
      logger.error('Failed to verify reset OTP', { message: error.message, status: error.status, name: error.name });
      throw error;
    }
    return data;
  },

  // Update Current User Password
  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });
    if (error) {
      logger.error('Failed to update user password', { message: error.message, status: error.status, name: error.name });
      throw error;
    }
    return data;
  },

  // Check Current Session
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // Get Current User
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  async getCurrentUser() {
    return this.getUser();
  },

  // Session Management
  async getActiveSessions() {
    return sessionService.getActiveSessions();
  },

  async signOutOthers() {
    return sessionService.terminateOtherSessions();
  },

  async terminateSession(sessionId: string) {
    return sessionService.terminateSession(sessionId);
  },
};

