import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { LogEntry, LogLevel, LogTransport } from './types';
import { loggerConfig, LOG_LEVEL_PRIORITIES } from './config';
import { sanitizeMetadata } from './utils';
import { ConsoleTransport } from './transports/consoleTransport';

const APP_VERSION = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || '1.0.0';
const PLATFORM = Platform.OS;

class Logger {
  private transports: LogTransport[] = [new ConsoleTransport()];

  public addTransport(transport: LogTransport) {
    this.transports.push(transport);
  }

  private shouldLog(level: LogLevel): boolean {
    const currentPriority = LOG_LEVEL_PRIORITIES[level];
    const minPriority = LOG_LEVEL_PRIORITIES[loggerConfig.minLevel];
    return currentPriority >= minPriority;
  }

  private createEntry(level: LogLevel, message: string, metadata?: any, tag?: string): LogEntry {
    let sanitizedMetadata = metadata;
    
    if (metadata !== undefined) {
      if (metadata instanceof Error) {
        sanitizedMetadata = {
          error: {
            message: metadata.message,
            name: metadata.name,
            stack: metadata.stack,
          }
        };
      } else {
        sanitizedMetadata = sanitizeMetadata(metadata, loggerConfig.sensitiveKeys);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      tag,
      metadata: sanitizedMetadata,
      appVersion: APP_VERSION,
      platform: PLATFORM,
    };
  }

  private dispatch(entry: LogEntry) {
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch (e) {
        console.error('Logger transport failure:', e);
      }
    }
  }

  public debug(message: string, metadata?: any, tag?: string) {
    if (!this.shouldLog('debug')) return;
    this.dispatch(this.createEntry('debug', message, metadata, tag));
  }

  public info(message: string, metadata?: any, tag?: string) {
    if (!this.shouldLog('info')) return;
    this.dispatch(this.createEntry('info', message, metadata, tag));
  }

  public warn(message: string, metadata?: any, tag?: string) {
    if (!this.shouldLog('warn')) return;
    this.dispatch(this.createEntry('warn', message, metadata, tag));
  }

  public error(message: string, error?: any, tag?: string) {
    if (!this.shouldLog('error')) return;
    this.dispatch(this.createEntry('error', message, error, tag));
  }
}

export const logger = new Logger();
