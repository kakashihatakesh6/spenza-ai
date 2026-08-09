import { create } from 'zustand';
import { Settings } from '../types';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { logger } from '../services/logger';

interface SettingsState {
  settings: Settings;
  fetchSettings: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCurrency: (currency: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotificationTime: (hour: number, minute: number) => void;
  setBudgetWarningEnabled: (enabled: boolean) => void;
  setBudgetWarningThreshold: (threshold: number) => void;
  setBiometricsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    theme: 'system',
    currency: 'INR',
    notificationsEnabled: true,
    notificationHour: 20,
    notificationMinute: 0,
    budgetWarningEnabled: true,
    budgetWarningThreshold: 80,
    biometricsEnabled: false,
  },
  fetchSettings: () => {
    try {
      const settings = expenseRepository.getSettings();
      set({ settings });
    } catch (error) {
      logger.error('Error fetching settings from database', error);
    }
  },
  setTheme: (theme) => {
    try {
      expenseRepository.saveSetting('theme', theme);
      set((state) => ({ settings: { ...state.settings, theme } }));
      logger.info('Theme changed', { theme });
    } catch (error) {
      logger.error('Error saving theme setting', error);
    }
  },
  setCurrency: (currency) => {
    try {
      expenseRepository.saveSetting('currency', currency);
      set((state) => ({ settings: { ...state.settings, currency } }));
      logger.info('Currency changed', { currency });
    } catch (error) {
      logger.error('Error saving currency setting', error);
    }
  },
  setNotificationsEnabled: (enabled) => {
    try {
      expenseRepository.saveSetting('notificationsEnabled', String(enabled));
      set((state) => ({ settings: { ...state.settings, notificationsEnabled: enabled } }));
      logger.info(enabled ? 'Notifications enabled' : 'Notifications disabled');
    } catch (error) {
      logger.error('Error saving notificationsEnabled setting', error);
    }
  },
  setNotificationTime: (hour, minute) => {
    try {
      expenseRepository.saveSetting('notificationHour', String(hour));
      expenseRepository.saveSetting('notificationMinute', String(minute));
      set((state) => ({
        settings: {
          ...state.settings,
          notificationHour: hour,
          notificationMinute: minute,
        },
      }));
      logger.info('Settings saved');
    } catch (error) {
      logger.error('Error saving notificationTime setting', error);
    }
  },
  setBudgetWarningEnabled: (enabled) => {
    try {
      expenseRepository.saveSetting('budgetWarningEnabled', String(enabled));
      set((state) => ({
        settings: { ...state.settings, budgetWarningEnabled: enabled },
      }));
      logger.info('Settings saved');
    } catch (error) {
      logger.error('Error saving budgetWarningEnabled setting', error);
    }
  },
  setBudgetWarningThreshold: (threshold) => {
    try {
      expenseRepository.saveSetting('budgetWarningThreshold', String(threshold));
      set((state) => ({
        settings: { ...state.settings, budgetWarningThreshold: threshold },
      }));
      logger.info('Settings saved');
    } catch (error) {
      logger.error('Error saving budgetWarningThreshold setting', error);
    }
  },
  setBiometricsEnabled: (enabled) => {
    try {
      expenseRepository.saveSetting('biometricsEnabled', String(enabled));
      set((state) => ({
        settings: { ...state.settings, biometricsEnabled: enabled },
      }));
      logger.info(enabled ? 'Biometrics security enabled' : 'Biometrics security disabled');
    } catch (error) {
      logger.error('Error saving biometricsEnabled setting', error);
    }
  },
}));
