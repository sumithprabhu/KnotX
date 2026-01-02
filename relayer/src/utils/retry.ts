import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        logger.error(
          { attempt, maxAttempts, error: lastError },
          'Max retry attempts reached'
        );
        throw lastError;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      logger.warn(
        { attempt, maxAttempts, delay: currentDelay, error: lastError },
        'Retrying operation'
      );

      await sleep(currentDelay);
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError!;
}
