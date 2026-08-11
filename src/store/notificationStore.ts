import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../services/logger';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import { notificationDbService } from '../services/notificationDb.service';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'success' | 'security' | 'info';
  categoryName: string;
  time: string;
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id' | 'time' | 'read'>, skipBroadcast?: boolean) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleRead: (id: string) => void;
  markAsRead: (id: string) => void;
  deleteNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
}

const STORAGE_KEY = 'spendly_notifications';

let notificationChannel: any = null;

export const subscribeRealtimeNotifications = (userId: string) => {
  if (!userId) return () => {};

  if (notificationChannel) {
    try {
      supabase.removeChannel(notificationChannel);
    } catch {}
  }

  notificationChannel = supabase
    .channel(`user-notifications-${userId}`)
    .on('broadcast', { event: 'new_notification' }, ({ payload }) => {
      if (payload && (payload.title || payload.message)) {
        const state = useNotificationStore.getState();
        const exists = state.notifications.some(
          (n) => n.title === payload.title && n.message === payload.message
        );
        if (!exists) {
          state.addNotification(payload, true);
          notificationService.sendImmediateNotification(payload.title, payload.message, {
            type: payload.type,
            categoryName: payload.categoryName,
          }).catch(() => {});
        }
      }
    })
    .subscribe();

  return () => {
    if (notificationChannel) {
      try {
        supabase.removeChannel(notificationChannel);
      } catch {}
      notificationChannel = null;
    }
  };
};

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  loadNotifications: async () => {
    try {
      // 1. Load from local AsyncStorage first for immediate rendering
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: NotificationItem[] = JSON.parse(stored);
        const valid = parsed.filter((n) => (n.title && n.title.trim()) || (n.message && n.message.trim()));
        set({ notifications: valid });
      }

      // 2. Fetch persistent notifications from Supabase DB in background and merge
      try {
        const { useAuthStore } = require('./authStore');
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          const dbItems = await notificationDbService.fetchNotificationsFromDb(userId);
          if (dbItems && dbItems.length > 0) {
            set((state) => {
              const mergedMap = new Map<string, NotificationItem>();
              [...dbItems, ...state.notifications].forEach((n) => {
                const key = `${n.title}_${n.message}`;
                if (!mergedMap.has(key)) {
                  mergedMap.set(key, n);
                }
              });
              const updated = Array.from(mergedMap.values());
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
              return { notifications: updated };
            });
          }
        }
      } catch (err) {
        logger.warn('Failed to sync DB notifications on load', err);
      }
    } catch (e) {
      logger.warn('Failed to load notifications from AsyncStorage', e);
    }
  },

  addNotification: (notification, skipBroadcast = false) => {
    const title = notification.title?.trim();
    const message = notification.message?.trim();
    // STRICT GUARD: Ignore blank notifications with no title and no description
    if (!title && !message) {
      return;
    }

    const newNotification: NotificationItem = {
      ...notification,
      title: title || 'Notification',
      message: message || '',
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      time: 'Just now',
      read: false,
    };

    let didAdd = false;
    set((state) => {
      const isDuplicate = state.notifications.some(
        (n) => n.title.trim() === newNotification.title.trim() && n.message.trim() === newNotification.message.trim()
      );
      if (isDuplicate) {
        return state;
      }
      didAdd = true;
      const updated = [newNotification, ...state.notifications];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to save notification to AsyncStorage', e)
      );
      return { notifications: updated };
    });

    if (didAdd) {
      // Trigger native OS push notification banner EXACTLY ONCE
      notificationService.sendImmediateNotification(newNotification.title, newNotification.message, {
        type: newNotification.type,
        categoryName: newNotification.categoryName,
      }).catch((e) => logger.warn('Failed to trigger push notification banner', e));

      // Save notification to Supabase DB in background
      try {
        const { useAuthStore } = require('./authStore');
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          notificationDbService.saveNotificationToDb(newNotification, userId);
        }
      } catch {}
    }
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to update notifications in AsyncStorage', e)
      );
      return { notifications: updated };
    });

    try {
      const { useAuthStore } = require('./authStore');
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        notificationDbService.markAllAsReadInDb(userId);
      }
    } catch {}
  },

  clearAll: () => {
    set({ notifications: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch((e) =>
      logger.warn('Failed to clear notifications in AsyncStorage', e)
    );

    try {
      const { useAuthStore } = require('./authStore');
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        notificationDbService.clearAllInDb(userId);
      }
    } catch {}
  },

  toggleRead: (id: string) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: !n.read } : n
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to toggle notification in AsyncStorage', e)
      );
      return { notifications: updated };
    });
  },

  markAsRead: (id: string) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to mark notification as read in AsyncStorage', e)
      );
      return { notifications: updated };
    });
  },

  deleteNotification: (id: string) => {
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to delete notification from AsyncStorage', e)
      );
      return { notifications: updated };
    });
  },
}));
