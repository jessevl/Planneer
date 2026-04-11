/**
 * @file retry.ts
 * @description Retry utilities for API calls
 * @app SHARED - Network resilience
 *
 * Provides:
 * - Configurable retry logic for async operations
 * - Exponential backoff
 * - Error classification for retry decisions
 */

import { isRetryable, isSessionExpired, logError } from './errors';
import { RETRY } from './config';

export interface RetryOptions {
  /** Maximum number of retry attempts. Default from config */
  maxRetries?: number;
  /** Initial delay between retries in ms. Default from config */
  initialDelay?: number;
  /** Maximum delay between retries in ms. Default from config */
  maxDelay?: number;
  /** Backoff multiplier. Default from config */
  backoffFactor?: number;
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** Context for logging */
  context?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry' | 'context'>> = {
  maxRetries: RETRY.MAX_RETRIES,
  initialDelay: RETRY.INITIAL_DELAY_MS,
  maxDelay: RETRY.MAX_DELAY_MS,
  backoffFactor: RETRY.BACKOFF_FACTOR,
};

/**
 * Execute an async function with retry logic
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 * 
 * @example
 * const data = await withRetry(
 *   () => fetchTasks(),
 *   { maxRetries: 3, context: 'fetchTasks' }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffFactor = DEFAULT_OPTIONS.backoffFactor,
    shouldRetry = defaultShouldRetry,
    onRetry,
    context,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry session expired errors
      if (isSessionExpired(error)) {
        throw error;
      }

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(error, attempt)) {
        // Log retry attempt
        if (context) {
          logError(error, `${context}/retry`, { attempt: attempt + 1, delay });
        }

        // Call onRetry callback
        onRetry?.(error, attempt + 1, delay);

        // Wait before retrying
        await sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * backoffFactor, maxDelay);
      } else {
        // No more retries
        break;
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Default retry decision function
 */
function defaultShouldRetry(error: unknown, _attempt: number): boolean {
  return isRetryable(error);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a retryable version of an async function
 * 
 * @example
 * const fetchTasksWithRetry = makeRetryable(fetchTasks, { maxRetries: 3 });
 * const tasks = await fetchTasksWithRetry();
 */
export function makeRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => withRetry(() => fn(...args), options)) as T;
}

/**
 * Retry configuration presets for common scenarios
 */
export const RetryPresets = {
  /** Standard API calls - uses config defaults */
  standard: {
    maxRetries: RETRY.MAX_RETRIES,
    initialDelay: RETRY.INITIAL_DELAY_MS,
    backoffFactor: RETRY.BACKOFF_FACTOR,
  } as RetryOptions,

  /** Quick retries for real-time operations */
  quick: {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffFactor: RETRY.BACKOFF_FACTOR,
  } as RetryOptions,

  /** Aggressive retries for critical operations */
  aggressive: {
    maxRetries: 5,
    initialDelay: RETRY.INITIAL_DELAY_MS,
    maxDelay: 30000,
    backoffFactor: RETRY.BACKOFF_FACTOR,
  } as RetryOptions,

  /** No retries - fail fast */
  none: {
    maxRetries: 0,
  } as RetryOptions,
};
