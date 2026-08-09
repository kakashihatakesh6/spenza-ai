export interface Expense {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  paymentMethod: string;
  currency: string;
  tax?: number;
  notes?: string;
  receiptImage?: string; // Local URI or empty
  createdAt: string;
  updatedAt: string;
  isSynced: number; // 0 or 1
}

export interface Category {
  id: string;
  name: string;
  icon: string; // MaterialCommunityIcons name
  color: string; // HEX color code
}

export interface Budget {
  id: string;
  category: string; // "All" or category name
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  notificationsEnabled: boolean;
  notificationHour: number;
  notificationMinute: number;
  budgetWarningEnabled: boolean;
  budgetWarningThreshold: number;
  biometricsEnabled: boolean;
}

export interface SpendingInsight {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success';
  date: string;
}
