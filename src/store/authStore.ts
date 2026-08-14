import { create } from 'zustand';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';
import { useAlertStore } from './alertStore';
import { useNotificationStore } from './notificationStore';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { logger } from '../services/logger';
import { networkMonitor } from '../services/logger/networkMonitor';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthTransitioning: boolean;
  authTransitionText: string;
  
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setAuthTransitioning: (transitioning: boolean, text?: string) => void;
  updateProfile: (username: string, avatarUrl?: string, extraMetadata?: Record<string, any>) => Promise<void>;
}

let hasHandledRevocation = false;
let knownDeviceIds: string[] | null = null;
let isSigningOut = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthTransitioning: false,
  authTransitionText: '',
  setAuthTransitioning: (transitioning, text = '') => set({ isAuthTransitioning: transitioning, authTransitionText: text }),

  initializeAuth: async () => {
    try {
      set({ isLoading: true });
      const session = await authService.getSession();
      set({ 
        session, 
        user: session?.user || null, 
        isLoading: false 
      });

      if (session?.user) {
        sessionService.registerCurrentDevice();
      }

      // Listen to auth state changes in real-time
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' && session) {
          logger.info('Session restored');
        } else if (event === 'SIGNED_IN') {
          hasHandledRevocation = false;
          knownDeviceIds = null;
          isSigningOut = false;
          logger.info('Session restored / signed in');
          set({ isAuthTransitioning: false });
        } else if (event === 'SIGNED_OUT') {
          const wasLoggedIn = !!get().user;
          const remoteRevoked = wasLoggedIn && !isSigningOut;

          hasHandledRevocation = false;
          knownDeviceIds = null;
          isSigningOut = false;
          logger.info('User signed out');
          set({ isAuthTransitioning: false });
          try {
            // Lazy import to prevent circular dependency
            const { useChatStore } = require('./chatStore');
            useChatStore.getState().resetChatStore();
          } catch (err) {
            logger.warn('Failed to reset chat store on sign out', err);
          }

          if (remoteRevoked) {
            if (hasHandledRevocation) {
              useAlertStore.getState().showAlert(
                'Session Terminated',
                'This device was signed out from Active Login Devices in Security Center.',
                'warning',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      const { router } = require('expo-router');
                      router.replace('/auth/login');
                    }
                  }
                ],
                false
              );
            } else {
              useAlertStore.getState().showAlert(
                'Session Expired',
                'Your active session has ended or was revoked from another device. Please log in again.',
                'warning',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      const { router } = require('expo-router');
                      router.replace('/auth/login');
                    }
                  }
                ],
                false
              );
            }
          }
        } else if (event === 'TOKEN_REFRESHED' && !session) {
          logger.info('Session expired');
        } else if (event === 'USER_UPDATED' && session) {
          logger.info('User updated');
        }

        set((state) => {
          // If session user ID changed, reset chat store
          if (state.user?.id && session?.user?.id && state.user.id !== session.user.id) {
            try {
              const { useChatStore } = require('./chatStore');
              useChatStore.getState().resetChatStore();
            } catch {}
          }

          // If session access token & user id haven't changed on USER_UPDATED, update user object without resetting isLoading
          if (event === 'USER_UPDATED' && state.session?.access_token === session?.access_token && state.user?.id === session?.user?.id) {
            return { user: session?.user || state.user };
          }

          // Preserve local session state when offline if Supabase SDK emits null session due to failed token refresh
          if (!session && !networkMonitor.isOnline && state.user) {
            return state;
          }

          return { 
            session, 
            user: session?.user || null, 
            isLoading: false 
          };
        });
      });
    } catch (error) {
      logger.error('Failed to initialize auth', error);
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        set((state) => ({
          user,
          session: state.session ? { ...state.session, user } : null
        }));
      }
    } catch (err) {
      logger.error('Failed to refresh user profile from Supabase', err);
    }
  },

  validateSession: async () => {
    try {
      if (isSigningOut) return false;
      const currentSession = get().session;
      const currentUser = get().user;
      if (!currentSession && !currentUser) return false;

      // Skip remote validation if device is currently offline
      if (!networkMonitor.isOnline) {
        return true;
      }

      // 1. Check with Supabase Auth server if refresh token or session is still valid
      const { data: { user }, error } = await supabase.auth.getUser();

      // Guard against race condition if sign out was initiated while getUser() was in flight or state was cleared
      if (isSigningOut || !get().user || !get().session) {
        return false;
      }
      if (error || !user) {
        const errMsg = (error?.message || '').toLowerCase();
        const errName = (error?.name || '').toLowerCase();
        const isNetworkError =
          !networkMonitor.isOnline ||
          errMsg.includes('network') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('offline') ||
          errMsg.includes('timeout') ||
          errName.includes('typeerror');

        if (isNetworkError) {
          logger.info('Network error during session validation. Preserving offline session.');
          return true;
        }

        logger.info('Session invalidated or user signed out remotely');
        useAlertStore.getState().showAlert(
          'Session Expired',
          'Your active session has ended or was revoked from another device. Please log in again.',
          'warning',
          [
            {
              text: 'OK',
              onPress: async () => {
                isSigningOut = true;
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                set({ user: null, session: null });
                const { router } = require('expo-router');
                router.replace('/auth/login');
              }
            }
          ],
          false
        );
        return false;
      }

      // 2. Verify if current device ID is still in active_devices list in user_metadata
      const deviceId = await sessionService.getDeviceId();
      const activeDevices: any[] = user.user_metadata?.active_devices || [];

      if (activeDevices.length > 0) {
        const isStillActive = activeDevices.some((d) => d.id === deviceId);

        if (!isStillActive) {
          if (!hasHandledRevocation) {
            hasHandledRevocation = true;
            logger.info('Device session terminated remotely from active_devices');
            useNotificationStore.getState().addNotification({
              title: 'Security Alert: Device Terminated',
              message: 'This device was signed out from Active Login Devices in Security Center.',
              type: 'security',
              categoryName: 'SECURITY',
            });
            useAlertStore.getState().showAlert(
              'Session Terminated',
              'This device was signed out from Active Login Devices in Security Center.',
              'warning',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    isSigningOut = true;
                    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                    set({ user: null, session: null });
                    const { router } = require('expo-router');
                    router.replace('/auth/login');
                  }
                }
              ],
              false
            );
          }
          return false;
        }

        // Check if any NEW device logged into the account (detected on Device A)
        const currentDeviceIds = activeDevices.map((d) => d.id);
        if (knownDeviceIds !== null) {
          const newDevices = activeDevices.filter(
            (d) => d.id !== deviceId && !knownDeviceIds!.includes(d.id)
          );
          for (const newDev of newDevices) {
            useNotificationStore.getState().addNotification({
              title: 'New Device Signed In',
              message: `A new device (${newDev.device || 'Mobile Device'}) signed in to your account.`,
              type: 'warning',
              categoryName: 'SECURITY',
            });
          }
        }
        knownDeviceIds = currentDeviceIds;
      }

      // Only update state if user object metadata changed to avoid unnecessary re-renders
      if (currentUser?.updated_at !== user.updated_at) {
        set((state) => ({
          user,
          session: state.session ? { ...state.session, user } : null,
        }));
      }
      return true;
    } catch (err) {
      logger.warn('Session validation check error', err);
      return true;
    }
  },

  setSession: (session) => {
    set({ session, user: session?.user || null });
  },

  updateProfile: async (username: string, avatarUrl?: string, extraMetadata?: Record<string, any>) => {
    try {
      // Try to update Supabase if online
      const { data, error } = await supabase.auth.updateUser({
        data: { 
          username, 
          avatar_url: avatarUrl, 
          custom_avatar_url: avatarUrl, 
          ...extraMetadata 
        }
      });
      if (error) {
        logger.warn('Supabase update failed or offline. Updating store state locally.', error);
      }
      
      if (data?.user) {
        set((state) => ({
          user: data.user,
          session: state.session ? { ...state.session, user: data.user } : null
        }));
      } else {
        // Update local state (works even offline/demo mode)
        set((state) => {
          const currentUser = state.user || {
            id: 'mock-user-id',
            email: 'guest@spendly.ai',
            user_metadata: {},
          } as User;
          
          return {
            user: {
              ...currentUser,
              user_metadata: {
                ...currentUser.user_metadata,
                username,
                avatar_url: avatarUrl,
                custom_avatar_url: avatarUrl,
                ...extraMetadata,
              }
            }
          };
        });
      }
    } catch (err) {
      logger.error('Failed to update profile', err);
    }
  },

  signOut: async () => {
    try {
      isSigningOut = true;
      set({ isAuthTransitioning: true, authTransitionText: 'Signing out...' });
      await authService.signOut();
      try {
        const { useChatStore } = require('./chatStore');
        useChatStore.getState().resetChatStore();
      } catch {}
      set({ session: null, user: null, isAuthTransitioning: false });
    } catch (error) {
      logger.error('Failed to sign out', error);
      set({ isAuthTransitioning: false });
    } finally {
      isSigningOut = false;
    }
  },
}));

