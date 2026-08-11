import { supabase } from '../lib/supabase';
import { NotificationItem } from '../store/notificationStore';
import { logger } from './logger';

export const notificationDbService = {
  /**
   * Save a notification strictly to Supabase database table `user_notifications`
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
        logger.error('Failed to insert notification into user_notifications table', error);
      }
    } catch (err) {
      logger.warn('Failed to save notification to DB', err);
    }
  },

  /**
   * Fetch persistent notifications strictly from Supabase database table `user_notifications`
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

      if (error) {
        logger.error('Failed to fetch notifications from user_notifications table', error);
        return [];
      }

      if (data && data.length > 0) {
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
    } catch (err) {
      logger.warn('Failed to fetch notifications from DB', err);
    }
    return [];
  },

  /**
   * Mark all notifications as read in Supabase database table `user_notifications`
   */
  async markAllAsReadInDb(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to mark notifications read in user_notifications table', error);
      }
    } catch (err) {
      logger.warn('Failed to mark notifications read in DB', err);
    }
  },

  /**
   * Clear all notifications in Supabase database table `user_notifications`
   */
  async clearAllInDb(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to clear notifications in user_notifications table', error);
      }
    } catch (err) {
      logger.warn('Failed to clear notifications in DB', err);
    }
  },
};
