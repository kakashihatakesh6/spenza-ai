import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../services/logger';

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
  addNotification: (notification: Omit<NotificationItem, 'id' | 'time' | 'read'>) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleRead: (id: string) => void;
  markAsRead: (id: string) => void;
  deleteNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
}

const STORAGE_KEY = 'spendly_notifications';

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  loadNotifications: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ notifications: JSON.parse(stored) });
      }
    } catch (e) {
      logger.warn('Failed to load notifications from AsyncStorage', e);
    }
  },

  addNotification: (notification) => {
    set((state) => {
      const newNotification: NotificationItem = {
        ...notification,
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        time: 'Just now',
        read: false,
      };
      const updated = [newNotification, ...state.notifications];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to save notification to AsyncStorage', e)
      );
      return { notifications: updated };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        logger.warn('Failed to update notifications in AsyncStorage', e)
      );
      return { notifications: updated };
    });
  },

  clearAll: () => {
    set({ notifications: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch((e) =>
      logger.warn('Failed to clear notifications in AsyncStorage', e)
    );
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
