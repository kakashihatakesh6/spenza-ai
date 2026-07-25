import { Platform } from 'react-native';

let isHandlerSet = false;

async function getNotifications() {
  const Notifications = await import('expo-notifications');
  if (!isHandlerSet) {
    isHandlerSet = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return Notifications;
}

export const notificationService = {
  /**
   * Request push notification permissions.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    const Notifications = await getNotifications();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  },

  /**
   * Trigger an immediate notification (e.g., when budget is exceeded).
   */
  async sendImmediateNotification(title: string, body: string, data?: Record<string, any>): Promise<string | undefined> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('Notifications permission not granted');
      return undefined;
    }

    const Notifications = await getNotifications();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: data || {},
      },
      trigger: null, // send immediately
    });
  },

  /**
   * Schedule a daily reminder to log expenses at a specific hour (e.g., 20:00).
   */
  async scheduleDailyReminder(hour: number = 20, minute: number = 0): Promise<string | undefined> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return undefined;

    // Cancel existing daily reminders first to avoid duplicates
    await this.cancelAllScheduledNotifications();

    const Notifications = await getNotifications();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Track Your Spending 💰',
        body: 'Did you make any purchases today? Take 10 seconds to scan your receipts or log them manually!',
        sound: true,
        data: { type: 'info', categoryName: 'REMINDER' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  },

  /**
   * Cancel all scheduled notifications.
   */
  async cancelAllScheduledNotifications(): Promise<void> {
    if (Platform.OS === 'web') return;
    const Notifications = await getNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  /**
   * Send a test budget exceeded notification.
   */
  async sendTestBudgetExceeded(category: string, amount: number, limit: number, symbol: string = '₹'): Promise<void> {
    await this.sendImmediateNotification(
      '🚨 Monthly Budget Exceeded!',
      `Your spending in ${category} (${symbol}${amount.toFixed(2)}) has gone over your monthly budget limit of ${symbol}${limit.toFixed(2)}.`,
      { type: 'security', categoryName: 'BUDGET' } // 'security' gets styled as red, which is nice for exceeded!
    );
  },

  /**
   * Send a test budget warning notification.
   */
  async sendTestBudgetWarning(category: string, percentage: number, symbol: string = '₹'): Promise<void> {
    await this.sendImmediateNotification(
      '⚠️ Budget Alert Approaching!',
      `You've used ${percentage}% of your monthly budget limit for ${category}. Control your spending to stay within your limits!`,
      { type: 'warning', categoryName: 'BUDGET' }
    );
  },

  /**
   * Send a test daily reminder notification.
   */
  async sendTestDailyReminder(): Promise<void> {
    await this.sendImmediateNotification(
      'Track Your Spending 💰',
      'Did you make any purchases today? Take 10 seconds to scan your receipts or log them manually!',
      { type: 'info', categoryName: 'REMINDER' }
    );
  },
};

