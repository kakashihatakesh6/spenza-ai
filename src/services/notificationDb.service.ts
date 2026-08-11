import { supabase } from '../lib/supabase';
import { NotificationItem } from '../store/notificationStore';
import { logger } from './logger';

export const notificationDbService = {
  /**
   * Save a notification to Supabase database table `user_notifications` (with user_metadata fallback)
   */
  async saveNotificationToDb(notification: Omit<NotificationItem, 'id' | 'time' | 'read'>, userId: string): Promise<void> {
    if (!userId) return;
    try {
      const { error } = await supabase.from('user_notifications').insert({
        user_id: userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        category_name: notification.categoryName,
        read: false,
      });

      if (error) {
        // Fallback: If user_notifications table doesn't exist yet, save to user_metadata
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const current: NotificationItem[] = user.user_metadata?.notifications || [];
          const updated = [
            {
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              title: notification.title,
              message: notification.message,
              type: notification.type,
              categoryName: notification.categoryName,
              time: 'Just now',
              read: false,
            },
            ...current,
          ].slice(0, 50);

          await supabase.auth.updateUser({
            data: { notifications: updated },
          }).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn('Failed to save notification to DB', err);
    }
  },

  /**
   * Fetch persistent notifications from Supabase DB table or metadata
   */
  async fetchNotificationsFromDb(userId: string): Promise<NotificationItem[]> {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id || String(Date.now()),
          title: row.title,
          message: row.message,
          type: row.type || 'info',
          categoryName: row.category_name || 'ALERT',
          time: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
          read: !!row.read,
        }));
      }

      // Fallback to user_metadata notifications if table isn't populated
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.notifications) {
        return user.user_metadata.notifications;
      }
    } catch (err) {
      logger.warn('Failed to fetch notifications from DB', err);
    }
    return [];
  },

  /**
   * Mark all notifications as read in DB
   */
  async markAllAsReadInDb(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', userId);
    } catch (err) {
      logger.warn('Failed to mark notifications read in DB', err);
    }
  },

  /**
   * Clear all notifications in DB and metadata
   */
  async clearAllInDb(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', userId);

      await supabase.auth.updateUser({
        data: { notifications: [] },
      }).catch(() => {});
    } catch (err) {
      logger.warn('Failed to clear notifications in DB', err);
    }
  },
};
