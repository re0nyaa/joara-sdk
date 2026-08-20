import {
    JoaraError,
    JoaraApiError,
    JoaraNetworkError,
    JoaraTimeoutError,
    JoaraRateLimitError,
    JoaraValidationError
} from '../src/errors.js'

describe('Joara 에러 계층 테스트', () => {
    test('JoaraError 기본 상속 확인', () => {
        const err = new JoaraError('기본 에러')
        expect(err).toBeInstanceOf(Error)
        expect(err).toBeInstanceOf(JoaraError)
        expect(err.name).toBe('JoaraError')
        expect(err.message).toBe('기본 에러')
    })

    test('JoaraApiError 상태 코드 및 에러 코드 확인', () => {
        const err = new JoaraApiError('작품을 찾을 수 없습니다', 404, 1004, { detail: 'not found' }, 'https://api.joara.com/v1/book/detail.joa')
        expect(err).toBeInstanceOf(JoaraError)
        expect(err).toBeInstanceOf(JoaraApiError)
        expect(err.status).toBe(404)
        expect(err.errorCode).toBe(1004)
        expect(err.url).toBe('https://api.joara.com/v1/book/detail.joa')
        expect(err.responseData).toEqual({ detail: 'not found' })
    })

    test('JoaraTimeoutError 타임아웃 속성 확인', () => {
        const err = new JoaraTimeoutError('요청 시간 초과', 5000, 'https://api.joara.com/v2/search/query')
        expect(err).toBeInstanceOf(JoaraError)
        expect(err.timeoutMs).toBe(5000)
    })

    test('JoaraRateLimitError retry-after 속성 확인', () => {
        const err = new JoaraRateLimitError('Too Many Requests', 2000)
        expect(err).toBeInstanceOf(JoaraError)
        expect(err.retryAfterMs).toBe(2000)
    })

    test('JoaraValidationError 유효성 필드 확인', () => {
        const err = new JoaraValidationError('검색어가 누락되었습니다', 'query')
        expect(err).toBeInstanceOf(JoaraError)
        expect(err.field).toBe('query')
    })
})
