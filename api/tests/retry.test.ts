import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import { backoffDelay, withRetry } from '../src/services/retry.js';

const noSleep = async () => {};

describe('backoffDelay', () => {
    const options = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 300 };

    it('grows exponentially and stops at the cap', () => {
        const random = () => 1;
        expect(backoffDelay(1, { ...options, random })).toBe(100);
        expect(backoffDelay(2, { ...options, random })).toBe(200);
        expect(backoffDelay(3, { ...options, random })).toBe(300);
        expect(backoffDelay(4, { ...options, random })).toBe(300);
    });

    it('applies jitter within the interval', () => {
        expect(backoffDelay(2, { ...options, random: () => 0 })).toBe(0);
        expect(backoffDelay(2, { ...options, random: () => 0.5 })).toBe(100);
    });
});

describe('withRetry', () => {

    it('retries retryable erros until the operation succeeds', async () => {
        const operation = vi
            .fn()
            .mockRejectedValueOnce(new AppError('rate_limited', 'limit', true))
            .mockRejectedValueOnce(new AppError('timeout', 'slot', true))
            .mockResolvedValueOnce('ok')

        await expect(withRetry(operation, { sleep: noSleep, random: () => 0 })).resolves.toBe('ok');
        expect(operation).toHaveBeenCalledTimes(3);
    });

    it('gives up after maxAttempts', async () => {
         const error = new AppError('provider_error', 'down', true);
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withRetry(operation, { sleep: noSleep, random: () => 0 })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const error = new AppError('provider_error', 'bad request', false);
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withRetry(operation, { sleep: noSleep, random: () => 0 })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry errors that are not AppError', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('unexpected'));

    await expect(withRetry(operation, { sleep: noSleep, random: () => 0 })).rejects.toThrow('unexpected');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('waits with the backoff delay between attempts', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new AppError('timeout', 'slow', true))
      .mockRejectedValueOnce(new AppError('timeout', 'slow', true))
      .mockResolvedValueOnce('ok');

    await withRetry(operation, { baseDelayMs: 100, maxDelayMs: 1000, sleep, random: () => 0.5 });

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([50, 100]);
  });
});