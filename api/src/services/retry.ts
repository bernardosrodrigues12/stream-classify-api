import { AppError } from '../errors/app-error.js';

export interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    random?: () => number;
    sleep?: (ms: number) => Promise<void>;
}

const DEFAULTS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function backoffDelay(attempt: number, options: RetryOptions): number {
    const random = options.random ?? Math.random;
    const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
    return Math.floor(random() * exponential);
}

export async function withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
): Promise<T> {
    const config: RetryOptions = { ...DEFAULTS, ...options};
    const sleep = config.sleep ?? defaultSleep;

    for (let attempt = 1; ; attempt++) {
        try {
            return await operation();
        } catch (error) {
            const retryable = error instanceof AppError && error.retryable;
            const hasAttemptsLeft = attempt < config.maxAttempts;

            if (!retryable || !hasAttemptsLeft) {
                throw error;
            }

            await sleep(backoffDelay(attempt, config))
        }
    }
}