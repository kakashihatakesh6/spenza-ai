import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { useNotificationStore } from '../store/notificationStore';

export interface SessionItem {
  id: string;
  device: string;
  location: string;
  ip: string;
  time: string;
  isCurrent: boolean;
  type: 'mobile' | 'desktop';
  lastActiveAt: string;
}

const DEVICE_ID_KEY = '@spendly_device_id';

export const sessionService = {
  /**
   * Get or generate a persistent unique ID for this device installation
   */
  async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch {
      return 'local-device-id';
    }
  },

  /**
   * Get dynamic device information for the current hardware/browser
   */
  getDeviceNameAndType(): { deviceName: string; type: 'mobile' | 'desktop' } {
    if (Platform.OS === 'web') {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      let browser = 'Web Browser';
      if (ua.includes('Chrome')) browser = 'Chrome Browser';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari Browser';
      else if (ua.includes('Firefox')) browser = 'Firefox Browser';
      else if (ua.includes('Edg')) browser = 'Edge Browser';

      let os = 'Desktop';
      if (ua.includes('Macintosh')) os = 'macOS';
      else if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      return {
        deviceName: `${os} ${browser}`,
        type: isMobile ? 'mobile' : 'desktop',
      };
    }

    const brand = Device.brand || Device.manufacturer || '';
    const model = Device.modelName || Device.designName || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device');
    const fullModel = brand && !model.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${model}` : model;

    const isTablet = Device.deviceType === Device.DeviceType.TABLET;
    const type: 'mobile' | 'desktop' = isTablet ? 'desktop' : 'mobile';

    return {
      deviceName: fullModel,
      type,
    };
  },

  /**
   * Fetch public IP and approximate location (graceful fallback)
   */
  async getNetworkDetails(): Promise<{ ip: string; location: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const city = data.city || '';
        const country = data.country_name || '';
        const location = city && country ? `${city}, ${country}` : country || city || 'Current Location';
        return {
          ip: data.ip || 'Connected',
          location,
        };
      }
    } catch {
      // Fallback if network request fails or times out
    }
    return {
      ip: 'Connected',
      location: 'Local Device',
    };
  },

  /**
   * Register or refresh the current device session in user metadata upon login
   */
  async registerCurrentDevice(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const deviceId = await this.getDeviceId();
      const { deviceName, type } = this.getDeviceNameAndType();
      const now = new Date().toISOString();

      let storedDevices: any[] = user.user_metadata?.active_devices || [];

      // If current device is already registered and updated within last 30 minutes, skip API update to avoid event loops
      const existing = storedDevices.find((d) => d.id === deviceId);

      if (existing) {
        const lastActiveTime = new Date(existing.lastActiveAt || 0).getTime();
        const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
        if (lastActiveTime > thirtyMinsAgo) {
          return;
        }
      }

      const network = await this.getNetworkDetails();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      storedDevices = storedDevices.filter((d) => {
        const time = new Date(d.lastActiveAt || 0).getTime();
        return time > thirtyDaysAgo && d.id !== deviceId;
      });

      const currentDeviceObj = {
        id: deviceId,
        device: deviceName,
        location: network.location,
        ip: network.ip,
        type,
        lastActiveAt: now,
      };

      const updatedDevices = [currentDeviceObj, ...storedDevices];

      await supabase.auth.updateUser({
        data: {
          active_devices: updatedDevices,
        },
      });
      logger.info('Registered current device session', { deviceId, deviceName });
    } catch (err) {
      logger.warn('Failed to register current device session', err);
    }
  },

  /**
   * Unregister current device session from active_devices metadata on sign out
   */
  async unregisterCurrentDevice(): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.user_metadata?.active_devices) {
        const storedDevices = (user.user_metadata.active_devices || []).filter((d: any) => d.id !== deviceId);
        await supabase.auth.updateUser({
          data: { active_devices: storedDevices }
        }).catch(() => {});
      }
    } catch (err) {
      logger.warn('Failed to unregister current device session', err);
    }
  },

  /**
   * Fetch all active sessions for the current user from Supabase metadata (Read-Only)
   */
  async getActiveSessions(): Promise<SessionItem[]> {
    try {
      // Fetch fresh user data directly from Supabase server (not stale local cache)
      const { data: { user }, error } = await supabase.auth.getUser();
      
      const deviceId = await this.getDeviceId();
      const { deviceName, type } = this.getDeviceNameAndType();
      const network = await this.getNetworkDetails();
      const now = new Date().toISOString();

      const currentSessionItem: SessionItem = {
        id: deviceId,
        device: deviceName,
        location: network.location,
        ip: network.ip,
        time: 'Active now',
        isCurrent: true,
        type,
        lastActiveAt: now,
      };

      if (error || !user) {
        return [currentSessionItem];
      }

      // Read stored active devices from user_metadata
      let storedDevices: any[] = user.user_metadata?.active_devices || [];

      // Filter out stale devices older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      storedDevices = storedDevices.filter((d) => {
        const time = new Date(d.lastActiveAt || 0).getTime();
        return time > thirtyDaysAgo && d.id !== deviceId;
      });

      // Format relative time for other sessions
      const formattedOtherSessions = storedDevices.map((d) => ({
        id: d.id,
        device: d.device,
        location: d.location || 'Local Device',
        ip: d.ip || 'Connected',
        time: formatRelativeTime(d.lastActiveAt),
        isCurrent: false,
        type: (d.type as 'mobile' | 'desktop') || 'mobile',
        lastActiveAt: d.lastActiveAt || now,
      }));

      return [currentSessionItem, ...formattedOtherSessions];
    } catch (error) {
      logger.error('Failed to get active sessions', error);
      const { deviceName, type } = this.getDeviceNameAndType();
      return [
        {
          id: 'current',
          device: deviceName,
          location: 'Local Device',
          ip: 'Connected',
          time: 'Active now',
          isCurrent: true,
          type,
          lastActiveAt: new Date().toISOString(),
        },
      ];
    }
  },

  /**
   * Terminate all other sessions via Supabase Auth + metadata update
   */
  async terminateOtherSessions(): Promise<void> {
    try {
      // 1. Call Supabase Auth to invalidate all other refresh tokens for this user
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) {
        logger.warn('Supabase signOut scope others notice:', error.message);
      }

      // 2. Keep only current device in user_metadata
      const deviceId = await this.getDeviceId();
      const { deviceName, type } = this.getDeviceNameAndType();
      const network = await this.getNetworkDetails();
      const now = new Date().toISOString();

      const currentSessionItem: SessionItem = {
        id: deviceId,
        device: deviceName,
        location: network.location,
        ip: network.ip,
        time: 'Active now',
        isCurrent: true,
        type,
        lastActiveAt: now,
      };

      await supabase.auth.updateUser({
        data: {
          active_devices: [{
            id: currentSessionItem.id,
            device: currentSessionItem.device,
            location: currentSessionItem.location,
            ip: currentSessionItem.ip,
            type: currentSessionItem.type,
            lastActiveAt: currentSessionItem.lastActiveAt,
          }],
        },
      });
    } catch (error) {
      logger.error('Failed to terminate other sessions', error);
      throw error;
    }
  },

  /**
   * Terminate a specific session by ID
   */
  async terminateSession(sessionId: string): Promise<void> {
    const deviceId = await this.getDeviceId();
    if (sessionId === deviceId) {
      // Current session - sign out locally
      const { useAuthStore } = require('../store/authStore');
      await useAuthStore.getState().signOut();
      return;
    }

    // Call sign out others on Supabase Auth & update stored list
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) {
        logger.warn('Supabase signOut scope others notice:', error.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      let storedDevices: SessionItem[] = user?.user_metadata?.active_devices || [];
      storedDevices = storedDevices.filter((d) => d.id !== sessionId);

      await supabase.auth.updateUser({
        data: {
          active_devices: storedDevices,
        },
      });
    } catch (err) {
      logger.error('Failed to terminate specific session', err);
      throw err;
    }
  },
};

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Recently';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 5) return 'Just now';
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(isoString).toLocaleDateString();
}
