import { JoaraApiError, JoaraNetworkError, JoaraRateLimitError, JoaraTimeoutError } from './errors.js'
import { Logger, RetryInterceptor } from './types.js'

/**
 * 지수 백오프 재시도 설정 인터페이스입니다.
 */
export interface RetryConfig {
    /** 최대 재시도 횟수 */
    maxRetries: number
    /** 기본 재시도 대기 시간 (밀리초) */
    baseDelayMs: number
    /** 최대 재시도 대기 시간 (밀리초) */
    maxDelayMs: number
    /** 로그 출력을 위한 로거 인스턴스 */
    logger?: Logger
    /** 재시도 시 호출될 콜백 인터셉터 */
    onRetry?: RetryInterceptor
    /** 요청 대상 URL (로그용) */
    url?: string
}

/**
 * Full Jitter 알고리즘을 사용하여 지수 백오프 딜레이를 계산합니다.
 * 계산식: random_between(0, min(maxDelay, baseDelay * 2^attempt))
 *
 * @param attempt - 현재 재시도 회차 (0부터 시작)
 * @param baseDelayMs - 기본 대기 시간 (밀리초)
 * @param maxDelayMs - 최대 허용 대기 시간 (밀리초)
 * @returns 무작위 지연 시간 (밀리초)
 */
export function calculateFullJitter(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
    return Math.floor(Math.random() * (exponentialDelay + 1))
}

/**
 * 발생한 에러가 일시적인 오류로서 재시도 가능한 에러인지 판별합니다.
 *
 * @param error - 검사할 에러 객체
 * @returns 재시도 가능 여부
 */
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

/**
 * 전달받은 비동기 작업을 Full Jitter 지수 백오프 기반으로 재시도 실행합니다.
 *
 * @param fn - 실행할 비동기 함수
 * @param config - 재시도 설정 객체
 * @returns 비동기 함수의 반환값
 * @throws 최대 재시도 횟수 초과 또는 재시도 불가능한 에러 발생 시 예외 발생
 */
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
