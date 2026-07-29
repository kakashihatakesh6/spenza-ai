import { Platform } from 'react-native';

type NetworkCallback = (isOnline: boolean) => void;

class NetworkMonitor {
  private isOnlineState = true;
  private listeners = new Set<NetworkCallback>();
  private checkInterval: any = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        this.isOnlineState = window.navigator.onLine;
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
      }
    } else {
      // Periodic ping for native platforms to check internet state
      this.startPingInterval();
    }
  }

  private handleOnline = () => {
    if (!this.isOnlineState) {
      this.isOnlineState = true;
      this.notifyListeners();
    }
  };

  private handleOffline = () => {
    if (this.isOnlineState) {
      this.isOnlineState = false;
      this.notifyListeners();
    }
  };

  private async checkConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(id);
      return response.ok;
    } catch {
      return false;
    }
  }

  private startPingInterval() {
    // Initial check
    this.checkConnectivity().then(online => {
      this.isOnlineState = online;
    });

    this.checkInterval = setInterval(async () => {
      const online = await this.checkConnectivity();
      if (online !== this.isOnlineState) {
        this.isOnlineState = online;
        this.notifyListeners();
      }
    }, 15000); // Check every 15 seconds
  }

  public get isOnline(): boolean {
    return this.isOnlineState;
  }

  public addListener(callback: NetworkCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    for (const callback of this.listeners) {
      try {
        callback(this.isOnlineState);
      } catch {
        // Ignore callback errors
      }
    }
  }

  public cleanup() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
      }
    } else {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
    }
  }
}

export const networkMonitor = new NetworkMonitor();
