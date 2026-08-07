export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  tag?: string;
  metadata?: Record<string, any>;
  appVersion: string;
  platform: string;
}

export interface LogTransport {
  log(entry: LogEntry): void;
}
