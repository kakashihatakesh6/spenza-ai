import { create } from 'zustand';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';
import { useAlertStore } from './alertStore';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { logger } from '../services/logger';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  updateProfile: (username: string, avatarUrl?: string, extraMetadata?: Record<string, any>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,

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
          logger.info('Session restored / signed in');
        } else if (event === 'SIGNED_OUT') {
          logger.info('User signed out');
          try {
            // Lazy import to prevent circular dependency
            const { useChatStore } = require('./chatStore');
            useChatStore.getState().resetChatStore();
          } catch (err) {
            logger.warn('Failed to reset chat store on sign out', err);
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
      const currentSession = get().session;
      const currentUser = get().user;
      if (!currentSession && !currentUser) return false;

      // 1. Check with Supabase Auth server if refresh token or session is still valid
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        logger.info('Session invalidated or user signed out remotely');
        set({ user: null, session: null });
        useAlertStore.getState().showAlert(
          'Session Expired',
          'Your active session has ended or was revoked from another device. Please log in again.',
          'warning'
        );
        return false;
      }

      // 2. Verify if current device ID is still in active_devices list in user_metadata
      const deviceId = await sessionService.getDeviceId();
      const activeDevices: any[] = user.user_metadata?.active_devices || [];
      if (activeDevices.length > 0) {
        const isStillActive = activeDevices.some((d) => d.id === deviceId);
        if (!isStillActive) {
          logger.info('Device session terminated remotely from active_devices');
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          set({ user: null, session: null });
          useAlertStore.getState().showAlert(
            'Session Terminated',
            'This device was signed out from Active Login Devices in Security Center.',
            'warning'
          );
          return false;
        }
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
      set({ isLoading: true });
      await authService.signOut();
      try {
        const { useChatStore } = require('./chatStore');
        useChatStore.getState().resetChatStore();
      } catch {}
      set({ session: null, user: null, isLoading: false });
    } catch (error) {
      logger.error('Failed to sign out', error);
      set({ isLoading: false });
    }
  },
}));

