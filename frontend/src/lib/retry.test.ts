/**
 * @file retry.test.ts
 * @description Tests for retry utilities
 * @app SHARED - Network resilience
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry, makeRetryable, RetryPresets } from './retry';
import { NetworkError, SessionExpiredError } from './errors';

describe('retry', () => {
  describe('withRetry', () => {
    it('returns result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, { 
        maxRetries: 3,
        initialDelay: 1, // Very short for test speed
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new NetworkError('Always fails'));
      
      await expect(withRetry(fn, { 
        maxRetries: 2,
        initialDelay: 1,
        backoffFactor: 1,
      })).rejects.toThrow('Always fails');
      
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('does not retry session expired errors', async () => {
      const fn = vi.fn().mockRejectedValue(new SessionExpiredError());
      
      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 400 }); // Validation error
      
      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual({ status: 400 });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError('error1'))
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      
      await withRetry(fn, {
        maxRetries: 2,
        initialDelay: 1,
        onRetry,
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(NetworkError),
        1, // attempt number
        1 // delay
      );
    });

    it('uses custom shouldRetry function', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('retry me'))
        .mockRejectedValueOnce(new Error('stop here'))
        .mockResolvedValue('success');
      
      const shouldRetry = vi.fn().mockImplementation(
        (error: Error) => error.message === 'retry me'
      );
      
      await expect(withRetry(fn, {
        maxRetries: 3,
        initialDelay: 1,
        shouldRetry,
      })).rejects.toThrow('stop here');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries 500 server errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, { 
        maxRetries: 1,
        initialDelay: 1,
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('makeRetryable', () => {
    it('wraps function with retry logic', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError())
        .mockResolvedValue('result');
      
      const retryableFn = makeRetryable(fn, { 
        maxRetries: 1,
        initialDelay: 1,
      });
      
      const result = await retryableFn();
      
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('passes arguments through', async () => {
      const fn = vi.fn().mockImplementation(
        (a: number, b: string) => Promise.resolve(`${a}-${b}`)
      );
      
      const retryableFn = makeRetryable(fn, { maxRetries: 0 });
      
      const result = await retryableFn(42, 'test');
      
      expect(result).toBe('42-test');
      expect(fn).toHaveBeenCalledWith(42, 'test');
    });
  });

  describe('RetryPresets', () => {
    it('has standard preset', () => {
      expect(RetryPresets.standard).toBeDefined();
      expect(RetryPresets.standard.maxRetries).toBeGreaterThan(0);
    });

    it('has quick preset with fewer retries', () => {
      expect(RetryPresets.quick).toBeDefined();
      expect(RetryPresets.quick.maxRetries).toBe(2);
      expect(RetryPresets.quick.initialDelay).toBe(500);
    });

    it('has aggressive preset with more retries', () => {
      expect(RetryPresets.aggressive).toBeDefined();
      expect(RetryPresets.aggressive.maxRetries).toBe(5);
      expect(RetryPresets.aggressive.maxDelay).toBe(30000);
    });

    it('has none preset for no retries', () => {
      expect(RetryPresets.none).toBeDefined();
      expect(RetryPresets.none.maxRetries).toBe(0);
    });
  });
});
