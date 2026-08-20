import { withRetry, calculateFullJitter, isRetryableError } from '../src/retry.js'
import { JoaraApiError, JoaraNetworkError, JoaraRateLimitError, JoaraValidationError } from '../src/errors.js'

describe('Retry 모듈 단위 테스트', () => {
    test('calculateFullJitter 범위 검증', () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const delay = calculateFullJitter(attempt, 100, 1000)
            expect(delay).toBeGreaterThanOrEqual(0)
            expect(delay).toBeLessThanOrEqual(1000)
        }
    })

    test('isRetryableError 판별 로직 검증', () => {
        expect(isRetryableError(new JoaraRateLimitError('Rate limit'))).toBe(true)
        expect(isRetryableError(new JoaraNetworkError('Network error'))).toBe(true)
        expect(isRetryableError(new JoaraApiError('Server error', 500))).toBe(true)
        expect(isRetryableError(new JoaraApiError('Too many requests', 429))).toBe(true)
        expect(isRetryableError(new JoaraValidationError('Invalid query'))).toBe(false)
        expect(isRetryableError(new JoaraApiError('Not found', 404))).toBe(false)
    })

    test('withRetry 성공 시 즉시 반환', async () => {
        let callCount = 0
        const result = await withRetry(async () => {
            callCount++
            return 'success'
        }, {
            maxRetries: 3,
            baseDelayMs: 10,
            maxDelayMs: 50
        })

        expect(result).toBe('success')
        expect(callCount).toBe(1)
    })

    test('withRetry 일시적 실패 후 재시도 성공', async () => {
        let callCount = 0
        const result = await withRetry(async () => {
            callCount++
            if (callCount < 3) {
                throw new JoaraNetworkError('Temporary socket error')
            }
            return 'recovered'
        }, {
            maxRetries: 3,
            baseDelayMs: 5,
            maxDelayMs: 20
        })

        expect(result).toBe('recovered')
        expect(callCount).toBe(3)
    })

    test('withRetry 최대 재시도 횟수 초과 시 에러 발생', async () => {
        let callCount = 0
        await expect(withRetry(async () => {
            callCount++
            throw new JoaraNetworkError('Persistent error')
        }, {
            maxRetries: 2,
            baseDelayMs: 5,
            maxDelayMs: 20
        })).rejects.toThrow('Persistent error')

        expect(callCount).toBe(3) // 최초 1회 + 재시도 2회
    })
})
