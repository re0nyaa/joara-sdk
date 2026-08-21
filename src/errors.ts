/**
 * 조아라 SDK의 기본 최상위 에러 클래스입니다.
 */
export class JoaraError extends Error {
    /**
     * @param message - 에러 메시지
     */
    constructor(message: string) {
        super(message)
        this.name = 'JoaraError'
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

/**
 * 조아라 API 호출 후 서버 응답이 실패 상태이거나 비정상 응답일 때 발생하는 에러입니다.
 */
export class JoaraApiError extends JoaraError {
    /** HTTP 상태 코드 */
    readonly status: number
    /** 조아라 API 고유 에러 코드 */
    readonly errorCode?: number
    /** 서버로부터 수신된 원본 응답 데이터 */
    readonly responseData?: any
    /** 요청 대상 URL */
    readonly url?: string

    /**
     * @param message - 에러 메시지
     * @param status - HTTP 상태 코드
     * @param errorCode - API 에러 코드
     * @param responseData - 응답 데이터
     * @param url - 요청 URL
     */
    constructor(message: string, status: number, errorCode?: number, responseData?: any, url?: string) {
        super(`[${status}] ${message}${errorCode ? ` (code: ${errorCode})` : ''}`)
        this.name = 'JoaraApiError'
        this.status = status
        this.errorCode = errorCode
        this.responseData = responseData
        this.url = url
    }
}

/**
 * 네트워크 연결 끊김, 소켓 에러 등 통신 장애 시 발생하는 에러입니다.
 */
export class JoaraNetworkError extends JoaraError {
    /** 원인이 된 하위 Error 객체 */
    readonly causeError?: Error
    /** 요청 대상 URL */
    readonly url?: string

    /**
     * @param message - 에러 메시지
     * @param causeError - 원인 에러 객체
     * @param url - 요청 URL
     */
    constructor(message: string, causeError?: Error, url?: string) {
        super(message)
        this.name = 'JoaraNetworkError'
        this.causeError = causeError
        this.url = url
    }
}

/**
 * 요청 타임아웃 제한 시간을 초과했을 때 발생하는 에러입니다.
 */
export class JoaraTimeoutError extends JoaraError {
    /** 초과된 타임아웃 시간 (밀리초) */
    readonly timeoutMs: number
    /** 요청 대상 URL */
    readonly url?: string

    /**
     * @param message - 에러 메시지
     * @param timeoutMs - 타임아웃 제한 시간(ms)
     * @param url - 요청 URL
     */
    constructor(message: string, timeoutMs: number, url?: string) {
        super(message)
        this.name = 'JoaraTimeoutError'
        this.timeoutMs = timeoutMs
        this.url = url
    }
}

/**
 * API 요청 빈도 초과(429 Too Many Requests) 시 발생하는 에러입니다.
 */
export class JoaraRateLimitError extends JoaraError {
    /** 서버가 안내한 재시도 대기 시간 (밀리초) */
    readonly retryAfterMs?: number
    /** 요청 대상 URL */
    readonly url?: string

    /**
     * @param message - 에러 메시지
     * @param retryAfterMs - 재시도 대기 시간(ms)
     * @param url - 요청 URL
     */
    constructor(message: string, retryAfterMs?: number, url?: string) {
        super(message)
        this.name = 'JoaraRateLimitError'
        this.retryAfterMs = retryAfterMs
        this.url = url
    }
}

/**
 * 필수 인자 누락 등 파라미터 유효성 검증 실패 시 발생하는 에러입니다.
 */
export class JoaraValidationError extends JoaraError {
    /** 유효성 검증에 실패한 필드명 */
    readonly field?: string

    /**
     * @param message - 에러 메시지
     * @param field - 유효성 실패 필드명
     */
    constructor(message: string, field?: string) {
        super(message)
        this.name = 'JoaraValidationError'
        this.field = field
    }
}
