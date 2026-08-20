export class JoaraError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'JoaraError'
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

export class JoaraApiError extends JoaraError {
    readonly status: number
    readonly errorCode?: number
    readonly responseData?: any
    readonly url?: string

    constructor(message: string, status: number, errorCode?: number, responseData?: any, url?: string) {
        super(`[${status}] ${message}${errorCode ? ` (code: ${errorCode})` : ''}`)
        this.name = 'JoaraApiError'
        this.status = status
        this.errorCode = errorCode
        this.responseData = responseData
        this.url = url
    }
}

export class JoaraNetworkError extends JoaraError {
    readonly causeError?: Error
    readonly url?: string

    constructor(message: string, causeError?: Error, url?: string) {
        super(message)
        this.name = 'JoaraNetworkError'
        this.causeError = causeError
        this.url = url
    }
}

export class JoaraTimeoutError extends JoaraError {
    readonly timeoutMs: number
    readonly url?: string

    constructor(message: string, timeoutMs: number, url?: string) {
        super(message)
        this.name = 'JoaraTimeoutError'
        this.timeoutMs = timeoutMs
        this.url = url
    }
}

export class JoaraRateLimitError extends JoaraError {
    readonly retryAfterMs?: number
    readonly url?: string

    constructor(message: string, retryAfterMs?: number, url?: string) {
        super(message)
        this.name = 'JoaraRateLimitError'
        this.retryAfterMs = retryAfterMs
        this.url = url
    }
}

export class JoaraValidationError extends JoaraError {
    readonly field?: string

    constructor(message: string, field?: string) {
        super(message)
        this.name = 'JoaraValidationError'
        this.field = field
    }
}
