import { logger } from '../services/logger';

export interface RetryOptions {
  retries?: number;
  delay?: number;
  backoff?: boolean;
}

export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = true } = options;
  let attempt = 0;

  while (true) {
    try {
      const result = await requestFn();
      if (attempt > 0) {
        logger.info('Retry succeeded', { attempt }, 'Network');
      }
      return result;
    } catch (error) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      logger.info('Retry started', { attempt, nextDelay: waitTime, error: String(error) }, 'Network');
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
