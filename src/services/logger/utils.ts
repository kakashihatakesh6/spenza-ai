/**
 * Sanitizes metadata by recursively masking sensitive keys.
 */
export function sanitizeMetadata(data: any, sensitiveKeys: string[]): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeMetadata(item, sensitiveKeys));
  }

  // Handle Error objects
  if (data instanceof Error) {
    return {
      message: data.message,
      name: data.name,
      stack: data.stack,
    };
  }

  const sanitized: Record<string, any> = {};
  const lowerSensitiveKeys = sensitiveKeys.map(k => k.toLowerCase());

  for (const key of Object.keys(data)) {
    const isSensitive = lowerSensitiveKeys.includes(key.toLowerCase());
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeMetadata(data[key], sensitiveKeys);
    }
  }
  return sanitized;
}

/**
 * Formats error/stack traces.
 */
export function formatError(error: any): Record<string, any> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  if (typeof error === 'object' && error !== null) {
    return {
      message: error.message || JSON.stringify(error),
      ...error,
    };
  }
  return { message: String(error) };
}
