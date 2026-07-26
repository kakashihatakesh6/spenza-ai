import { create } from 'zustand';
import { authService } from '../services/auth.service';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  updateProfile: (username: string, avatarUrl?: string, extraMetadata?: Record<string, any>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
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

      // Listen to auth state changes in real-time
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ 
          session, 
          user: session?.user || null, 
          isLoading: false 
        });
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ isLoading: false });
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
        console.warn('Supabase update failed or offline. Updating store state locally.', error);
      }
      
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
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await authService.signOut();
      set({ session: null, user: null, isLoading: false });
    } catch (error) {
      console.error('Failed to sign out:', error);
      set({ isLoading: false });
    }
  },
}));
