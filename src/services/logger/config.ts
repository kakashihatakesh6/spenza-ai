import { LogLevel } from './types';

export interface LoggerConfig {
  minLevel: LogLevel;
  sensitiveKeys: string[];
}

export const loggerConfig: LoggerConfig = {
  // Debug in development, info in production
  minLevel: __DEV__ ? 'debug' : 'info',
  sensitiveKeys: [
    'password',
    'passwordConfirm',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'authorization',
    'key',
    'anonKey',
    'serviceRoleKey',
  ],
};

export const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
