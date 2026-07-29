import { LogEntry, LogTransport } from '../types';

export class ConsoleTransport implements LogTransport {
  log(entry: LogEntry): void {
    const { timestamp, level, message, tag, metadata } = entry;
    
    // Formatting: 2026-07-27T10:30:21Z | INFO | Auth | User authenticated
    const tagPart = tag ? ` | ${tag}` : '';
    const formattedMessage = `${timestamp} | ${level.toUpperCase()}${tagPart} | ${message}`;
    
    switch (level) {
      case 'debug':
        if (__DEV__) {
          console.log(formattedMessage, metadata ? '\nMetadata: ' + JSON.stringify(metadata, null, 2) : '');
        }
        break;
      case 'info':
        console.log(formattedMessage, metadata ? '\nMetadata: ' + JSON.stringify(metadata, null, 2) : '');
        break;
      case 'warn':
        console.warn(formattedMessage, metadata ? '\nMetadata: ' + JSON.stringify(metadata, null, 2) : '');
        break;
      case 'error':
        // Development: verbose logs including error stacks (usually stored in metadata)
        // Production: normal logs
        if (__DEV__) {
          console.error(formattedMessage, metadata ? '\nMetadata: ' + JSON.stringify(metadata, null, 2) : '');
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }
}
