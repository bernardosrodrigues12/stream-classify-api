export type ErrorCode =
    | 'rate_limited'
    | 'timeout'
    | 'provider_error'
    | 'invalid_output';

export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
        readonly retryable: boolean,
    ) {
        super(message);
        this.name = 'AppError';
    }
}