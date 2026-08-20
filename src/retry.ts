import { JoaraApiError, JoaraNetworkError, JoaraRateLimitError, JoaraTimeoutError } from './errors.js'
import { Logger, RetryInterceptor } from './types.js'

export interface RetryConfig {
    maxRetries: number
    baseDelayMs: number
    maxDelayMs: number
    logger?: Logger
    onRetry?: RetryInterceptor
    url?: string
}

export function calculateFullJitter(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
    return Math.floor(Math.random() * (exponentialDelay + 1))
}

export function isRetryableError(error: unknown): boolean {
    if (error instanceof JoaraRateLimitError) {
        return true
    }

    if (error instanceof JoaraTimeoutError || error instanceof JoaraNetworkError) {
        return true
    }

    if (error instanceof JoaraApiError) {
        return error.status === 429 || error.status >= 500
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase()
        return (
            message.includes('econnreset') ||
            message.includes('etimedout') ||
            message.includes('fetch failed') ||
            message.includes('network') ||
            message.includes('socket')
        )
    }

    return false
}

export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
    let lastError: Error = new Error('Unknown retry error')

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))

            if (attempt === config.maxRetries || !isRetryableError(lastError)) {
                throw lastError
            }

            let delayMs = calculateFullJitter(attempt, config.baseDelayMs, config.maxDelayMs)

            if (lastError instanceof JoaraRateLimitError && lastError.retryAfterMs) {
                delayMs = Math.max(delayMs, lastError.retryAfterMs)
            }

            config.logger?.warn(`[재시도 ${attempt + 1}/${config.maxRetries}] ${config.url || 'API 요청'} ${delayMs}ms 후 재시도 (${lastError.message})`)

            if (config.onRetry) {
                try {
                    await config.onRetry({
                        url: config.url || '',
                        error: lastError,
                        attempt: attempt + 1,
                        delayMs
                    })
                } catch {
                    // 인터셉터 오류 무시
                }
            }

            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    throw lastError
}
